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
    account_type = models.CharField(max_length=10, choices=[('student', 'O‘quvchi'), ('parent', 'Ota-ona')], default='student')
    phone = models.CharField(max_length=20, blank=True)
    # Accounts made outside self sign-up (admin, seeds, pre-existing) count as verified.
    email_verified = models.BooleanField(default=True)
    referral_code = models.CharField(max_length=8, unique=True, null=True, blank=True)
    referred_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='referrals')

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


class DirectoryPublication(models.Model):
    version = models.CharField(max_length=40, primary_key=True)
    published_at = models.DateTimeField(auto_now_add=True)


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
    center = models.ForeignKey('LearningCenter', null=True, blank=True, on_delete=models.SET_NULL, related_name='mentors')
    # Percent of each lesson that goes to the center owner, agreed by both sides.
    center_share = models.PositiveSmallIntegerField(default=0, validators=[MaxValueValidator(40)])
    center_share_offer = models.PositiveSmallIntegerField(null=True, blank=True, validators=[MaxValueValidator(40)])
    hidden_until = models.DateTimeField(null=True, blank=True)
    first_hidden_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [models.CheckConstraint(condition=models.Q(hourly_price__gte=30000, hourly_price__lte=60000),name='mentor_price_range'),models.CheckConstraint(condition=models.Q(center_share__lte=40),name='center_share_max_40')]

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
    commission_rate = models.DecimalField(max_digits=5,decimal_places=4,default=Decimal('0.10'))
    platform_fee = models.DecimalField(max_digits=12,decimal_places=0)
    center = models.ForeignKey('LearningCenter',null=True,blank=True,on_delete=models.SET_NULL,related_name='bookings')
    center_fee = models.DecimalField(max_digits=12,decimal_places=0,default=0)
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
    feedback_rating = models.PositiveSmallIntegerField(null=True, blank=True, validators=[MinValueValidator(1), MaxValueValidator(5)])
    feedback_comment = models.TextField(max_length=1500, blank=True)
    feedback_submitted_at = models.DateTimeField(null=True, blank=True)
    meeting_url = models.URLField(blank=True)
    disputed = models.BooleanField(default=False)
    paid_with_tokens = models.BooleanField(default=False)
    issue_note = models.TextField(max_length=1500,blank=True)
    resolution_note = models.TextField(max_length=1500,blank=True)
    SNAPSHOT = ('student_id','mentor_id','starts_at','ends_at','total_price','commission_rate','platform_fee','mentor_net','currency','expires_at','paid_with_tokens','center_id','center_fee')

    class Meta:
        ordering = ['-starts_at']
        indexes = [models.Index(fields=['mentor','starts_at','ends_at']),models.Index(fields=['student','starts_at','ends_at']),models.Index(fields=['status','expires_at'])]
        constraints = [models.CheckConstraint(condition=~models.Q(student=models.F('mentor')),name='no_self_booking'),models.CheckConstraint(condition=models.Q(ends_at__gt=models.F('starts_at')),name='positive_booking_duration'),models.CheckConstraint(condition=models.Q(total_price=models.F('platform_fee')+models.F('center_fee')+models.F('mentor_net')),name='financial_balance'),models.CheckConstraint(condition=models.Q(feedback_rating__isnull=True) | models.Q(feedback_rating__gte=1, feedback_rating__lte=5), name='booking_feedback_rating_range')]

    def save(self,*args,**kwargs):
        if self.pk:
            old = Booking.objects.filter(pk=self.pk).values(*self.SNAPSHOT).first()
            if old and any(old[k] != getattr(self,k) for k in self.SNAPSHOT):
                raise ValidationError('Booking snapshots cannot be changed.')
        return super().save(*args,**kwargs)

    def __str__(self):
        return f'#{self.pk} · {self.starts_at:%Y-%m-%d %H:%M} · {self.status}'

class LearningRequest(models.Model):
    student = models.ForeignKey(User, on_delete=models.PROTECT, related_name='learning_requests')
    subject = models.ForeignKey(Subject, on_delete=models.PROTECT)
    title = models.CharField(max_length=140)
    description = models.TextField(max_length=1500)
    budget = models.DecimalField(max_digits=12, decimal_places=0, validators=[MinValueValidator(30000), MaxValueValidator(60000)])
    status = models.CharField(max_length=10, choices=[('open', 'open'), ('matched', 'matched'), ('closed', 'closed')], default='open')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at', '-pk']
        indexes = [models.Index(fields=['status', '-created_at'])]
        constraints = [models.CheckConstraint(condition=models.Q(budget__gte=30000, budget__lte=60000), name='request_budget_range')]


