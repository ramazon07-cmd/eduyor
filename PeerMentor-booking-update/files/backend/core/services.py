"""All booking/admin state changes lock users first, then the booking.

Every writer uses this lock order. Profile edits also lock the owner user.
Do not replace these services with QuerySet.update() in an API/admin operation.
"""
from contextlib import contextmanager
from datetime import datetime, time, timedelta, timezone as dt_timezone
from decimal import Decimal, ROUND_HALF_UP
from zoneinfo import ZoneInfo
from urllib.parse import urlsplit
from django.db import transaction
from django.db.models import Q, Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError, PermissionDenied
from .models import User, MentorProfile, Booking
from .errors import Conflict

UTC = dt_timezone.utc
HOUR = timedelta(hours=1)
RATE = Decimal('0.10')


def lock_users(ids):
    # Explicit individual locks ensure deterministic acquisition, independent of query plans.
    for pk in sorted(set(ids)):
        User.objects.select_for_update().get(pk=pk)


def blocking(now):
    return Q(status__in=['confirmed','completed']) | Q(status='pending_payment',expires_at__gt=now)


def conflicts(ids,start,end,now,exclude=None):
    qs = Booking.objects.filter(Q(student_id__in=ids)|Q(mentor_id__in=ids)).filter(blocking(now),starts_at__lt=end,ends_at__gt=start)
    if exclude:
        qs = qs.exclude(pk=exclude)
    return qs.exists()


def wall_utc(day, t, tz):
    """Reject nonexistent/ambiguous DST wall times rather than guessing a fold."""
    naive = datetime.combine(day,t)
    a = naive.replace(tzinfo=tz,fold=0)
    b = naive.replace(tzinfo=tz,fold=1)
    if a.utcoffset() != b.utcoffset():
        return None
    utc = a.astimezone(UTC)
    return utc if utc.astimezone(tz).replace(tzinfo=None) == naive else None


def candidate_slots(mentor, now=None, minimum_notice=timedelta(hours=24)):
    """Every valid local whole-hour slot is offered; no mentor schedule is required.

    Existing bookings still remove conflicts in available_slots/reserve. Legacy
    availability/blocked-date records are preserved but no longer used.
    """
    now = now or timezone.now()
    tz = ZoneInfo(mentor.user.profile.timezone)
    first = now.astimezone(tz).date()
    slots = []
    for offset in range(31):
        day = first + timedelta(days=offset)
        for hour in range(24):
            start = wall_utc(day, time(hour), tz)
            if start is not None and now + minimum_notice <= start <= now + timedelta(days=30):
                slots.append(start)
    return sorted(set(slots))


def available_slots(mentor, viewer=None, now=None):
    now = now or timezone.now()
    ids = [mentor.user_id] + ([viewer.pk] if viewer and viewer.is_authenticated else [])
    busy = list(Booking.objects.filter(Q(student_id__in=ids)|Q(mentor_id__in=ids)).filter(blocking(now),ends_at__gt=now,starts_at__lt=now+timedelta(days=31)).values_list('starts_at','ends_at'))
    return [s for s in candidate_slots(mentor,now) if not any(a < s+HOUR and b > s for a,b in busy)]


def split_price(price):
    price = Decimal(price)
    fee = (price*RATE).quantize(Decimal('1'),rounding=ROUND_HALF_UP)
    return price,fee,price-fee


@transaction.atomic
def reserve(student,mentor_id,start,objective):
    if student.pk == mentor_id:
        raise ValidationError({'mentor_id':'O‘zingizdan dars band qila olmaysiz.'})
    lock_users([student.pk,mentor_id])
    now = timezone.now()
    mentor = MentorProfile.objects.select_related('user__profile').filter(user_id=mentor_id,approval='approved',is_paused=False).first()
    if not mentor:
        raise Conflict('Mentor hozir band qilish uchun ochiq emas.')
    if start not in candidate_slots(mentor,now):
        raise Conflict('Bu vaqt mavjud emas. Kamida 24 soat oldin band qiling.')
    if conflicts([student.pk,mentor_id],start,start+HOUR,now):
        raise Conflict()
    total,fee,net = split_price(mentor.hourly_price)
    return Booking.objects.create(student=student,mentor_id=mentor_id,starts_at=start,ends_at=start+HOUR,objective=objective,total_price=total,platform_fee=fee,mentor_net=net,commission_rate=RATE,expires_at=now+HOUR)


