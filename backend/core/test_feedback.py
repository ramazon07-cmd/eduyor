from datetime import timedelta
from unittest.mock import patch

from django.db import IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import Booking, User


class LessonFeedbackTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.student = User.objects.create_user('feedback.student@example.invalid', None)
        cls.mentor = User.objects.create_user('feedback.mentor@example.invalid', None)
        cls.other = User.objects.create_user('feedback.other@example.invalid', None)
        cls.staff = User.objects.create_user('feedback.staff@example.invalid', None, is_staff=True)

    def setUp(self):
        self.now = timezone.now()
        clock = patch('core.services.timezone.now', return_value=self.now)
        clock.start()
        self.addCleanup(clock.stop)
        self.client = APIClient()
        self.client.force_authenticate(self.student)

    def booking(self, **changes):
        data = dict(student=self.student, mentor=self.mentor, starts_at=self.now-timedelta(hours=2),
                    ends_at=self.now-timedelta(minutes=70), expires_at=self.now-timedelta(hours=3),
                    status='completed', payment_status='verified', payout_status='pending',
                    total_price=30000, platform_fee=9000, mentor_net=21000, objective='Feedback test',
                    completed_at=self.now)
        data.update(changes)
        return Booking.objects.create(**data)

    def submit(self, booking, payload):
        return self.client.post(f'/api/bookings/{booking.pk}/feedback/', payload, format='json')

    def test_completion_then_rating_and_optional_comment_are_persisted(self):
        booking = self.booking(status='confirmed', completed_at=None, payout_status='not_eligible')
        response = self.client.post(f'/api/bookings/{booking.pk}/complete/', {}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json()['feedback_rating'])
        response = self.submit(booking, {'rating': 5})
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()['feedback_rating'], 5)
        self.assertEqual(response.json()['feedback_comment'], '')
        self.assertTrue(response.json()['feedback_submitted_at'])
        self.assertEqual(response.json()['payout_status'], 'pending')
        first_timestamp = response.json()['feedback_submitted_at']
        response = self.submit(booking, {'rating': 5, 'comment': '  Tushunarli dars.  '})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['feedback_comment'], 'Tushunarli dars.')
        self.assertEqual(response.json()['feedback_submitted_at'], first_timestamp)
        for endpoint in (f'/api/bookings/{booking.pk}/', '/api/bookings/'):
            result = self.client.get(endpoint).json()
            row = result['results'][0] if 'results' in result else result
            self.assertEqual(row['feedback_rating'], 5)
            self.assertEqual(row['feedback_comment'], 'Tushunarli dars.')

    def test_rating_is_required_and_accepts_only_one_to_five_whole_stars(self):
        booking = self.booking()
        for payload in ({}, {'comment': 'No stars'}, *({'rating': value} for value in (0, 6, -1, 'bad', 4.5, True, None))):
            with self.subTest(payload=payload):
                self.assertEqual(self.submit(booking, payload).status_code, 400)
        booking.refresh_from_db()
        self.assertIsNone(booking.feedback_rating)
        for rating in range(1, 6):
            self.assertEqual(self.submit(self.booking(), {'rating': rating}).status_code, 200)

    def test_only_the_lesson_student_can_rate_even_if_mentor_is_staff(self):
        booking = self.booking()
        for user in (self.mentor, self.other, self.staff):
            with self.subTest(user=user.pk):
                self.client.force_authenticate(user)
                self.assertEqual(self.submit(booking, {'rating': 5}).status_code, 403)
        booking.refresh_from_db()
        self.assertIsNone(booking.feedback_rating)

    def test_incomplete_unpaid_or_not_yet_ended_lessons_cannot_be_rated(self):
        cases = ({'status': 'confirmed'}, {'status': 'pending_payment'}, {'status': 'cancelled'},
                 {'payment_status': 'unpaid'}, {'payment_status': 'refunded'},
                 {'ends_at': self.now+timedelta(minutes=30)})
        for changes in cases:
            with self.subTest(changes=changes):
                booking = self.booking(**changes)
                self.assertEqual(self.submit(booking, {'rating': 4}).status_code, 409)
                booking.refresh_from_db()
                self.assertIsNone(booking.feedback_rating)

    def test_retries_preserve_comment_and_cannot_change_saved_stars(self):
        booking = self.booking()
        self.assertEqual(self.submit(booking, {'rating': 4, 'comment': 'Helpful'}).status_code, 200)
        response = self.submit(booking, {'rating': 4})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['feedback_comment'], 'Helpful')
        self.assertEqual(self.submit(booking, {'rating': 2, 'comment': 'Changed'}).status_code, 409)
        booking.refresh_from_db()
        self.assertEqual(booking.feedback_rating, 4)
        self.assertEqual(booking.feedback_comment, 'Helpful')

    def test_comment_length_limit_and_plain_text_storage(self):
        booking = self.booking()
        self.assertEqual(self.submit(booking, {'rating': 5, 'comment': 'x'*1501}).status_code, 400)
        comment = '<script>alert(1)</script>'
        response = self.submit(booking, {'rating': 5, 'comment': comment})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['feedback_comment'], comment)

    def test_rating_cannot_be_smuggled_through_completion(self):
        booking = self.booking(status='confirmed', completed_at=None)
        response = self.client.post(f'/api/bookings/{booking.pk}/complete/', {'feedback_rating': 5}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json()['feedback_rating'])

    def test_database_enforces_rating_range(self):
        for rating in (0, 6):
            with self.subTest(rating=rating), self.assertRaises(IntegrityError), transaction.atomic():
                self.booking(feedback_rating=rating)
