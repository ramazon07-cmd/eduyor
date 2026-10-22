"""Session-authenticated API for the website's custom administrator workspace."""
import hashlib
import json
from django.contrib.auth import authenticate, login, logout
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework.permissions import BasePermission, AllowAny
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from .views import SecureView, AuthThrottle
from .models import User, MentorProfile, Booking, PaymentReceipt
from . import services


class Administrator(BasePermission):
    def has_permission(self, request, view):
        u = request.user
        return bool(u.is_authenticated and u.is_active and u.is_staff and u.is_superuser)


class ControlView(SecureView):
    permission_classes = [Administrator]


def operator(user):
    return {'email': user.email, 'name': user.profile.full_name or 'Administrator'}


class Login(SecureView):
    permission_classes = [AllowAny]
    throttle_classes = [AuthThrottle]

    def post(self, request):
        email = request.data.get('email', '')
        password = request.data.get('password', '')
        if not isinstance(email, str) or not isinstance(password, str) or len(email) > 254 or len(password) > 128:
            raise ValidationError('Email yoki parol noto‘g‘ri.')
        user = authenticate(request, email=email.strip().lower(), password=password)
        if not user or not user.is_active or not user.is_staff or not user.is_superuser:
            raise ValidationError('Email yoki parol noto‘g‘ri.')
        login(request, user)
        return Response(operator(user))


class Me(ControlView):
    def get(self, request):
        return Response(operator(request.user))

    def delete(self, request):
        logout(request)
        return Response({'ok': True})


class Summary(ControlView):
    def get(self, request):
        return Response({'mentors': MentorProfile.objects.filter(approval='pending').count(),
                         'payments': Booking.objects.filter(payment_status='submitted').count(),
                         'users': User.objects.count(), 'lessons': Booking.objects.count()})


def page(request, queryset, serialize):
    paginator = PageNumberPagination()
    paginator.page_size = 20
    rows = paginator.paginate_queryset(queryset, request)
    return paginator.get_paginated_response([serialize(row) for row in rows])


def mentor_data(m):
    fields = {key: str(getattr(m, key)) for key in ('headline', 'bio', 'experience', 'teaching_languages', 'hourly_price', 'approval', 'is_paused')}
    fields.update(id=m.pk, name=m.user.profile.full_name, email=m.user.email,
                  subjects=list(m.subjects.order_by('pk').values_list('name', flat=True)))
    fields['paused'] = m.is_paused
    fields['version'] = hashlib.sha256(json.dumps(fields, sort_keys=True).encode()).hexdigest()
    return fields


class Mentors(ControlView):
    def get(self, request):
        rows = MentorProfile.objects.select_related('user__profile').prefetch_related('subjects').order_by('-pk')
        state = request.query_params.get('state', 'pending')
        if state in ['pending', 'approved', 'rejected']:
            rows = rows.filter(approval=state)
        return page(request, rows, mentor_data)

    def post(self, request, pk):
        identity = get_object_or_404(MentorProfile, pk=pk)
        action = request.data.get('action')
        if action not in ['approve', 'reject', 'pause', 'resume']:
            raise ValidationError('Amal noto‘g‘ri.')
        with transaction.atomic():
            services.lock_users([identity.user_id])
            mentor = MentorProfile.objects.select_related('user__profile').get(pk=pk)
            if request.data.get('version') != mentor_data(mentor)['version']:
                return Response({'detail': 'Profil o‘zgargan. Ro‘yxatni yangilang va qayta ko‘rib chiqing.'}, status=409)
            if action in ['approve', 'reject']:
                mentor.approval = 'approved' if action == 'approve' else 'rejected'
            else:
                mentor.is_paused = action == 'pause'
            mentor.save(update_fields=['approval', 'is_paused'])
            return Response(mentor_data(mentor))


def booking_data(b):
    return {key: str(getattr(b, key)) for key in ('id', 'starts_at', 'ends_at', 'status', 'payment_status', 'total_price', 'mentor_net', 'payout_status', 'payment_reference', 'receipt_reference', 'payout_reference', 'refund_reference', 'objective', 'issue_note', 'resolution_note')} | {'student': b.student.email, 'mentor': b.mentor.email, 'disputed': b.disputed, 'receipt_digest': getattr(getattr(b, 'payment_receipt', None), 'digest', '')}


class Bookings(ControlView):
    def get(self, request):
        rows = Booking.objects.select_related('student', 'mentor').order_by('-pk')
        state = request.query_params.get('state', 'submitted')
        if state in ['submitted', 'verified', 'refund_required', 'refunded']:
            rows = rows.filter(payment_status=state)
        elif state == 'payout':
            rows = rows.filter(payout_status='pending')
        elif state == 'disputed':
            rows = rows.filter(disputed=True)
        return page(request, rows, booking_data)

    def post(self, request, pk):
        get_object_or_404(Booking, pk=pk)
        action = request.data.get('action')
        reference = request.data.get('reference', '')
        note = request.data.get('note', '')
        if not isinstance(reference, str) or len(reference) > 160 or not isinstance(note, str) or len(note) > 1500:
            raise ValidationError('Ma’lumot uzunligi noto‘g‘ri.')
        if action in ['refund', 'payout']:
            if not reference.strip() or request.data.get('checked') is not True:
                raise ValidationError('Bankdagi o‘tkazmani tekshiring, raqamini kiriting va belgilang.')
        if action == 'verify':
            with transaction.atomic():
                identity = Booking.objects.get(pk=pk)
                services.lock_users([identity.student_id, identity.mentor_id])
                receipt = get_object_or_404(PaymentReceipt, booking_id=pk)
                if request.data.get('receipt_digest') != receipt.digest:
                    return Response({'detail':'Chek yangilangan. Ro‘yxatni yangilab qayta tekshiring.'}, status=409)
                b = services.verify_payment(pk, 'Chek:' + receipt.digest)
        elif action == 'refund':
            b = services.refund(pk, reference)
        elif action == 'payout':
            b = services.pay_out(pk, reference)
        elif action == 'complete':
            b = services.complete(pk, request.user)
        elif action == 'cancel':
            b = services.cancel(pk, request.user)
        elif action == 'resolve':
            b = services.resolve_issue(pk, note)
        elif action == 'resolve_refund':
            b = services.resolve_with_refund(pk, note)
        else:
            raise ValidationError('Amal noto‘g‘ri.')
        return Response(booking_data(b))


class Users(ControlView):
    def get(self, request):
        rows = User.objects.select_related('profile').order_by('-pk')
        search = request.query_params.get('search', '').strip()[:120]
        if search:
            rows = rows.filter(Q(email__icontains=search) | Q(profile__full_name__icontains=search))
        return page(request, rows, lambda u: {'id': u.pk, 'name': u.profile.full_name, 'email': u.email, 'active': u.is_active, 'admin': u.is_staff and u.is_superuser})