@contextmanager
def locked_booking(pk):
    with transaction.atomic():
        identity = Booking.objects.values('student_id','mentor_id').get(pk=pk)
        lock_users(identity.values())
        booking = Booking.objects.select_for_update().get(pk=pk)
        yield booking


def participant(booking,user):
    if user.pk not in (booking.student_id,booking.mentor_id) and not user.is_staff:
        raise PermissionDenied('Bu dars sizga tegishli emas.')


def expire_booking(b,now):
    if b.status == 'pending_payment' and b.expires_at <= now:
        b.status = 'expired'
        if b.payment_status == 'verified':
            b.payment_status = 'refund_required'
        b.save()


def refresh_booking(pk):
    with locked_booking(pk) as b:
        expire_booking(b,timezone.now())
        return b


def submit_payment(pk,user,reference):
    with locked_booking(pk) as b:
        participant(b,user)
        if user.pk != b.student_id:
            raise PermissionDenied()
        expire_booking(b,timezone.now())
        if b.status != 'pending_payment':
            raise Conflict('Bron faol emas. Pul yubormang; yuborgan bo‘lsangiz administratorga yozing.')
        if b.payment_status == 'submitted' and b.payment_reference == reference:
            return b
        if b.payment_status not in ['unpaid','submitted']:
            raise Conflict()
        b.payment_reference = reference
        b.payment_status = 'submitted'
        b.save()
        return b


def verify_payment(pk,receipt_reference):
    """Admin has independently checked the bank receipt. Late funds need refund.

    Return persisted expired/refund_required state instead of raising inside the
    atomic block, so an invalid/late receipt cannot silently lose its refund flag.
    """
    if not receipt_reference.strip():
        raise ValidationError({'reference':'Bankdagi tasdiqlangan tranzaksiya raqami kerak.'})
    with locked_booking(pk) as b:
        if b.payment_status in ['verified','refund_required','refunded']:
            return b
        now = timezone.now()
        b.receipt_reference = receipt_reference.strip()
        b.payment_verified_at = now
        valid = b.status == 'pending_payment' and b.expires_at > now
        mentor = MentorProfile.objects.select_related('user__profile').get(user_id=b.mentor_id)
        valid = valid and mentor.approval == 'approved' and not mentor.is_paused
        valid = valid and b.starts_at in candidate_slots(mentor,b.created_at,minimum_notice=timedelta(0)) and b.starts_at > now
        valid = valid and not conflicts([b.student_id,b.mentor_id],b.starts_at,b.ends_at,now,exclude=b.pk)
        if valid:
            b.status,b.payment_status = 'confirmed','verified'
        else:
            if b.status == 'pending_payment':
                b.status = 'expired'
            b.payment_status = 'refund_required'
        b.save()
        return b


def cancel(pk,user):
    with locked_booking(pk) as b:
        participant(b,user)
        if not user.is_staff:
            raise PermissionDenied('Darsni faqat administrator hal qilishi mumkin.')
        expire_booking(b,timezone.now())
        if b.status in ['cancelled','expired']:
            return b
        if b.status not in ['pending_payment','confirmed'] or timezone.now() >= b.starts_at:
            raise Conflict('Dars boshlangan. Muammo bo‘lsa administratorga murojaat qiling.')
        b.status = 'cancelled'
        if b.payment_status == 'verified':
            b.payment_status = 'refund_required'
        b.payout_status = 'not_eligible'
        b.save()
        return b


def complete(pk,user):
    with locked_booking(pk) as b:
        participant(b,user)
        if user.pk != b.student_id and not user.is_staff:
            raise PermissionDenied('Dars tugaganini o‘quvchi tasdiqlaydi.')
        if b.status == 'completed':
            return b
        if b.status != 'confirmed' or b.payment_status != 'verified' or timezone.now() < b.ends_at or b.disputed:
            raise Conflict('Dars tugagach va muammo hal bo‘lgach tasdiqlash mumkin.')
        b.status,b.payout_status = 'completed','pending'
        b.completed_at = timezone.now()
        b.save()
        return b


