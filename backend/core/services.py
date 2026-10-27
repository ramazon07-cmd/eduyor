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
from django.db.models import Q, Sum, Exists, OuterRef
from django.utils import timezone
from rest_framework.exceptions import ValidationError, PermissionDenied
from .models import User, Profile, MentorProfile, Booking, TokenEntry
from .errors import Conflict

UTC = dt_timezone.utc
SESSION_DURATION_MINUTES = 50
SESSION_DURATION = timedelta(minutes=SESSION_DURATION_MINUTES)
HOLD_DURATION = timedelta(minutes=60)
# Commission falls with the mentor's successful lessons: 10% for the first 35,
# then 0.2 points less per lesson, never below 3%.
BASE_RATE = Decimal('0.10')
MIN_RATE = Decimal('0.03')
RATE_STEP = Decimal('0.002')
FULL_RATE_LESSONS = 35
# Center lessons: the platform takes at most 7%, the owner an agreed 0-40%.
CENTER_RATE = Decimal('0.07')
MAX_CENTER_SHARE = 40
# A student "leaves" when their first lesson with a mentor gets no follow-up
# booking within a week and no 4-5 star rating. Counted over 30 days.
CHURN_GRACE = timedelta(days=7)
CHURN_WINDOW = timedelta(days=30)
WARNING_CHURNS, FEE_CHURNS, HIDE_CHURNS, REMOVE_AFTER_HIDE = 2, 3, 5, 3
PENALTY_RATE = Decimal('0.05')
HIDE_DURATION = timedelta(days=30)
TOKENS_PER_LESSON = 10
REFERRAL_TOKENS_PER_MONTH = 10
TOKEN_LESSONS_PER_MONTH = 1


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
    """Offer only mentor-published weekly windows, excluding blocked dates."""
    now = now or timezone.now()
    tz = ZoneInfo(mentor.user.profile.timezone)
    first = now.astimezone(tz).date()
    rules = list(mentor.availability.all())
    blocked = set(mentor.blocked_dates.values_list('date', flat=True))
    slots = []
    for offset in range(31):
        day = first + timedelta(days=offset)
        if day in blocked:
            continue
        for hour in range(24):
            local_start = datetime.combine(day, time(hour))
            local_end = local_start + SESSION_DURATION
            if not any(r.weekday == day.weekday() and r.start_time <= local_start.time() and local_end.time() <= r.end_time for r in rules):
                continue
            start = wall_utc(day, time(hour), tz)
            if start is not None and now + minimum_notice <= start <= now + timedelta(days=30):
                slots.append(start)
    return sorted(set(slots))


def available_slots(mentor, viewer=None, now=None):
    now = now or timezone.now()
    ids = [mentor.user_id] + ([viewer.pk] if viewer and viewer.is_authenticated else [])
    busy = list(Booking.objects.filter(Q(student_id__in=ids)|Q(mentor_id__in=ids)).filter(blocking(now),ends_at__gt=now,starts_at__lt=now+timedelta(days=31)).values_list('starts_at','ends_at'))
    return [s for s in candidate_slots(mentor,now) if not any(a < s+SESSION_DURATION and b > s for a,b in busy)]


def successful_lessons(mentor_id):
    return Booking.objects.filter(mentor_id=mentor_id,status='completed',payment_status='verified',disputed=False).count()


def commission_rate(lessons):
    return max(MIN_RATE, BASE_RATE - max(0, lessons-FULL_RATE_LESSONS)*RATE_STEP)


def month_start(now):
    return now.replace(day=1,hour=0,minute=0,second=0,microsecond=0)


def token_balance(user_id):
    return TokenEntry.objects.filter(user_id=user_id).aggregate(x=Sum('amount'))['x'] or 0


def token_lessons_this_month(user_id, now):
    return TokenEntry.objects.filter(user_id=user_id,reason='lesson',created_at__gte=month_start(now)).count() - TokenEntry.objects.filter(user_id=user_id,reason='refund',created_at__gte=month_start(now)).count()


def split_price(price, rate, center_share=0):
    price = Decimal(price)
    fee = (price*rate).quantize(Decimal('1'),rounding=ROUND_HALF_UP)
    center_fee = (price*center_share/100).quantize(Decimal('1'),rounding=ROUND_HALF_UP)
    return price,fee,center_fee,price-fee-center_fee


