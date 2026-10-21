from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo
from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.db import transaction, IntegrityError
from django.db.models import Q
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from django.views.decorators.http import require_GET
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework.exceptions import ValidationError, MethodNotAllowed
from rest_framework.pagination import PageNumberPagination
from rest_framework.throttling import UserRateThrottle
from rest_framework import serializers
from .models import User, Profile, MentorProfile, Subject, AvailabilityRule, BlockedDate, Booking, validate_timezone
from .serializers import RegistrationSerializer, ProfileSerializer, PublicMentorSerializer, MentorSettingsSerializer, SubjectSerializer, ScheduleSerializer, BookingCreateSerializer, BookingSerializer, MentorFilterSerializer, BookingFilterSerializer
from . import services
from .payments import payment_info


def csrf_failure(request,reason=''):
    if request.path.startswith('/api/'):
        return JsonResponse({'detail':'Xavfsizlik tokeni noto‘g‘ri yoki eskirgan. Sahifani yangilang.'},status=403)
    from django.views.csrf import csrf_failure as default_failure
    return default_failure(request,reason=reason)


@require_GET
@ensure_csrf_cookie
def csrf(request):
    return JsonResponse({'detail':'CSRF tayyor.'})


@method_decorator(csrf_protect,name='dispatch')
class SecureView(APIView):
    pass


class AuthThrottle(UserRateThrottle):
    scope = 'auth'


def current_user(user):
    mentor = MentorProfile.objects.filter(user=user).first()
    listing = None
    if mentor:
        listing = {
            **PublicMentorSerializer(mentor).data,
            'approval': mentor.approval,
            'is_paused': mentor.is_paused,
            'is_public': mentor.approval == 'approved' and not mentor.is_paused and user.is_active,
            'has_availability': True,
            'availability_mode': 'always_available',
        }
    return {'id':user.pk,'email':user.email,'profile':ProfileSerializer(user.profile).data,'mentor':MentorSettingsSerializer(mentor).data if mentor else None,'mentor_listing':listing}


class RegisterView(SecureView):
    permission_classes = [AllowAny]
    throttle_classes = [AuthThrottle]
    def post(self,request):
        data = RegistrationSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        d = data.validated_data
        try:
            with transaction.atomic():
                user = User.objects.create_user(d['email'],d['password'])
                user.profile.full_name = d['full_name']
                user.profile.save()
        except IntegrityError:
            raise ValidationError({'email':'Bu email ro‘yxatdan o‘tgan.'})
        login(request,user)
        return Response(current_user(user),status=201)


class LoginView(SecureView):
    permission_classes = [AllowAny]
    throttle_classes = [AuthThrottle]
    def post(self,request):
        email = str(request.data.get('email','')).lower().strip()
        password = request.data.get('password','')
        if not isinstance(password,str) or len(password)>128:
            raise ValidationError({'password':'Parol noto‘g‘ri.'})
        user = authenticate(request,email=email,password=password)
        if not user:
            raise ValidationError({'detail':'Email yoki parol noto‘g‘ri.'})
        login(request,user)
        return Response(current_user(user))


class LogoutView(SecureView):
    def post(self,request):
        logout(request)
        return Response({'detail':'Hisobdan chiqdingiz.'})


class MeView(SecureView):
    def get(self,request):
        return Response(current_user(request.user))
    def patch(self,request):
        with transaction.atomic():
            services.lock_users([request.user.pk])
            profile = Profile.objects.get(user=request.user)
            data = ProfileSerializer(profile,data=request.data,partial=True)
            data.is_valid(raise_exception=True)
            data.save()
        return Response(current_user(User.objects.get(pk=request.user.pk)))


class SubjectsView(SecureView):
    permission_classes = [AllowAny]
    def get(self,request):
        return Response(SubjectSerializer(Subject.objects.order_by('name'),many=True).data)


def public_mentors():
    return MentorProfile.objects.filter(approval='approved',is_paused=False,user__is_active=True).select_related('user__profile').prefetch_related('subjects')


