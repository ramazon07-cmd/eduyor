import re
from datetime import time, timedelta
from decimal import Decimal
from unittest.mock import patch
from django.core import mail
from django.test import TestCase
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient
from .models import User, Subject, MentorProfile, AvailabilityRule, Booking, TokenEntry, Profile
from .tests import NOW, START
from . import services


def make_mentor(email):
    user = User.objects.create_user(email, None)
    profile = MentorProfile.objects.create(user=user, headline='SAT', bio='Demo', experience='Demo', teaching_languages='O‘zbekcha', hourly_price=50000, approval='approved')
    profile.subjects.add(Subject.objects.get_or_create(name='SAT')[0])
    for day in range(7):
        AvailabilityRule.objects.create(mentor=profile, weekday=day, start_time=time(0), end_time=time(23, 59))
    return user


def finished(student, mentor, start):
    return Booking.objects.create(student=student, mentor=mentor, starts_at=start, ends_at=start+timedelta(minutes=50), expires_at=start, objective='Past', total_price=50000, commission_rate=Decimal('0.10'), platform_fee=5000, mentor_net=45000, status='completed', payment_status='verified')


class CommissionTests(TestCase):
    def test_rate_falls_after_35_lessons_and_stops_at_3_percent(self):
        for lessons, rate in [(0, '0.10'), (35, '0.10'), (36, '0.098'), (50, '0.07'), (70, '0.03'), (500, '0.03')]:
            self.assertEqual(services.commission_rate(lessons), Decimal(rate), lessons)

    def test_reservation_uses_mentors_successful_lessons(self):
        student = User.objects.create_user('rate-student@example.invalid', None)
        mentor = make_mentor('rate-mentor@example.invalid')
        for i in range(40):
            finished(student, mentor, NOW - timedelta(days=60, hours=i))
        Booking.objects.filter(pk=Booking.objects.first().pk).update(disputed=True)
        with patch('core.services.timezone.now', return_value=NOW):
            b = services.reserve(student, mentor.pk, START, 'SAT')
        # 39 undisputed lessons: 10% - 4 * 0.2% = 9.2%
        self.assertEqual((b.commission_rate, b.platform_fee, b.mentor_net), (Decimal('0.092'), 4600, 45400))


class EmailCodeTests(TestCase):
    def register(self, **extra):
        client = APIClient()
        response = client.post('/api/auth/register/', {'email': 'new@example.invalid', 'password': 'Strong-pass-2026', 'full_name': 'New Student', **extra}, format='json')
        self.assertEqual(response.status_code, 201, response.content)
        return client, User.objects.get(email='new@example.invalid')

    def code(self):
        return re.search(r'\d{6}', mail.outbox[-1].body).group()

    def test_signup_sends_code_and_blocks_booking_until_verified(self):
        client, user = self.register(phone='+998 90 123 45 67')
        self.assertFalse(user.profile.email_verified)
        self.assertEqual(user.profile.phone, '+998 90 123 45 67')
        self.assertEqual(len(mail.outbox), 1)
        mentor = make_mentor('verify-mentor@example.invalid')
        with self.assertRaises(ValidationError):
            services.reserve(user, mentor.pk, START, 'SAT')
        response = client.post('/api/auth/verify-email/', {'code': self.code()}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['profile']['email_verified'])

    def test_wrong_codes_run_out_and_resend_waits_a_minute(self):
        client, user = self.register()
        for _ in range(5):
            self.assertEqual(client.post('/api/auth/verify-email/', {'code': '000000' if self.code() != '000000' else '111111'}, format='json').status_code, 400)
        self.assertEqual(client.post('/api/auth/verify-email/', {'code': self.code()}, format='json').status_code, 400)
        self.assertEqual(client.post('/api/auth/verify-email/resend/').status_code, 409)
        with patch('core.email_codes.timezone.now', return_value=user.email_code.sent_at + timedelta(minutes=2)):
            self.assertEqual(client.post('/api/auth/verify-email/resend/').status_code, 200)
            self.assertEqual(client.post('/api/auth/verify-email/', {'code': self.code()}, format='json').status_code, 200)

    def test_profile_cannot_mark_itself_verified(self):
        client, user = self.register()
        client.patch('/api/me/', {'email_verified': True}, format='json')
        user.profile.refresh_from_db()
        self.assertFalse(user.profile.email_verified)