def set_meeting(pk,user,url):
    parsed = urlsplit(url)
    import re
    if parsed.scheme != 'https' or parsed.netloc != 'meet.google.com' or not re.fullmatch(r'/[a-z]{3}-[a-z]{4}-[a-z]{3}',parsed.path) or parsed.query or parsed.fragment:
        raise ValidationError({'meeting_url':'https://meet.google.com/abc-defg-hij ko‘rinishidagi havola kerak.'})
    with locked_booking(pk) as b:
        if user.pk != b.mentor_id:
            raise PermissionDenied()
        if b.status != 'confirmed' or b.payment_status != 'verified':
            raise Conflict('Faqat tasdiqlangan darsga havola qo‘shiladi.')
        b.meeting_url = url
        b.save()
        return b


def report_issue(pk,user,note):
    with locked_booking(pk) as b:
        participant(b,user)
        if b.status not in ['confirmed','completed'] or timezone.now() < b.starts_at:
            raise Conflict('Dars boshlangach muammo yuborishingiz mumkin.')
        b.disputed,b.issue_note = True,note
        if b.payout_status != 'paid':
            b.payout_status = 'not_eligible'
        b.save()
        return b


def resolve_issue(pk,note):
    if not note.strip():
        raise ValidationError('Yechim izohini kiriting.')
    with locked_booking(pk) as b:
        b.disputed,b.resolution_note = False,note
        if b.status == 'completed' and b.payment_status == 'verified' and b.payout_status != 'paid':
            b.payout_status = 'pending'
        b.save()
        return b


def pay_out(pk,reference):
    with locked_booking(pk) as b:
        if b.payout_status == 'paid':
            return b
        if b.status != 'completed' or b.payment_status != 'verified' or b.disputed or b.payout_status != 'pending':
            raise Conflict('Bu dars mentor to‘lovi uchun tayyor emas.')
        if not reference.strip():
            raise ValidationError('O‘tkazma raqamini kiriting.')
        b.payout_status,b.payout_reference,b.paid_at = 'paid',reference.strip(),timezone.now()
        b.save()
        return b


def refund(pk,reference):
    with locked_booking(pk) as b:
        if b.payment_status == 'refunded':
            return b
        if b.payment_status != 'refund_required' or not reference.strip():
            raise Conflict('Qaytarish talab qilinmagan yoki o‘tkazma raqami yo‘q.')
        b.payment_status,b.refund_reference,b.refunded_at = 'refunded',reference.strip(),timezone.now()
        b.payout_status = 'not_eligible'
        b.save()
        return b


def earnings(user):
    eligible = Booking.objects.filter(mentor=user,status='completed',payment_status='verified',disputed=False)
    result = eligible.aggregate(gross=Sum('total_price'),platform_fee=Sum('platform_fee'),net_earned=Sum('mentor_net'))
    result['pending_payout'] = eligible.filter(payout_status='pending').aggregate(x=Sum('mentor_net'))['x']
    result['paid'] = eligible.filter(payout_status='paid').aggregate(x=Sum('mentor_net'))['x']
    return {k:str(v or 0) for k,v in result.items()}


def resolve_with_refund(pk,note):
    """Admin resolution of an after-start dispute; refund is still sent manually."""
    if not note.strip():
        raise ValidationError('Qaror izohini kiriting.')
    with locked_booking(pk) as b:
        if b.payment_status in ['refund_required','refunded']:
            return b
        if b.payment_status != 'verified' or b.payout_status == 'paid':
            raise Conflict('To‘lov tekshirilmagan yoki mentor allaqachon to‘langan. Avval bankdagi o‘tkazmalarni tekshiring.')
        b.status,b.payment_status,b.payout_status = 'cancelled','refund_required','not_eligible'
        b.disputed,b.resolution_note = False,note
        b.save()
        return b