class MentorListView(SecureView):
    permission_classes = [AllowAny]
    def get(self,request):
        # Empty HTML fields are equivalent to omitted filters.
        filters = MentorFilterSerializer(data={key:value for key,value in request.query_params.items() if value != ''})
        filters.is_valid(raise_exception=True)
        params = filters.validated_data
        orderings = {'name':['user__profile__full_name','pk'], 'price_asc':['hourly_price','user__profile__full_name','pk'], 'price_desc':['-hourly_price','user__profile__full_name','pk']}
        qs = public_mentors().order_by(*orderings[params['ordering']])
        if request.user.is_authenticated and request.query_params.get('exclude_self') == '1':
            qs = qs.exclude(user=request.user)
        if params['search']:
            term = params['search']
            qs = qs.filter(Q(user__profile__full_name__icontains=term)|Q(headline__icontains=term)|Q(subjects__name__icontains=term))
        if params.get('subject'):
            qs = qs.filter(subjects=params['subject'])
        if params['language']:
            # Token boundaries avoid matching "en" inside "French". The field
            # remains free text; recognize common English/Uzbek/Russian labels.
            patterns = {
                'uz': r"(^|[^a-zа-я])(o[‘’ʻʼ'`]?zbek(cha)?|uzbek|uz)([^a-zа-я]|$)",
                'en': r"(^|[^a-zа-я])(english|ingliz(cha)?|en)([^a-zа-я]|$)",
                'ru': r"(^|[^a-zа-я])(rus(cha)?|russian|русский|ru)([^a-zа-я]|$)",
            }
            qs = qs.filter(teaching_languages__iregex=patterns[params['language']])
        for key,lookup in [('min_price','hourly_price__gte'),('max_price','hourly_price__lte')]:
            if key in params:
                qs = qs.filter(**{lookup:params[key]})
        pager = PageNumberPagination()
        pager.page_size = 9
        return pager.get_paginated_response(PublicMentorSerializer(pager.paginate_queryset(qs.distinct(),request),many=True).data)


class MentorDetailView(SecureView):
    permission_classes = [AllowAny]
    def get(self,request,pk):
        return Response(PublicMentorSerializer(get_object_or_404(public_mentors(),user_id=pk)).data)


class MentorSettingsView(SecureView):
    def get(self,request):
        obj = MentorProfile.objects.filter(user=request.user).first()
        return Response(MentorSettingsSerializer(obj).data if obj else None)
    def put(self,request):
        with transaction.atomic():
            services.lock_users([request.user.pk])
            obj = MentorProfile.objects.filter(user=request.user).first()
            data = MentorSettingsSerializer(obj,data=request.data)
            data.is_valid(raise_exception=True)
            # Re-review substantive profile edits; pause alone does not reset approval.
            review_fields = ['headline','bio','experience','teaching_languages','subjects']
            changed = obj and any(
                (set(obj.subjects.values_list('pk',flat=True)) != {s.pk for s in data.validated_data[k]}) if k=='subjects'
                else getattr(obj,k) != data.validated_data[k]
                for k in review_fields
            )
            data.save(user=request.user,**({'approval':'pending'} if changed or not obj else {}))
        return Response(data.data)


class ScheduleView(SecureView):
    def get(self,request):
        get_object_or_404(MentorProfile,user=request.user)
        return Response({'mode':'always_available','rules':[],'blocked_dates':[],'timezone':request.user.profile.timezone})


class SlotsView(SecureView):
    permission_classes = [AllowAny]
    def get(self,request,pk):
        mentor = get_object_or_404(public_mentors(),user_id=pk)
        tz_name = request.query_params.get('timezone') or (request.user.profile.timezone if request.user.is_authenticated else 'Asia/Tashkent')
        validate_timezone(tz_name)
        tz = ZoneInfo(tz_name)
        slots = services.available_slots(mentor,request.user)
        return Response({'timezone':tz_name,'duration_minutes':services.SESSION_DURATION_MINUTES,'slots':[{'starts_at':s.isoformat(),'ends_at':(s+services.SESSION_DURATION).isoformat(),'date':s.astimezone(tz).date().isoformat(),'time':s.astimezone(tz).strftime('%H:%M')} for s in slots]})


