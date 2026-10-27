"""Learning centers group mentors under one brand. Owners agree a 0-40% share of each member lesson."""
from django.db import IntegrityError, transaction
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from .codes import clean_code, new_code
from .models import LearningCenter, MentorProfile
from .serializers import logo_url, prepare_logo
from .services import lock_users, center_earnings, MAX_CENTER_SHARE
from .views import SecureView, AuthThrottle

NAME_TAKEN = 'Bu nomdagi markaz allaqachon bor.'


class CenterInput(serializers.ModelSerializer):
    class Meta:
        model = LearningCenter
        fields = ['name', 'kind', 'description', 'city', 'address']

    def validate_name(self, name):
        if LearningCenter.objects.filter(name__iexact=name).exclude(pk=getattr(self.instance, 'pk', None)).exists():
            raise serializers.ValidationError(NAME_TAKEN)
        return name

    def validate(self, data):
        if data['kind'] == 'offline' and not (data.get('city', '').strip() and data.get('address', '').strip()):
            raise serializers.ValidationError({'address': 'Offline markaz uchun shahar va manzilni kiriting.'})
        if data['kind'] == 'online':
            data['address'] = ''
        return data


def approved_centers():
    public_mentors = Q(mentors__approval='approved', mentors__is_paused=False, mentors__user__is_active=True)
    return LearningCenter.objects.filter(approval='approved').annotate(mentor_count=Count('mentors', filter=public_mentors))


def center_row(center):
    return {'id': center.pk, 'name': center.name, 'kind': center.kind, 'city': center.city, 'address': center.address, 'description': center.description, 'logo': logo_url(center), 'mentor_count': center.mentor_count}


class CenterListView(SecureView):
    permission_classes = [AllowAny]

    def get(self, request):
        pager = PageNumberPagination()
        pager.page_size = 12
        return pager.get_paginated_response([center_row(c) for c in pager.paginate_queryset(approved_centers(), request)])


class CenterDetailView(SecureView):
    permission_classes = [AllowAny]

    def get(self, request, pk):
        return Response(center_row(get_object_or_404(approved_centers(), pk=pk)))


def own_center(user):
    """A person belongs to at most one center: the one they own, or else the one they teach in."""
    owned = LearningCenter.objects.filter(owner=user).first()
    if owned:
        return owned, 'owner'
    mentor = MentorProfile.objects.filter(user=user, center__isnull=False).select_related('center').first()
    return (mentor.center, 'member') if mentor else (None, None)


def mine(user):
    center, role = own_center(user)
    if not center:
        return {'role': None, 'center': None}
    data = {'id': center.pk, 'name': center.name, 'kind': center.kind, 'city': center.city, 'address': center.address, 'description': center.description, 'logo': logo_url(center), 'approval': center.approval,
            'members': [{'id': m.user_id, 'full_name': m.user.profile.full_name, 'approval': m.approval, 'share': m.center_share, 'share_offer': m.center_share_offer, 'is_owner': m.user_id == center.owner_id} for m in center.mentors.select_related('user__profile').order_by('user__profile__full_name', 'pk')]}
    if role == 'owner':
        data['invite_code'] = center.invite_code
        data['earned'] = center_earnings(center)
    return {'role': role, 'center': data}


class MyCenterView(SecureView):
    def get(self, request):
        return Response(mine(request.user))

    def post(self, request):
        if request.user.profile.account_type == 'parent':
            raise PermissionDenied('Ota-ona hisobi bilan markaz ochib bo‘lmaydi.')
        data = CenterInput(data=request.data)
        data.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                lock_users([request.user.pk])
                if own_center(request.user)[0]:
                    raise ValidationError({'detail': 'Siz allaqachon markazga bog‘langansiz.'})
                center = data.save(owner=request.user, invite_code=new_code(LearningCenter, 'invite_code'))
                # A mentor who opens a center teaches in it.
                MentorProfile.objects.filter(user=request.user).update(center=center)
        except IntegrityError:
            raise ValidationError({'name': NAME_TAKEN})
        return Response(mine(request.user), status=201)

    def put(self, request):
        try:
            with transaction.atomic():
                lock_users([request.user.pk])
                center = get_object_or_404(LearningCenter, owner=request.user)
                data = CenterInput(center, data=request.data)
                data.is_valid(raise_exception=True)
                # Public details are re-reviewed, like mentor profiles.
                changed = any(getattr(center, key) != value for key, value in data.validated_data.items())
                data.save(**({'approval': 'pending'} if changed else {}))
        except IntegrityError:
            raise ValidationError({'name': NAME_TAKEN})
        return Response(mine(request.user))


