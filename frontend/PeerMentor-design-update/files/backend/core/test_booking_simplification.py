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

    def test_all_24_local_hours_without_mentor_schedule(self):
        self.b.mentor.availability.all().delete()
        result=self.client.get(f'/api/mentors/{self.b.pk}/slots/?timezone=Asia/Tashkent').json()
        day=[row for row in result['slots'] if row['date']=='2026-06-03']
        self.assertEqual({row['time'] for row in day},{f'{hour:02}:00' for hour in range(24)})
        self.assertTrue(self.client.get('/api/me/').json()['mentor_listing']['has_availability'])

    def test_student_can_choose_time_outside_previous_hours(self):
        early=START-timedelta(hours=10)  # 08:00 Tashkent
        b=self.reserve(start=early)
        self.assertEqual(b.starts_at,early)
        self.assertEqual(b.ends_at-early,timedelta(hours=1))
        self.assertNotIn(early,services.available_slots(self.b.mentor,self.a,now=NOW))

    def test_legacy_cancel_api_cannot_cancel_or_change_payment(self):
        b=self.confirm(self.reserve())
        response=self.client.post(f'/api/bookings/{b.pk}/cancel/',{},format='json')
        self.assertEqual(response.status_code,405)
        b.refresh_from_db()
        self.assertEqual((b.status,b.payment_status),('confirmed','verified'))
        with self.assertRaises(PermissionDenied):services.cancel(b.pk,self.a)
        with self.assertRaises(PermissionDenied):services.cancel(b.pk,self.b)

    def test_legacy_schedule_put_does_not_mutate_stored_data(self):
        before=list(self.a.mentor.availability.values_list('pk',flat=True))
        response=self.client.put('/api/mentor/availability/',{'rules':[],'blocked_dates':[]},format='json')
        self.assertEqual(response.status_code,405)
        self.assertEqual(list(self.a.mentor.availability.values_list('pk',flat=True)),before)

    def test_confirmation_ignores_legacy_schedule_edits(self):
        b=self.reserve()
        self.b.mentor.availability.all().delete()
        self.assertEqual(self.confirm(b).status,'confirmed')
