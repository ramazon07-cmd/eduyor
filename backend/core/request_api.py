"""Student requests and mentor offers. Lock users before request rows, like bookings."""
from django.db import transaction
from django.db.models import Count, Prefetch
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from .models import LearningRequest, MentorOffer, MentorProfile, Subject
from .serializers import PublicMentorSerializer, SubjectSerializer, BookingSerializer
from .views import SecureView
from . import services
from .errors import Conflict


class RequestInput(serializers.ModelSerializer):
    subject = serializers.PrimaryKeyRelatedField(queryset=Subject.objects.all())
    budget = serializers.DecimalField(max_digits=12, decimal_places=0, min_value=30000, max_value=60000)

    class Meta:
        model = LearningRequest
        fields = ['title', 'description', 'subject', 'budget']


class OfferInput(serializers.Serializer):
    price = serializers.DecimalField(max_digits=12, decimal_places=0, min_value=30000, max_value=60000)
    message = serializers.CharField(max_length=1000)
    starts_at = serializers.DateTimeField()


class RequestFilters(serializers.Serializer):
    scope = serializers.ChoiceField(choices=['open', 'mine', 'offered'], default='open')
    subject = serializers.PrimaryKeyRelatedField(queryset=Subject.objects.all(), required=False)


class OfferOutput(serializers.ModelSerializer):
    mentor = PublicMentorSerializer(read_only=True)
    class Meta:
        model = MentorOffer
        fields = ['id', 'mentor', 'price', 'message', 'starts_at', 'booking', 'created_at']


class RequestOutput(serializers.ModelSerializer):
    subject = SubjectSerializer(read_only=True)
    student_name = serializers.CharField(source='student.profile.full_name', read_only=True)
    offer_count = serializers.IntegerField(read_only=True)
    offers = serializers.SerializerMethodField()
    is_owner = serializers.SerializerMethodField()

    def get_is_owner(self, obj):
        return self.context['user'].pk == obj.student_id

    def get_offers(self, obj):
        # Other mentors cannot see competitors' offers or contact information.
        offers = obj.visible_offers
        return OfferOutput(offers, many=True, context=self.context).data

    class Meta:
        model = LearningRequest
        fields = ['id', 'student_name', 'is_owner', 'title', 'description', 'subject', 'budget', 'status', 'created_at', 'offer_count', 'offers']


def requests_for(user):
    offers = MentorOffer.objects.select_related('mentor__user__profile').prefetch_related('mentor__subjects')
    # Prefetch owner-visible offers separately without exposing other bids.
    from django.db.models import Q
    offers = offers.filter(Q(request__student=user) | Q(mentor__user=user))
    return LearningRequest.objects.select_related('student__profile', 'subject').annotate(offer_count=Count('offers', distinct=True)).prefetch_related(Prefetch('offers', queryset=offers, to_attr='visible_offers'))


def visible_request(user, pk):
    from django.db.models import Q
    return get_object_or_404(requests_for(user).filter(Q(status='open') | Q(student=user) | Q(offers__mentor__user=user)).distinct(), pk=pk)


class RequestWriteThrottle(UserRateThrottle):
    rate = '40/hour'
    scope = 'request_write'

    def allow_request(self, request, view):
        return request.method in ['GET', 'HEAD', 'OPTIONS'] or super().allow_request(request, view)


class RequestListView(SecureView):
    throttle_classes = [RequestWriteThrottle]

    def get(self, request):
        filters = RequestFilters(data=request.query_params)
        filters.is_valid(raise_exception=True)
        data = filters.validated_data
        qs = requests_for(request.user)
        if data['scope'] == 'mine':
            qs = qs.filter(student=request.user)
        elif data['scope'] == 'offered':
            qs = qs.filter(offers__mentor__user=request.user)
        else:
            qs = qs.filter(status='open')
        if data.get('subject'):
            qs = qs.filter(subject=data['subject'])
        pager = PageNumberPagination()
        pager.page_size = 20
        page = pager.paginate_queryset(qs.distinct().order_by('-created_at', '-pk'), request)
        return pager.get_paginated_response(RequestOutput(page, many=True, context={'user': request.user, 'request': request}).data)

    def post(self, request):
        data = RequestInput(data=request.data)
        data.is_valid(raise_exception=True)
        item = data.save(student=request.user)
        return Response(RequestOutput(visible_request(request.user, item.pk), context={'user': request.user, 'request': request}).data, status=201)