class MentorOffer(models.Model):
    request = models.ForeignKey(LearningRequest, on_delete=models.CASCADE, related_name='offers')
    mentor = models.ForeignKey(MentorProfile, on_delete=models.PROTECT, related_name='request_offers')
    price = models.DecimalField(max_digits=12, decimal_places=0, validators=[MinValueValidator(30000), MaxValueValidator(60000)])
    message = models.TextField(max_length=1000)
    starts_at = models.DateTimeField()
    booking = models.OneToOneField(Booking, null=True, blank=True, on_delete=models.PROTECT, related_name='request_offer')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at', 'pk']
        constraints = [models.UniqueConstraint(fields=['request', 'mentor'], name='one_offer_per_mentor'), models.CheckConstraint(condition=models.Q(price__gte=30000, price__lte=60000), name='offer_price_range')]


# Private payment receipts
from .receipt_models import PaymentReceipt


class Assignment(models.Model):
    mentor = models.ForeignKey(User, on_delete=models.PROTECT, related_name='assigned_tasks')
    student = models.ForeignKey(User, on_delete=models.PROTECT, related_name='learning_tasks')
    title = models.CharField(max_length=160)
    instructions = models.TextField(max_length=6000)
    kind = models.CharField(max_length=12, choices=[('homework', 'Homework'), ('test', 'Test')])
    deadline = models.DateTimeField()
    questions = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['deadline', '-pk']
        indexes = [models.Index(fields=['mentor', 'deadline', '-id'], name='assignment_mentor_deadline'), models.Index(fields=['student', 'deadline', '-id'], name='assignment_student_deadline')]
        constraints = [
            models.CheckConstraint(condition=~models.Q(student=models.F('mentor')), name='assignment_no_self'),
        ]


class Submission(models.Model):
    assignment = models.OneToOneField(Assignment, on_delete=models.CASCADE, related_name='submission')
    answer = models.TextField(max_length=12000, blank=True)
    answers = models.JSONField(default=list, blank=True)
    feedback = models.TextField(max_length=3000, blank=True)
    submitted_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)


class FamilyLink(models.Model):
    """A parent's invite code. The child who redeems it consents to share learning progress."""
    parent = models.ForeignKey(User, on_delete=models.CASCADE, related_name='child_links')
    child = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True, related_name='parent_links')
    code = models.CharField(max_length=8, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    linked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['parent', 'child'], name='family_link_unique'),
            models.UniqueConstraint(fields=['parent'], condition=models.Q(child__isnull=True), name='family_one_open_invite'),
            models.CheckConstraint(condition=~models.Q(child=models.F('parent')), name='family_no_self_link'),
        ]


class LearningCenter(models.Model):
    """A brand that groups mentors. The owner takes an agreed share of each member lesson."""
    owner = models.OneToOneField(User, on_delete=models.CASCADE, related_name='owned_center')
    name = models.CharField(max_length=120)
    kind = models.CharField(max_length=8, choices=[('online', 'Onlayn'), ('offline', 'Offline')])
    description = models.TextField(max_length=2000)
    city = models.CharField(max_length=80, blank=True)
    address = models.CharField(max_length=200, blank=True)
    logo = models.ImageField(upload_to='centers/%Y/%m/', blank=True)
    approval = models.CharField(max_length=12, choices=[('pending', 'Kutilmoqda'), ('approved', 'Tasdiqlangan'), ('rejected', 'Rad etilgan')], default='pending')
    invite_code = models.CharField(max_length=8, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name', 'pk']
        constraints = [models.UniqueConstraint(Lower('name'), name='center_name_case_unique')]

    def __str__(self):
        return self.name


class LearningRateLimit(models.Model):
    """Two bounded quota rows per user, shared by all application workers."""
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    bucket = models.CharField(max_length=5, choices=[('read', 'Read'), ('write', 'Write')])
    window_started_at = models.DateTimeField()
    requests = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['user', 'bucket'], name='learning_quota_user_bucket')]


class TokenEntry(models.Model):
    """Append-only token ledger; a user's balance is the sum of their entries."""
    user = models.ForeignKey(User, on_delete=models.PROTECT, related_name='token_entries')
    amount = models.IntegerField()
    reason = models.CharField(max_length=10, choices=[('referral', 'referral'), ('lesson', 'lesson'), ('refund', 'refund')])
    booking = models.ForeignKey(Booking, null=True, blank=True, on_delete=models.PROTECT, related_name='token_entries')
    referee = models.ForeignKey(User, null=True, blank=True, on_delete=models.PROTECT, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=['user', 'reason', 'created_at'])]
        constraints = [
            models.UniqueConstraint(fields=['referee'], condition=models.Q(reason='referral'), name='one_reward_per_referee'),
            models.UniqueConstraint(fields=['booking', 'reason'], condition=models.Q(reason__in=['lesson', 'refund']), name='one_token_move_per_booking'),
        ]


class EmailCode(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='email_code')
    code_hash = models.CharField(max_length=128)
    sent_at = models.DateTimeField()
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
