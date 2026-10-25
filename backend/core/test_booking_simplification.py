from datetime import timedelta
from django.test import TestCase
from rest_framework.exceptions import PermissionDenied
from . import tests as baseline
from .tests import NOW, START
from .models import Booking
from . import services


class SimplifiedBookingTests(TestCase):
    setUp = baseline.BookingTests.setUp
    reserve = baseline.BookingTests.reserve
    confirm = baseline.BookingTests.confirm

    def test_no_slots_without_published_schedule(self):
        self.b.mentor.availability.all().delete()
        result = self.client.get(f'/api/mentors/{self.b.pk}/slots/').json()
        self.assertEqual(result['slots'], [])
        self.a.mentor.availability.all().delete()
        self.assertFalse(self.client.get('/api/me/').json()['mentor_listing']['has_availability'])

    def test_student_cannot_choose_outside_published_hours(self):
        from .errors import Conflict
        with self.assertRaises(Conflict):
            self.reserve(start=START-timedelta(hours=10))
        booking = self.reserve()
        self.assertNotIn(booking.starts_at, services.available_slots(self.b.mentor, self.c, now=NOW))
        with self.assertRaises(Conflict):
            self.reserve(student=self.c)

    def test_legacy_cancel_api_cannot_cancel_or_change_payment(self):
        b=self.confirm(self.reserve())
        response=self.client.post(f'/api/bookings/{b.pk}/cancel/',{},format='json')
        self.assertEqual(response.status_code,405)
        b.refresh_from_db()
        self.assertEqual((b.status,b.payment_status),('confirmed','verified'))
        with self.assertRaises(PermissionDenied):services.cancel(b.pk,self.a)
        with self.assertRaises(PermissionDenied):services.cancel(b.pk,self.b)

    def test_mentor_can_publish_schedule(self):
        response = self.client.put('/api/mentor/availability/', {'rules':[{'weekday':2,'start_time':'18:00','end_time':'19:00'}], 'blocked_dates':[]}, format='json')
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(self.a.mentor.availability.count(), 1)
        self.assertEqual(response.json()['rules'][0]['weekday'], 2)

    def test_invalid_overlapping_schedule_preserves_previous_rules(self):
        before = list(self.a.mentor.availability.values_list('pk', flat=True))
        response = self.client.put('/api/mentor/availability/', {'rules':[{'weekday':2,'start_time':'18:00','end_time':'20:00'}, {'weekday':2,'start_time':'19:00','end_time':'21:00'}], 'blocked_dates':[]}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(list(self.a.mentor.availability.values_list('pk', flat=True)), before)

    def test_confirmation_ignores_legacy_schedule_edits(self):
        b=self.reserve()
        self.b.mentor.availability.all().delete()
        self.assertEqual(self.confirm(b).status,'confirmed')