class BookingListView(SecureView):
    def get(self,request):
        qs = Booking.objects.filter(Q(student=request.user)|Q(mentor=request.user)).order_by('-starts_at')
        filters = BookingFilterSerializer(data={key:value for key,value in request.query_params.items() if value != ''})
        filters.is_valid(raise_exception=True)
        params = filters.validated_data
        if params.get('role') == 'learning':
            qs = qs.filter(student=request.user)
        elif params.get('role') == 'teaching':
            qs = qs.filter(mentor=request.user)
        if params.get('status'):
            now = timezone.now()
            if params['status'] == 'expired':
                # A hold is expired immediately, even before a cleanup has run.
                qs = qs.filter(Q(status='expired') | Q(status='pending_payment',expires_at__lte=now))
            elif params['status'] == 'pending_payment':
                qs = qs.filter(status='pending_payment',expires_at__gt=now)
            else:
                qs = qs.filter(status=params['status'])
        if params.get('date'):
            day = params['date']
            tz = ZoneInfo(request.user.profile.timezone)
            start = datetime.combine(day,time.min,tzinfo=tz)
            end = datetime.combine(day+timedelta(days=1),time.min,tzinfo=tz)
            qs = qs.filter(starts_at__gte=start,starts_at__lt=end)
        if request.query_params.get('meeting_ready') == '1':
            qs = qs.filter(student=request.user,status='confirmed',payment_status='verified',ends_at__gt=timezone.now()).exclude(meeting_url='').order_by('starts_at')
        pager = PageNumberPagination()
        pager.page_size = 20
        page = pager.paginate_queryset(qs,request)
        bookings = [services.refresh_booking(b.pk) for b in page]
        return pager.get_paginated_response(BookingSerializer(bookings,many=True).data)
    def post(self,request):
        data = BookingCreateSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        d = data.validated_data
        if not payment_info()['can_accept_payment']:
            raise ValidationError({'detail':'To‘lov rekvizitlari sozlanmagan. Administratorga murojaat qiling.'})
        if not User.objects.filter(pk=d['mentor_id'],is_active=True).exists():
            raise ValidationError({'mentor_id':'Mentor topilmadi.'})
        obj = services.reserve(request.user,d['mentor_id'],d['starts_at'],d['objective'])
        return Response(BookingSerializer(obj).data,status=201)


class BookingDetailView(SecureView):
    def get(self,request,pk):
        obj = get_object_or_404(Booking,pk=pk)
        services.participant(obj,request.user)
        return Response(BookingSerializer(services.refresh_booking(pk)).data)


class BookingActionView(SecureView):
    def post(self,request,pk,action):
        obj = get_object_or_404(Booking,pk=pk)
        services.participant(obj,request.user)
        def text(key,max_length,required=True):
            field = serializers.CharField(max_length=max_length,allow_blank=not required)
            try:
                return field.run_validation(request.data.get(key,None if required else ''))
            except ValidationError as exc:
                raise ValidationError({key:exc.detail})
        if action == 'payment':
            reference = text('reference',160,required=False)
            obj = services.submit_payment(pk,request.user,reference)
        elif action == 'cancel':
            raise MethodNotAllowed('POST',detail='Darsni foydalanuvchi bekor qila olmaydi.')
        elif action == 'complete':
            obj = services.complete(pk,request.user)
        elif action == 'meeting':
            obj = services.set_meeting(pk,request.user,text('meeting_url',300))
        elif action == 'issue':
            obj = services.report_issue(pk,request.user,text('note',1500))
        else:
            return Response({'detail':'Amal topilmadi.'},status=404)
        return Response(BookingSerializer(obj).data)


class PaymentInfoView(SecureView):
    def get(self,request):
        return Response(payment_info())


class EarningsView(SecureView):
    def get(self,request):
        return Response({**services.earnings(request.user),'currency':'UZS'})