class CenterLogoView(SecureView):
    # Like mentor avatars, a logo change does not send the center back to review.
    def post(self, request):
        center = get_object_or_404(LearningCenter, owner=request.user)
        if 'logo' not in request.FILES:
            raise ValidationError({'logo': 'Logo rasmini tanlang.'})
        try:
            logo = prepare_logo(request.FILES['logo'])
        except serializers.ValidationError as exc:
            raise ValidationError({'logo': exc.detail})
        old = center.logo.name
        center.logo.save(logo.name, logo)
        if old:
            center.logo.storage.delete(old)
        return Response(mine(request.user))

    def delete(self, request):
        center = get_object_or_404(LearningCenter, owner=request.user)
        if center.logo:
            center.logo.delete()
        return Response(mine(request.user))


class CenterJoinView(SecureView):
    # Codes can only be brute-forced; share the per-account sign-in limit.
    throttle_classes = [AuthThrottle]

    def post(self, request):
        code = clean_code(request.data.get('code', ''))
        with transaction.atomic():
            lock_users([request.user.pk])
            center = LearningCenter.objects.filter(invite_code=code).first()
            mentor = MentorProfile.objects.filter(user=request.user).first()
            if not center:
                raise ValidationError({'detail': 'Kod noto‘g‘ri yoki yangilangan. Markaz egasidan yangi kod so‘rang.'})
            if not mentor:
                raise ValidationError({'detail': 'Markazga qo‘shilish uchun avval mentor profilini yarating.'})
            if mentor.center_id or LearningCenter.objects.filter(owner=request.user).exclude(pk=center.pk).exists():
                raise ValidationError({'detail': 'Siz allaqachon markaz a’zosisiz. Avval undan chiqing.'})
            mentor.center, mentor.center_share, mentor.center_share_offer = center, 0, None
            mentor.save(update_fields=['center', 'center_share', 'center_share_offer'])
        return Response(mine(request.user), status=201)


class CenterMemberView(SecureView):
    def delete(self, request, pk):
        with transaction.atomic():
            lock_users([request.user.pk])
            # A mentor may leave; the owner may remove any member.
            mentor = get_object_or_404(MentorProfile, Q(user=request.user) | Q(center__owner=request.user), user_id=pk, center__isnull=False)
            if mentor.user_id != request.user.pk:
                # The removed mentor already knows the code; rotate it so they cannot rejoin.
                LearningCenter.objects.filter(pk=mentor.center_id).update(invite_code=new_code(LearningCenter, 'invite_code'))
            mentor.center, mentor.center_share, mentor.center_share_offer = None, 0, None
            mentor.save(update_fields=['center', 'center_share', 'center_share_offer'])
        return Response(status=204)


class CenterShareOfferView(SecureView):
    """The owner proposes a share; it applies only after the mentor accepts."""
    def post(self, request, pk):
        percent = request.data.get('percent')
        if isinstance(percent, bool) or not isinstance(percent, int) or not 0 <= percent <= MAX_CENTER_SHARE:
            raise ValidationError({'percent': f'Ulush 0 dan {MAX_CENTER_SHARE} foizgacha bo‘lishi kerak.'})
        with transaction.atomic():
            lock_users([request.user.pk, pk])
            mentor = get_object_or_404(MentorProfile, user_id=pk, center__owner=request.user)
            if mentor.user_id == request.user.pk:
                raise ValidationError({'detail': 'O‘z darslaringizdan markaz ulushi olinmaydi.'})
            mentor.center_share_offer = percent
            mentor.save(update_fields=['center_share_offer'])
        return Response(mine(request.user))


class CenterShareDecisionView(SecureView):
    def post(self, request, decision):
        if decision not in ('accept', 'reject'):
            raise ValidationError({'detail': 'Noto‘g‘ri amal.'})
        with transaction.atomic():
            lock_users([request.user.pk])
            mentor = get_object_or_404(MentorProfile, user=request.user, center__isnull=False, center_share_offer__isnull=False)
            if decision == 'accept':
                mentor.center_share = mentor.center_share_offer
            mentor.center_share_offer = None
            mentor.save(update_fields=['center_share', 'center_share_offer'])
        return Response(mine(request.user))
