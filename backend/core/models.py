from decimal import Decimal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from django.db import models
from django.db.models.functions import Lower
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db.models.signals import post_save
from django.dispatch import receiver


def validate_timezone(value):
    try:
        ZoneInfo(value)
    except (ZoneInfoNotFoundError, ValueError):
        raise ValidationError('IANA vaqt zonasini kiriting, masalan Asia/Tashkent.')


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra):
        user = self.model(email=self.normalize_email(email).lower(), **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra):
        extra.update(is_staff=True, is_superuser=True)
        return self.create_user(email, password, **extra)


class User(AbstractUser):
    username = None
    email = models.EmailField(unique=True)
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []
    objects = UserManager()

    class Meta:
        constraints = [models.UniqueConstraint(Lower('email'), name='user_email_case_unique')]


class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    full_name = models.CharField(max_length=120)
    avatar = models.ImageField(upload_to='avatars/%Y/%m/', blank=True)
    school = models.CharField(max_length=160, blank=True)
    study_level = models.CharField(max_length=80, blank=True)
    learning_goals = models.TextField(max_length=1500, blank=True)
    timezone = models.CharField(max_length=64, default='Asia/Tashkent', validators=[validate_timezone])

    def __str__(self):
        return self.full_name or self.user.email


@receiver(post_save, sender=User)
def ensure_profile(sender, instance, created, **kwargs):
    if created:
        Profile.objects.create(user=instance, full_name=instance.first_name)


class Subject(models.Model):
    name = models.CharField(max_length=80, unique=True)

    def __str__(self):
        return self.name


class MentorProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='mentor')
    headline = models.CharField(max_length=140)
    bio = models.TextField(max_length=3000)
    subjects = models.ManyToManyField(Subject)
    teaching_languages = models.CharField(max_length=160)
    experience = models.TextField(max_length=1200, blank=True)
    hourly_price = models.DecimalField(max_digits=12, decimal_places=0, validators=[MinValueValidator(Decimal('30000')), MaxValueValidator(Decimal('60000'))])
    approval = models.CharField(max_length=12, choices=[('pending','Kutilmoqda'),('approved','Tasdiqlangan'),('rejected','Rad etilgan')], default='pending')
    is_paused = models.BooleanField(default=False)

    class Meta:
        constraints = [models.CheckConstraint(condition=models.Q(hourly_price__gte=30000, hourly_price__lte=60000),name='mentor_price_range')]

    def __str__(self):
        return str(self.user.profile)


class AvailabilityRule(models.Model):
    mentor = models.ForeignKey(MentorProfile,on_delete=models.CASCADE,related_name='availability')
    weekday = models.PositiveSmallIntegerField(validators=[MaxValueValidator(6)])
    start_time = models.TimeField()
    end_time = models.TimeField()

    class Meta:
        ordering = ['weekday','start_time']
        constraints = [models.CheckConstraint(condition=models.Q(start_time__lt=models.F('end_time')),name='valid_window'),models.CheckConstraint(condition=models.Q(weekday__lte=6),name='valid_weekday')]

    def clean(self):
        if self.start_time >= self.end_time:
            raise ValidationError('Boshlanish vaqti tugash vaqtidan oldin bo‘lishi kerak.')
        if AvailabilityRule.objects.filter(mentor_id=self.mentor_id,weekday=self.weekday,start_time__lt=self.end_time,end_time__gt=self.start_time).exclude(pk=self.pk).exists():
            raise ValidationError('Vaqt oralig‘i boshqa oraliq bilan kesishadi.')


class BlockedDate(models.Model):
    mentor = models.ForeignKey(MentorProfile,on_delete=models.CASCADE,related_name='blocked_dates')
    date = models.DateField()

    class Meta:
        constraints = [models.UniqueConstraint(fields=['mentor','date'],name='unique_blocked_date')]
        ordering = ['date']


class Booking(models.Model):
    student = models.ForeignKey(User,on_delete=models.PROTECT,related_name='learning_bookings')
    mentor = models.ForeignKey(User,on_delete=models.PROTECT,related_name='teaching_bookings')
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    objective = models.TextField(max_length=1500)
    status = models.CharField(max_length=20,choices=[(s,s) for s in ['pending_payment','confirmed','completed','cancelled','expired']],default='pending_payment')
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    total_price = models.DecimalField(max_digits=12,decimal_places=0)
    commission_rate = models.DecimalField(max_digits=3,decimal_places=2,default=Decimal('0.20'))
    platform_fee = models.DecimalField(max_digits=12,decimal_places=0)
    mentor_net = models.DecimalField(max_digits=12,decimal_places=0)
    currency = models.CharField(max_length=3,default='UZS')
    payment_status = models.CharField(max_length=20,choices=[(s,s) for s in ['unpaid','submitted','verified','refund_required','refunded']],default='unpaid')
    payment_reference = models.CharField(max_length=160,blank=True)
    receipt_reference = models.CharField(max_length=160,blank=True)
    payment_verified_at = models.DateTimeField(null=True,blank=True)
    payout_status = models.CharField(max_length=16,choices=[(s,s) for s in ['not_eligible','pending','paid']],default='not_eligible')
    payout_reference = models.CharField(max_length=160,blank=True)
    paid_at = models.DateTimeField(null=True,blank=True)
    refund_reference = models.CharField(max_length=160,blank=True)
    refunded_at = models.DateTimeField(null=True,blank=True)
    completed_at = models.DateTimeField(null=True,blank=True)
    meeting_url = models.URLField(blank=True)
    disputed = models.BooleanField(default=False)
    issue_note = models.TextField(max_length=1500,blank=True)
    resolution_note = models.TextField(max_length=1500,blank=True)
    SNAPSHOT = ('student_id','mentor_id','starts_at','ends_at','total_price','commission_rate','platform_fee','mentor_net','currency','expires_at')

    class Meta:
        ordering = ['-starts_at']
        indexes = [models.Index(fields=['mentor','starts_at','ends_at']),models.Index(fields=['student','starts_at','ends_at']),models.Index(fields=['status','expires_at'])]
        constraints = [models.CheckConstraint(condition=~models.Q(student=models.F('mentor')),name='no_self_booking'),models.CheckConstraint(condition=models.Q(ends_at__gt=models.F('starts_at')),name='positive_booking_duration'),models.CheckConstraint(condition=models.Q(total_price=models.F('platform_fee')+models.F('mentor_net')),name='financial_balance')]

    def save(self,*args,**kwargs):
        if self.pk:
            old = Booking.objects.filter(pk=self.pk).values(*self.SNAPSHOT).first()
            if old and any(old[k] != getattr(self,k) for k in self.SNAPSHOT):
                raise ValidationError('Booking snapshots cannot be changed.')
        return super().save(*args,**kwargs)

    def __str__(self):
        return f'#{self.pk} · {self.starts_at:%Y-%m-%d %H:%M} · {self.status}'

# Private payment receipts
from .receipt_models import PaymentReceipt
