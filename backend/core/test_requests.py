from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from .models import User, Subject, MentorProfile, LearningRequest, MentorOffer, Booking
from . import services


class LearningRequestTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.student = User.objects.create_user('request.student@example.invalid', None)
        cls.other = User.objects.create_user('request.other@example.invalid', None)
        cls.teacher = User.objects.create_user('request.mentor@example.invalid', None)
        cls.teacher2 = User.objects.create_user('request.mentor2@example.invalid', None)
        cls.subject = Subject.objects.create(name='Request test')
        cls.unrelated = Subject.objects.create(name='Other request subject')
        for user in [cls.teacher, cls.teacher2]:
            mentor = MentorProfile.objects.create(user=user, headline='Mentor', bio='Bio', teaching_languages='English', hourly_price=60000, approval='approved')
            mentor.subjects.add(cls.subject)
            from datetime import time
            from .models import AvailabilityRule
            for day in range(7):
                AvailabilityRule.objects.create(mentor=mentor, weekday=day, start_time=time(0), end_time=time(23, 59))

    def setUp(self):
        self.now = timezone.now()
        clock = patch('core.services.timezone.now', return_value=self.now)
        clock.start()
        self.addCleanup(clock.stop)
        self.start = services.candidate_slots(self.teacher.mentor, self.now)[2]
        self.item = LearningRequest.objects.create(student=self.student, subject=self.subject, title='Writing Task 2', description='Help with essay structure', budget=50000)
        self.client = APIClient()
        self.client.force_authenticate(self.student)

    def offer(self, user=None, **changes):
        self.client.force_authenticate(user or self.teacher)
        data = dict(price=45000, message='We can work on your essay.', starts_at=self.start.isoformat())
        data.update(changes)
        return self.client.post(f'/api/requests/{self.item.pk}/offers/', data, format='json')

    def accept(self, offer_id, user=None):
        self.client.force_authenticate(user or self.student)
        return self.client.post(f'/api/requests/{self.item.pk}/offers/{offer_id}/accept/', {}, format='json')

    def test_create_list_offer_accept_and_payment_flow(self):
        result = self.client.post('/api/requests/', {'subject': self.subject.pk, 'title': 'New request', 'description': 'Need help', 'budget': 50000}, format='json')
        self.assertEqual(result.status_code, 201, result.content)
        response = self.offer()
        self.assertEqual(response.status_code, 201, response.content)
        offer_id = response.json()['id']
        self.client.force_authenticate(self.student)
        listing = self.client.get('/api/requests/?scope=mine').json()
        row = next(row for row in listing['results'] if row['id'] == self.item.pk)
        self.assertEqual(row['offer_count'], 1)
        self.assertEqual(len(row['offers']), 1)
        self.assertNotIn('email', row)
        result = self.accept(offer_id)
        self.assertEqual(result.status_code, 201, result.content)
        booking = Booking.objects.get(pk=result.json()['id'])
        self.assertEqual(booking.total_price, Decimal(45000))
        self.assertEqual(booking.platform_fee, Decimal(13500))
        self.assertEqual(booking.mentor_net, Decimal(31500))
        self.assertEqual(booking.commission_rate, Decimal('0.30'))
        self.assertEqual(booking.status, 'pending_payment')
        self.assertEqual(booking.objective, self.item.description)
        self.assertEqual(booking.mentor.mentor.hourly_price, Decimal(60000))
        self.assertEqual(booking.ends_at-booking.starts_at, timedelta(minutes=50))
        self.assertEqual(self.accept(offer_id).json()['id'], booking.pk)
        self.assertEqual(Booking.objects.count(), 1)
        services.submit_payment(booking.pk, self.student, 'Request payment')
        self.assertEqual(services.verify_payment(booking.pk, 'Bank checked').status, 'confirmed')
        self.item.refresh_from_db()
        self.assertEqual(self.item.status, 'matched')

    def test_only_owner_can_accept_or_close(self):
        offer_id = self.offer().json()['id']
        self.assertEqual(self.accept(offer_id, self.other).status_code, 403)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.post(f'/api/requests/{self.item.pk}/close/').status_code, 404)
        self.assertFalse(Booking.objects.exists())

    def test_only_approved_active_matching_mentors_may_offer(self):
        self.assertEqual(self.offer(self.other).status_code, 403)
        for changes in [{'approval': 'pending'}, {'approval': 'rejected'}, {'is_paused': True}]:
            MentorProfile.objects.filter(user=self.teacher).update(**changes)
            self.assertEqual(self.offer().status_code, 403)
            MentorProfile.objects.filter(user=self.teacher).update(approval='approved', is_paused=False)
        self.teacher.mentor.subjects.clear()
        self.assertEqual(self.offer().status_code, 403)
        self.teacher.mentor.subjects.add(self.subject)
        User.objects.filter(pk=self.teacher.pk).update(is_active=False)
        self.assertEqual(self.offer().status_code, 403)

    def test_self_offer_is_forbidden(self):
        self.item.student = self.teacher
        self.item.save()
        self.assertEqual(self.offer().status_code, 403)

    def test_offer_validation_and_upsert(self):
        for changes in [{'price': 29999}, {'price': 50001}, {'price': 60001}, {'message': ''}, {'message': 'x'*1001}, {'starts_at': 'bad'}]:
            self.assertEqual(self.offer(**changes).status_code, 400, changes)
        self.assertEqual(self.offer(starts_at=(self.now+timedelta(hours=2)).isoformat()).status_code, 409)
        first = self.offer().json()
        result = self.offer(price=40000, message='Updated offer')
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json()['id'], first['id'])
        self.assertEqual(MentorOffer.objects.count(), 1)

    def test_close_removes_request_from_feed_and_stops_offers(self):
        self.assertEqual(self.client.post(f'/api/requests/{self.item.pk}/close/').status_code, 200)
        self.assertEqual(self.client.get('/api/requests/').json()['count'], 0)
        self.assertEqual(self.offer().status_code, 409)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(f'/api/requests/{self.item.pk}/').status_code, 404)

    def test_other_bids_are_private_and_count_stays_correct(self):
        first = self.offer().json()['id']
        self.offer(self.teacher2)
        self.client.force_authenticate(self.teacher)
        row = self.client.get(f'/api/requests/{self.item.pk}/').json()
        self.assertEqual(row['offer_count'], 2)
        self.assertEqual([row['id'] for row in row['offers']], [first])
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(f'/api/requests/{self.item.pk}/').json()['offers'], [])
        self.client.force_authenticate(self.student)
        self.assertEqual(len(self.client.get(f'/api/requests/{self.item.pk}/').json()['offers']), 2)

    def test_accepting_one_offer_prevents_second_booking(self):
        first = self.offer().json()['id']
        second = self.offer(self.teacher2).json()['id']
        self.assertEqual(self.accept(first).status_code, 201)
        self.assertEqual(self.accept(second).status_code, 409)
        self.assertEqual(Booking.objects.count(), 1)
        self.assertEqual(self.client.post(f'/api/requests/{self.item.pk}/close/').status_code, 409)
        self.assertEqual(self.offer(self.teacher2).status_code, 409)

    def test_stale_time_or_mentor_rejected_after_offer_does_not_book(self):
        offer_id = self.offer().json()['id']
        MentorProfile.objects.filter(user=self.teacher).update(approval='rejected')
        self.assertEqual(self.accept(offer_id).status_code, 409)
        self.assertFalse(Booking.objects.exists())
        MentorProfile.objects.filter(user=self.teacher).update(approval='approved')
        with patch('core.services.timezone.now', return_value=self.start):
            self.assertEqual(self.accept(offer_id).status_code, 409)
        self.item.refresh_from_db()
        self.assertEqual(self.item.status, 'open')
        self.assertFalse(Booking.objects.exists())

    def test_slot_conflict_rolls_back_acceptance(self):
        offer_id = self.offer().json()['id']
        services.reserve(self.other, self.teacher.pk, self.start, 'Another booking')
        self.assertEqual(self.accept(offer_id).status_code, 409)
        self.assertEqual(Booking.objects.count(), 1)
        self.item.refresh_from_db()
        self.assertEqual(self.item.status, 'open')
        self.assertIsNone(MentorOffer.objects.get(pk=offer_id).booking_id)

    def test_authentication_pagination_and_creation_validation(self):
        for change in [{'budget': 29999}, {'budget': 60001}, {'title': ''}, {'description': ''}, {'subject': 99999}]:
            payload = dict(subject=self.subject.pk, title='Help', description='Details', budget=50000)
            payload.update(change)
            self.assertEqual(self.client.post('/api/requests/', payload, format='json').status_code, 400)
        self.assertEqual(self.client.get('/api/requests/?scope=bad').status_code, 400)
        self.assertEqual(self.client.get('/api/requests/?scope=offered').json()['count'], 0)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get('/api/requests/').status_code, 403)
        self.assertEqual(self.client.post('/api/requests/', {}, format='json').status_code, 403)

    def test_session_requests_require_csrf(self):
        client = APIClient(enforce_csrf_checks=True)
        client.force_login(self.student)
        payload = dict(subject=self.subject.pk, title='CSRF check', description='Need help', budget=40000)
        self.assertEqual(client.post('/api/requests/', payload, format='json').status_code, 403)
        client.get('/api/auth/csrf/')
        token = client.cookies['csrftoken'].value
        self.assertEqual(client.post('/api/requests/', payload, format='json', HTTP_X_CSRFTOKEN=token).status_code, 201)

    def test_request_and_offer_identity_cannot_be_forged(self):
        payload = dict(student=self.other.pk, status='matched', subject=self.subject.pk, title='My request', description='My challenge', budget=40000)
        result = self.client.post('/api/requests/', payload, format='json')
        self.assertEqual(result.status_code, 201)
        item = LearningRequest.objects.get(pk=result.json()['id'])
        self.assertEqual(item.student_id, self.student.pk)
        self.assertEqual(item.status, 'open')
        offer_id = self.offer(booking=9999, mentor=self.teacher2.pk).json()['id']
        offer = MentorOffer.objects.get(pk=offer_id)
        self.assertEqual(offer.mentor.user_id, self.teacher.pk)
        self.assertIsNone(offer.booking_id)
        self.client.force_authenticate(self.student)
        result = self.client.post(f'/api/requests/{item.pk}/offers/{offer_id}/accept/', {}, format='json')
        self.assertEqual(result.status_code, 404)
        self.assertFalse(Booking.objects.exists())

    def test_budget_filters_and_competitor_count(self):
        self.offer()
        self.offer(self.teacher2)
        self.client.force_authenticate(self.teacher)
        result = self.client.get('/api/requests/?scope=offered').json()
        self.assertEqual(result['count'], 1)
        self.assertEqual(result['results'][0]['offer_count'], 2)
        self.assertEqual(len(result['results'][0]['offers']), 1)
        result = self.client.get(f'/api/requests/?subject={self.unrelated.pk}').json()
        self.assertEqual(result['count'], 0)
