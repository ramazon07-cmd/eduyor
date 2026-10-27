from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch
from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient
from .models import User, Booking, LearningCenter, MentorProfile
from .test_rewards import make_mentor
from .tests import NOW, START
from . import services
from .views import public_mentors


class CenterShareTests(TestCase):
    def setUp(self):
        self.owner = make_mentor('owner@example.invalid')
        self.member = make_mentor('member@example.invalid')
        self.student = User.objects.create_user('share-student@example.invalid', None)
        self.center = LearningCenter.objects.create(owner=self.owner, name='Markaz', kind='online', description='Demo', invite_code='ABCD2345', approval='approved')
        MentorProfile.objects.filter(user__in=[self.owner, self.member]).update(center=self.center)
        self.owner_api, self.member_api = APIClient(), APIClient()
        self.owner_api.force_authenticate(self.owner)
        self.member_api.force_authenticate(self.member)

    def reserve(self, mentor):
        with patch('core.services.timezone.now', return_value=NOW):
            return services.reserve(self.student, mentor.pk, START, 'SAT')

    def test_offer_applies_only_after_mentor_accepts(self):
        self.assertEqual(self.owner_api.post(f'/api/centers/members/{self.member.pk}/share/', {'percent': 25}, format='json').status_code, 200)
        b = self.reserve(self.member)
        self.assertEqual((b.commission_rate, b.platform_fee, b.center_fee, b.mentor_net), (Decimal('0.07'), 3500, 0, 46500))
        Booking.objects.all().delete()
        self.assertEqual(self.member_api.post('/api/centers/share/accept/').status_code, 200)
        b = self.reserve(self.member)
        self.assertEqual((b.platform_fee, b.center_fee, b.mentor_net, b.center_id), (3500, 12500, 34000, self.center.pk))

    def test_limits_and_owner_lessons(self):
        for percent in [41, -1, '20', True]:
            self.assertEqual(self.owner_api.post(f'/api/centers/members/{self.member.pk}/share/', {'percent': percent}, format='json').status_code, 400)
        self.assertEqual(self.owner_api.post(f'/api/centers/members/{self.owner.pk}/share/', {'percent': 10}, format='json').status_code, 400)
        # Another owner cannot set shares for this center's mentors.
        stranger = APIClient(); stranger.force_authenticate(make_mentor('stranger@example.invalid'))
        self.assertEqual(stranger.post(f'/api/centers/members/{self.member.pk}/share/', {'percent': 10}, format='json').status_code, 404)
        b = self.reserve(self.owner)
        self.assertEqual((b.platform_fee, b.center_fee, b.mentor_net), (3500, 0, 46500))

    def test_rejecting_and_leaving_reset_the_share(self):
        self.owner_api.post(f'/api/centers/members/{self.member.pk}/share/', {'percent': 30}, format='json')
        self.member_api.post('/api/centers/share/reject/')
        profile = MentorProfile.objects.get(user=self.member)
        self.assertEqual((profile.center_share, profile.center_share_offer), (0, None))
        MentorProfile.objects.filter(user=self.member).update(center_share=30)
        self.member_api.delete(f'/api/centers/members/{self.member.pk}/')
        self.assertEqual(MentorProfile.objects.get(user=self.member).center_share, 0)

    def test_owner_sees_earned_share(self):
        MentorProfile.objects.filter(user=self.member).update(center_share=20)
        b = self.reserve(self.member)
        Booking.objects.filter(pk=b.pk).update(status='completed', payment_status='verified')
        self.assertEqual(self.owner_api.get('/api/centers/mine/').json()['center']['earned'], '10000')


class PenaltyTests(TestCase):
    def setUp(self):
        self.mentor = make_mentor('penalty-mentor@example.invalid')
        self.profile = MentorProfile.objects.get(user=self.mentor)

    def first_lessons(self, count, ended, rating=None, prefix='s'):
        for i in range(count):
            student = User.objects.create_user(f'{prefix}{i}@example.invalid', None)
            start = ended - timedelta(hours=1)
            Booking.objects.create(student=student, mentor=self.mentor, starts_at=start, ends_at=start+timedelta(minutes=50), expires_at=start, objective='First', total_price=50000, commission_rate=Decimal('0.10'), platform_fee=5000, mentor_net=45000, status='completed', payment_status='verified', completed_at=ended, feedback_rating=rating)

    def test_only_unhappy_students_without_follow_up_count(self):
        self.first_lessons(2, NOW - timedelta(days=10))
        self.first_lessons(3, NOW - timedelta(days=10), rating=5, prefix='happy')
        self.first_lessons(3, NOW - timedelta(days=2), prefix='recent')
        self.assertEqual(services.mentor_standing(self.profile, NOW)['level'], 'warning')
        returning = User.objects.get(email='s0@example.invalid')
        Booking.objects.create(student=returning, mentor=self.mentor, starts_at=NOW, ends_at=NOW+timedelta(minutes=50), expires_at=NOW, objective='Again', total_price=50000, platform_fee=5000, mentor_net=45000, status='confirmed', payment_status='verified')
        self.assertEqual(services.mentor_standing(self.profile, NOW)['churned'], 1)

    def test_three_leavers_raise_commission_by_five_points(self):
        self.first_lessons(3, NOW - timedelta(days=10))
        student = User.objects.create_user('new@example.invalid', None)
        with patch('core.services.timezone.now', return_value=NOW):
            b = services.reserve(student, self.mentor.pk, START, 'SAT')
        self.assertEqual((b.commission_rate, b.platform_fee), (Decimal('0.15'), 7500))

    def test_five_leavers_hide_then_three_more_remove(self):
        self.first_lessons(5, NOW - timedelta(days=10))
        with patch('core.management.commands.apply_mentor_penalties.timezone.now', return_value=NOW):
            call_command('apply_mentor_penalties', verbosity=0)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.hidden_until, NOW + timedelta(days=30))
        with patch('core.views.timezone.now', return_value=NOW):
            self.assertFalse(public_mentors().filter(user=self.mentor).exists())
        later = NOW + timedelta(days=20)
        self.first_lessons(3, later - timedelta(days=8), prefix='again')
        with patch('core.management.commands.apply_mentor_penalties.timezone.now', return_value=later):
            call_command('apply_mentor_penalties', verbosity=0)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.approval, 'rejected')
        self.assertEqual(services.mentor_standing(self.profile, later)['level'], 'removed')