def churned_students(mentor_id, since, now):
    """Students whose first lesson with this mentor stayed their last, decided between since and now."""
    pair = dict(mentor_id=OuterRef('mentor_id'),student_id=OuterRef('student_id'))
    earlier = Booking.objects.filter(**pair,status='completed',starts_at__lt=OuterRef('starts_at'))
    later = Booking.objects.filter(**pair,starts_at__gt=OuterRef('starts_at')).exclude(status__in=['cancelled','expired'])
    firsts = Booking.objects.filter(mentor_id=mentor_id,status='completed',completed_at__gte=since-CHURN_GRACE,completed_at__lte=now-CHURN_GRACE)
    return firsts.exclude(feedback_rating__gte=4).exclude(Exists(earlier)).exclude(Exists(later)).values('student_id').distinct().count()


def mentor_standing(mentor, now):
    churned = churned_students(mentor.user_id,now-CHURN_WINDOW,now)
    hidden = bool(mentor.hidden_until and mentor.hidden_until > now)
    level = 'removed' if mentor.approval == 'rejected' and mentor.first_hidden_at else 'hidden' if hidden else 'higher_fee' if churned >= FEE_CHURNS else 'warning' if churned >= WARNING_CHURNS else 'ok'
    return {'churned':churned,'level':level,'hidden_until':mentor.hidden_until if hidden else None}


def apply_penalties(mentor, now):
    """Hide a mentor after 5 leavers in 30 days; remove after 3 more once hidden. Run daily."""
    if mentor.approval != 'approved':
        return None
    if mentor.first_hidden_at and churned_students(mentor.user_id,mentor.first_hidden_at,now) >= REMOVE_AFTER_HIDE:
        mentor.approval = 'rejected'
        mentor.save(update_fields=['approval'])
        return 'removed'
    hidden = mentor.hidden_until and mentor.hidden_until > now
    if not hidden and churned_students(mentor.user_id,now-CHURN_WINDOW,now) >= HIDE_CHURNS:
        mentor.hidden_until = now+HIDE_DURATION
        mentor.first_hidden_at = mentor.first_hidden_at or now
        mentor.save(update_fields=['hidden_until','first_hidden_at'])
        return 'hidden'
    return None


@transaction.atomic
def reserve(student,mentor_id,start,objective,*,agreed_price=None,use_tokens=False):
    if student.profile.account_type == 'parent':
        raise ValidationError({'detail':'Ota-ona hisobi bilan dars band qilib bo‘lmaydi. Darsni farzandingiz o‘z hisobidan band qiladi.'})
    if student.pk == mentor_id:
        raise ValidationError({'mentor_id':'O‘zingizdan dars band qila olmaysiz.'})
    if not student.profile.email_verified:
        raise ValidationError({'detail':'Dars band qilishdan oldin emailingizni tasdiqlang.'})
    lock_users([student.pk,mentor_id])
    now = timezone.now()
    mentor = MentorProfile.objects.select_related('user__profile','center').filter(user_id=mentor_id,approval='approved',is_paused=False,user__is_active=True).first()
    if not mentor:
        raise Conflict('Mentor hozir band qilish uchun ochiq emas.')
    if start not in candidate_slots(mentor,now):
        raise Conflict('Bu vaqt mavjud emas. Kamida 24 soat oldin band qiling.')
    if conflicts([student.pk,mentor_id],start,start+SESSION_DURATION,now):
        raise Conflict()
    if not Decimal('30000') <= mentor.hourly_price <= Decimal('60000'):
        raise ValidationError({'hourly_price':'Mentor narxi 30 000–60 000 so‘m oralig‘ida bo‘lishi kerak.'})
    price = mentor.hourly_price if agreed_price is None else Decimal(agreed_price)
    if not Decimal('30000') <= price <= Decimal('60000'):
        raise ValidationError({'price': 'Narx 30 000–60 000 so‘m oralig‘ida bo‘lishi kerak.'})
    rate = commission_rate(successful_lessons(mentor_id))
    center = mentor.center if mentor.center and mentor.center.approval == 'approved' else None
    if center:
        rate = min(rate,CENTER_RATE)
    if churned_students(mentor_id,now-CHURN_WINDOW,now) >= FEE_CHURNS:
        rate += PENALTY_RATE
    # The owner teaching in their own center keeps the whole remainder.
    share = mentor.center_share if center and center.owner_id != mentor_id else 0
    total,fee,center_fee,net = split_price(price,rate,share)
    money = dict(total_price=total,platform_fee=fee,center=center if share else None,center_fee=center_fee,mentor_net=net,commission_rate=rate)
    if not use_tokens:
        return Booking.objects.create(student=student,mentor_id=mentor_id,starts_at=start,ends_at=start+SESSION_DURATION,objective=objective,**money,expires_at=now+HOLD_DURATION)
    if token_balance(student.pk) < TOKENS_PER_LESSON:
        raise ValidationError({'detail':f'Bepul dars uchun {TOKENS_PER_LESSON} ta token kerak.'})
    if token_lessons_this_month(student.pk,now) >= TOKEN_LESSONS_PER_MONTH:
        raise ValidationError({'detail':'Tokenlar bilan oyiga bitta dars olish mumkin.'})
    # The platform pays the mentor's usual share for a token lesson.
    booking = Booking.objects.create(student=student,mentor_id=mentor_id,starts_at=start,ends_at=start+SESSION_DURATION,objective=objective,**money,expires_at=now+HOLD_DURATION,paid_with_tokens=True,status='confirmed',payment_status='verified',payment_reference='EduYor tokenlari',payment_verified_at=now)
    TokenEntry.objects.create(user_id=student.pk,amount=-TOKENS_PER_LESSON,reason='lesson',booking=booking)
    return booking


