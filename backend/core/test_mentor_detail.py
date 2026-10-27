from datetime import time, timedelta

from django.test import TestCase
from django.utils import timezone

from .models import AvailabilityRule, Booking, MentorProfile, User


class MentorDetailStatsTests(TestCase):
    def test_profile_stats_come_from_real_lessons_and_schedule(self):
        mentor = User.objects.create_user('detail.mentor@example.invalid', None)
        student = User.objects.create_user('detail.student@example.invalid', None)
        profile = MentorProfile.objects.create(user=mentor, headline='h', bio='b', teaching_languages='uz', hourly_price=40000, approval='approved')
        AvailabilityRule.objects.create(mentor=profile, weekday=4, start_time=time(9), end_time=time(12))
        AvailabilityRule.objects.create(mentor=profile, weekday=1, start_time=time(9), end_time=time(12))
        now = timezone.now()
        for rating, status in [(5, 'completed'), (4, 'completed'), (None, 'cancelled')]:
            Booking.objects.create(student=student, mentor=mentor, starts_at=now - timedelta(hours=3), ends_at=now - timedelta(hours=2),
                                   expires_at=now - timedelta(hours=4), status=status, total_price=30000, platform_fee=9000,
                                   mentor_net=21000, objective='x', feedback_rating=rating)
        data = self.client.get(f'/api/mentors/{mentor.pk}/').json()
        self.assertEqual(data['lessons_completed'], 2)
        self.assertEqual(data['rating_average'], 4.5)
        self.assertEqual(data['rating_count'], 2)
        self.assertEqual(data['weekdays'], [1, 4])
        self.assertEqual(data['member_since'], mentor.date_joined.year)