class ReferralTokenTests(TestCase):
    def setUp(self):
        self.referrer = User.objects.create_user('referrer@example.invalid', None)
        self.mentor = make_mentor('token-mentor@example.invalid')
        self.client = APIClient()
        self.client.force_authenticate(self.referrer)
        self.code = self.client.get('/api/referrals/').json()['code']

    def invite(self, email):
        response = APIClient().post('/api/auth/register/', {'email': email, 'password': 'Strong-pass-2026', 'full_name': 'Friend', 'ref': self.code}, format='json')
        self.assertEqual(response.status_code, 201, response.content)
        return User.objects.get(email=email)

    def complete_lesson(self, student, mentor, start):
        b = Booking.objects.create(student=student, mentor=mentor, starts_at=start, ends_at=start+timedelta(minutes=50), expires_at=start, objective='Lesson', total_price=50000, commission_rate=Decimal('0.10'), platform_fee=5000, mentor_net=45000, status='confirmed', payment_status='verified')
        with patch('core.services.timezone.now', return_value=start+timedelta(hours=1)):
            return services.complete(b.pk, student)

    def test_token_only_after_first_paid_lesson_once(self):
        friend = self.invite('friend@example.invalid')
        self.assertEqual(friend.profile.referred_by, self.referrer)
        self.assertEqual(services.token_balance(self.referrer.pk), 0)
        self.complete_lesson(friend, self.mentor, NOW - timedelta(days=3))
        self.complete_lesson(friend, self.mentor, NOW - timedelta(days=2))
        self.assertEqual(services.token_balance(self.referrer.pk), 1)

    def test_referrer_teaching_their_own_invitee_earns_nothing(self):
        friend = self.invite('friend@example.invalid')
        self.complete_lesson(friend, self.referrer, NOW - timedelta(days=3))
        self.assertEqual(services.token_balance(self.referrer.pk), 0)

    def test_monthly_referral_cap(self):
        start = NOW.replace(day=1, hour=0) + timedelta(hours=1)
        for i in range(11):
            self.complete_lesson(self.invite(f'f{i}@example.invalid'), self.mentor, start + timedelta(hours=i))
        self.assertEqual(services.token_balance(self.referrer.pk), 10)

    def test_ten_tokens_buy_one_lesson_a_month_and_cancel_returns_them(self):
        Profile.objects.filter(user=self.referrer).update(email_verified=True)
        TokenEntry.objects.bulk_create([TokenEntry(user=self.referrer, amount=1, reason='referral', referee=User.objects.create_user(f'r{i}@example.invalid', None)) for i in range(20)])
        with patch('core.services.timezone.now', return_value=NOW):
            b = services.reserve(self.referrer, self.mentor.pk, START, 'SAT', use_tokens=True)
            self.assertEqual((b.status, b.payment_status, b.paid_with_tokens, b.mentor_net), ('confirmed', 'verified', True, 45000))
            self.assertEqual(services.token_balance(self.referrer.pk), 10)
            with self.assertRaises(ValidationError):
                services.reserve(self.referrer, self.mentor.pk, START + timedelta(hours=2), 'SAT', use_tokens=True)
        ops = User.objects.create_user('ops@example.invalid', None, is_staff=True)
        with patch('core.services.timezone.now', return_value=NOW):
            b = services.cancel(b.pk, ops)
        self.assertEqual((b.status, b.payment_status), ('cancelled', 'refunded'))
        self.assertEqual(services.token_balance(self.referrer.pk), 20)

    def test_not_enough_tokens(self):
        with patch('core.services.timezone.now', return_value=NOW), self.assertRaises(ValidationError):
            services.reserve(self.referrer, self.mentor.pk, START, 'SAT', use_tokens=True)