def return_tokens(b):
    """A cancelled token lesson gives the tokens back instead of a bank refund."""
    if b.paid_with_tokens and b.payment_status == 'refund_required':
        TokenEntry.objects.get_or_create(booking=b,reason='refund',defaults={'user_id':b.student_id,'amount':TOKENS_PER_LESSON})
        b.payment_status,b.refunded_at = 'refunded',timezone.now()


def reward_referrals(b, now):
    """One token to whoever invited a participant, on that participant's first paid lesson."""
    if b.paid_with_tokens:
        return
    for uid in (b.student_id,b.mentor_id):
        referrer = Profile.objects.filter(user_id=uid).values_list('referred_by_id',flat=True).first()
        # A referrer cannot earn from a lesson they take part in.
        if not referrer or referrer in (b.student_id,b.mentor_id):
            continue
        if TokenEntry.objects.filter(reason='referral',referee_id=uid).exists():
            continue
        # shortcut: the referrer is not locked, so two lessons finishing at once may exceed the cap by one; lock them if abuse shows up.
        if TokenEntry.objects.filter(user_id=referrer,reason='referral',created_at__gte=month_start(now)).count() >= REFERRAL_TOKENS_PER_MONTH:
            continue
        TokenEntry.objects.create(user_id=referrer,amount=1,reason='referral',referee_id=uid,booking=b)


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


def submit_payment(pk,user,reference=''):
    reference = reference.strip()
    with locked_booking(pk) as b:
        participant(b,user)
        if user.pk != b.student_id:
            raise PermissionDenied()
        expire_booking(b,timezone.now())
        if b.status != 'pending_payment':
            raise Conflict('Bron faol emas. Pul yubormang; yuborgan bo‘lsangiz administratorga yozing.')
        if not reference:
            reference = b.payment_reference or f'Bron #{b.pk} · student to‘lov yuborganini bildirdi'
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
        # Published schedule edits do not invalidate an already reserved lesson.
        valid = valid and b.starts_at > now
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
        return_tokens(b)
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
        reward_referrals(b,b.completed_at)
        mentor = MentorProfile.objects.filter(user_id=b.mentor_id).first()
        if mentor:
            apply_penalties(mentor,b.completed_at)
        return b


def submit_feedback(pk, user, rating, comment=None):
    with locked_booking(pk) as b:
        # Even staff cannot rate their own teaching or impersonate a student.
        if user.pk != b.student_id:
            raise PermissionDenied('Faqat dars o‘quvchisi baho bera oladi.')
        if b.status != 'completed' or b.payment_status != 'verified' or timezone.now() < b.ends_at:
            raise Conflict('Faqat yakunlangan va to‘lovi tasdiqlangan darsga baho berish mumkin.')
        if isinstance(rating, bool) or not isinstance(rating, int) or not 1 <= rating <= 5:
            raise ValidationError({'rating': '1 dan 5 gacha yulduz tanlang.'})
        if comment is not None and (not isinstance(comment, str) or len(comment) > 1500):
            raise ValidationError({'comment': 'Izoh 1500 belgidan oshmasin.'})
        if b.feedback_rating is not None and b.feedback_rating != rating:
            raise Conflict('Saqlangan yulduzli bahoni o‘zgartirib bo‘lmaydi.')
        b.feedback_rating = rating
        if b.feedback_submitted_at is None:
            b.feedback_submitted_at = timezone.now()
        if comment is not None:
            b.feedback_comment = comment.strip()
        b.save(update_fields=['feedback_rating', 'feedback_comment', 'feedback_submitted_at'])
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


def center_earnings(center):
    eligible = Booking.objects.filter(center=center,status='completed',payment_status='verified',disputed=False)
    return str(eligible.aggregate(x=Sum('center_fee'))['x'] or 0)


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
        return_tokens(b)
        b.save()
        return b
