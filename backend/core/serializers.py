from datetime import timedelta
from io import BytesIO
from uuid import uuid4
from PIL import Image, ImageOps
from django.core.files.base import ContentFile
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from .models import User, Profile, Subject, MentorProfile, AvailabilityRule, BlockedDate, Booking, validate_timezone
from .services import SESSION_DURATION_MINUTES
from .subjects import SUBJECT_LABELS


class RegistrationSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(min_length=8,max_length=128,write_only=True,trim_whitespace=False)
    full_name = serializers.CharField(max_length=120)

    def validate(self,data):
        data['email'] = data['email'].lower()
        if User.objects.filter(email__iexact=data['email']).exists():
            raise serializers.ValidationError({'email':'Bu email allaqachon ro‘yxatdan o‘tgan.'})
        try:
            validate_password(data['password'],User(email=data['email']))
        except DjangoValidationError as exc:
            raise serializers.ValidationError({'password':exc.messages})
        return data


class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = ['full_name','avatar','school','study_level','learning_goals','timezone']

    def validate_avatar(self,file):
        if not file:
            return file
        if file.size > 2*1024*1024:
            raise serializers.ValidationError('Rasm hajmi 2 MB dan oshmasin.')
        try:
            with Image.open(file) as image:
                if image.format not in ['JPEG','PNG','WEBP'] or image.width*image.height > 16_000_000:
                    raise ValueError()
                image.load()
                image = ImageOps.exif_transpose(image).convert('RGB')
                image.thumbnail((600,600))
                out = BytesIO()
                image.save(out,format='JPEG',quality=85)
        except Exception:
            raise serializers.ValidationError('JPEG, PNG yoki WebP rasm yuklang.')
        return ContentFile(out.getvalue(),name=f'{uuid4().hex}.jpg')


class SubjectSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()

    def get_name(self, obj):
        return SUBJECT_LABELS.get(obj.name, obj.name)

    class Meta:
        model = Subject
        fields = ['id','name']


def combined_bio(bio, experience):
    bio, experience = (bio or '').strip(), (experience or '').strip()
    if not experience or experience in bio:
        return bio
    return '\n\n'.join(part for part in [bio, experience] if part)


class PublicMentorSerializer(serializers.ModelSerializer):
    session_duration_minutes = serializers.SerializerMethodField()

    def get_session_duration_minutes(self, obj):
        return SESSION_DURATION_MINUTES

    bio = serializers.SerializerMethodField()

    def get_bio(self, obj):
        return combined_bio(obj.bio, obj.experience)

    id = serializers.IntegerField(source='user_id',read_only=True)
    full_name = serializers.CharField(source='user.profile.full_name',read_only=True)
    avatar = serializers.ImageField(source='user.profile.avatar',read_only=True)
    school = serializers.CharField(source='user.profile.school',read_only=True)
    study_level = serializers.CharField(source='user.profile.study_level',read_only=True)
    timezone = serializers.CharField(source='user.profile.timezone',read_only=True)
    subjects = SubjectSerializer(many=True,read_only=True)

    class Meta:
        model = MentorProfile
        fields = ['id','full_name','avatar','school','study_level','timezone','headline','bio','subjects','teaching_languages','hourly_price','session_duration_minutes']


class MentorSettingsSerializer(serializers.ModelSerializer):
    # Retain the old input for compatibility, but show/write one combined bio.
    experience = serializers.CharField(max_length=1200, required=False, allow_blank=True, write_only=True)

    def validate(self, data):
        data['bio'] = combined_bio(data.get('bio', ''), data.get('experience', ''))
        if len(data['bio']) > 3000:
            raise serializers.ValidationError({'bio': 'Ma’lumot 3000 belgidan oshmasin.'})
        data['experience'] = ''
        return data

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['bio'] = combined_bio(instance.bio, instance.experience)
        return data

    hourly_price = serializers.DecimalField(max_digits=12, decimal_places=0, min_value=30000, max_value=60000, error_messages={'min_value': 'Narx kamida 30 000 so‘m bo‘lishi kerak.', 'max_value': 'Narx 60 000 so‘mdan oshmasligi kerak.'})
    subjects = serializers.PrimaryKeyRelatedField(many=True,queryset=Subject.objects.all(),allow_empty=False)

    class Meta:
        model = MentorProfile
        fields = ['headline','bio','subjects','teaching_languages','experience','hourly_price','is_paused','approval']
        read_only_fields = ['approval']


class RuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = AvailabilityRule
        fields = ['weekday','start_time','end_time']

    def validate(self,data):
        if data['start_time'] >= data['end_time']:
            raise serializers.ValidationError({'end_time':'Tugash vaqti boshlanishdan keyin bo‘lsin; tundan o‘tuvchi vaqt qo‘llanmaydi.'})
        if data['start_time'].second or data['end_time'].second:
            raise serializers.ValidationError('Vaqtni daqiqa aniqligida kiriting.')
        return data


class ScheduleSerializer(serializers.Serializer):
    rules = RuleSerializer(many=True,max_length=35)
    blocked_dates = serializers.ListField(child=serializers.DateField(),max_length=365)

    def validate_rules(self,rules):
        for i,a in enumerate(rules):
            for b in rules[i+1:]:
                if a['weekday'] == b['weekday'] and a['start_time'] < b['end_time'] and a['end_time'] > b['start_time']:
                    raise serializers.ValidationError('Bir kunning vaqt oraliqlari kesishmasin.')
        return rules


class BookingCreateSerializer(serializers.Serializer):
    mentor_id = serializers.IntegerField(min_value=1)
    starts_at = serializers.DateTimeField()
    objective = serializers.CharField(max_length=1500)


class BookingSerializer(serializers.ModelSerializer):
    duration_minutes = serializers.SerializerMethodField()

    def get_duration_minutes(self, booking):
        return (booking.ends_at-booking.starts_at)//timedelta(minutes=1)

    student_name = serializers.CharField(source='student.profile.full_name',read_only=True)
    mentor_name = serializers.CharField(source='mentor.profile.full_name',read_only=True)
    meeting_url = serializers.SerializerMethodField()
    class Meta:
        model = Booking
        fields = ['id','student','mentor','student_name','mentor_name','starts_at','ends_at','duration_minutes','objective','status','expires_at','total_price','commission_rate','platform_fee','mentor_net','currency','payment_status','payment_reference','payout_status','meeting_url','disputed','issue_note','resolution_note','completed_at']
        read_only_fields = fields

    def get_meeting_url(self,b):
        return b.meeting_url if b.payment_status == 'verified' and b.status in ['confirmed','completed'] else ''


class MentorFilterSerializer(serializers.Serializer):
    search = serializers.CharField(max_length=160, required=False, allow_blank=True, default='')
    subject = serializers.IntegerField(min_value=1, max_value=2147483647, required=False)
    language = serializers.ChoiceField(choices=['', 'uz', 'en', 'ru'], required=False, default='', error_messages={'invalid_choice': 'Ta’lim tilini ro‘yxatdan tanlang.'})
    min_price = serializers.DecimalField(max_digits=12, decimal_places=0, min_value=0, required=False)
    max_price = serializers.DecimalField(max_digits=12, decimal_places=0, min_value=0, required=False)
    ordering = serializers.ChoiceField(choices=['name', 'price_asc', 'price_desc'], default='name', required=False, error_messages={'invalid_choice': 'Saralash turini ro‘yxatdan tanlang.'})

    def validate(self, data):
        if data.get('min_price') is not None and data.get('max_price') is not None and data['min_price'] > data['max_price']:
            raise serializers.ValidationError({'max_price': 'Eng yuqori narx eng past narxdan kam bo‘lmasin.'})
        return data


class BookingFilterSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=['learning','teaching'],required=False,error_messages={'invalid_choice':'Darsdagi rolni ro‘yxatdan tanlang.'})
    status = serializers.ChoiceField(choices=[value for value,_ in Booking._meta.get_field('status').choices],required=False,error_messages={'invalid_choice':'Dars holatini ro‘yxatdan tanlang.'})
    date = serializers.DateField(required=False,error_messages={'invalid':'Sanani YYYY-MM-DD shaklida kiriting.'})