class RequestDetailView(SecureView):
    def get(self, request, pk):
        return Response(RequestOutput(visible_request(request.user, pk), context={'user': request.user, 'request': request}).data)


class RequestCloseView(SecureView):
    throttle_classes = [RequestWriteThrottle]

    @transaction.atomic
    def post(self, request, pk):
        services.lock_users([request.user.pk])
        item = get_object_or_404(LearningRequest.objects.select_for_update(), pk=pk, student=request.user)
        if item.status == 'matched':
            raise Conflict('Tanlangan taklif bor. Dars tafsilotlarini oching.')
        item.status = 'closed'
        item.save(update_fields=['status'])
        return Response({'status': item.status})


class RequestOfferView(SecureView):
    throttle_classes = [RequestWriteThrottle]

    @transaction.atomic
    def post(self, request, pk):
        data = OfferInput(data=request.data)
        data.is_valid(raise_exception=True)
        identity = get_object_or_404(LearningRequest.objects.only('student_id'), pk=pk)
        services.lock_users([request.user.pk, identity.student_id])
        item = get_object_or_404(LearningRequest.objects.select_for_update(), pk=pk)
        mentor = MentorProfile.objects.select_related('user__profile').filter(user=request.user, approval='approved', is_paused=False, user__is_active=True).first()
        if not mentor or not mentor.subjects.filter(pk=item.subject_id).exists():
            raise PermissionDenied('Faqat shu yo‘nalishdagi tasdiqlangan mentor taklif yubora oladi.')
        if item.student_id == request.user.pk:
            raise PermissionDenied('O‘z so‘rovingizga taklif yubora olmaysiz.')
        if item.status != 'open':
            raise Conflict('So‘rov yopilgan yoki mentor tanlangan.')
        values = data.validated_data
        if values['price'] > item.budget:
            raise serializers.ValidationError({'price': 'Taklif narxi budjetdan oshmasin.'})
        if values['starts_at'] not in services.available_slots(mentor, item.student):
            raise Conflict('Bu vaqt mavjud emas. Boshqa vaqt tanlang.')
        offer, created = MentorOffer.objects.update_or_create(request=item, mentor=mentor, defaults=values)
        return Response(OfferOutput(offer, context={'request': request}).data, status=201 if created else 200)


class OfferAcceptView(SecureView):
    throttle_classes = [RequestWriteThrottle]

    @transaction.atomic
    def post(self, request, pk, offer_id):
        identity = get_object_or_404(MentorOffer.objects.select_related('request', 'mentor'), pk=offer_id, request_id=pk)
        if identity.request.student_id != request.user.pk:
            raise PermissionDenied('Taklifni faqat so‘rov egasi tanlaydi.')
        services.lock_users([request.user.pk, identity.mentor.user_id])
        item = LearningRequest.objects.select_for_update().get(pk=pk)
        offer = MentorOffer.objects.select_for_update().select_related('mentor').get(pk=offer_id)
        if offer.booking_id:
            return Response(BookingSerializer(services.refresh_booking(offer.booking_id)).data)
        if item.status != 'open':
            raise Conflict('So‘rov yopilgan yoki mentor tanlangan.')
        if offer.price > item.budget or not offer.mentor.subjects.filter(pk=item.subject_id).exists():
            raise Conflict('Taklif endi mos emas.')
        booking = services.reserve(request.user, offer.mentor.user_id, offer.starts_at, item.description, agreed_price=offer.price)
        offer.booking = booking
        offer.save(update_fields=['booking'])
        item.status = 'matched'
        item.save(update_fields=['status'])
        return Response(BookingSerializer(booking).data, status=201)
