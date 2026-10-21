from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from django.test import TestCase
from rest_framework.test import APIClient
from .models import User, Booking
from .tests import NOW, START


class DashboardFilterTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner, cls.peer, cls.other = [User.objects.create_user(f'dashboard-{n}@example.invalid',None) for n in range(3)]
        cls.owner.profile.timezone = 'Asia/Tashkent'
        cls.owner.profile.save()

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.owner)
        self.clock = patch('core.services.timezone.now',return_value=NOW)
        self.clock.start()
        self.addCleanup(self.clock.stop)

    def booking(self,student=None,mentor=None,start=START,status='confirmed',expires=None):
        return Booking.objects.create(student=student or self.owner,mentor=mentor or self.peer,
            starts_at=start,ends_at=start+timedelta(minutes=50),expires_at=expires or NOW+timedelta(minutes=60),
            objective='Private objective',total_price=30000,commission_rate='0.20',platform_fee=6000,mentor_net=24000,
            status=status,payment_status='verified' if status=='confirmed' else 'unpaid')

    def results(self,**filters):
        response = self.client.get('/api/bookings/',filters)
        self.assertEqual(response.status_code,200,response.data)
        return response.data['results']

    def test_role_and_status_combine_without_exposing_other_peoples_sessions(self):
        learning = self.booking()
        teaching = self.booking(student=self.peer,mentor=self.owner,start=START+timedelta(hours=1))
        hold = self.booking(start=START+timedelta(hours=2),status='pending_payment')
        self.booking(student=self.peer,mentor=self.other)
        self.assertEqual({b['id'] for b in self.results()},{learning.pk,teaching.pk,hold.pk})
        self.assertEqual([b['id'] for b in self.results(role='learning',status='confirmed')],[learning.pk])
        self.assertEqual([b['id'] for b in self.results(role='teaching')],[teaching.pk])

    def test_calendar_uses_viewer_timezone_and_excludes_next_midnight(self):
        # June 3 in Tashkent begins at 19:00 UTC on June 2.
        boundary = datetime(2026,6,2,19,tzinfo=timezone.utc)
        self.booking(start=boundary-timedelta(minutes=1))
        first = self.booking(start=boundary)
        last = self.booking(student=self.peer,mentor=self.owner,start=boundary+timedelta(hours=23,minutes=59))
        self.booking(start=boundary+timedelta(days=1))
        self.assertEqual({b['id'] for b in self.results(date='2026-06-03')},{first.pk,last.pk})

    def test_expired_filter_includes_unprocessed_holds_and_pending_excludes_them(self):
        old = self.booking(status='pending_payment',expires=NOW)
        active = self.booking(status='pending_payment',start=START+timedelta(hours=1))
        self.assertEqual([b['id'] for b in self.results(status='pending_payment')],[active.pk])
        rows = self.results(status='expired')
        self.assertEqual([b['id'] for b in rows],[old.pk])
        self.assertEqual(rows[0]['status'],'expired')
        old.refresh_from_db()
        self.assertEqual(old.status,'expired')

    def test_invalid_filters_have_field_errors_and_empty_controls_are_accepted(self):
        for field,value in [('role','admin'),('status','paid'),('date','not-a-date')]:
            response = self.client.get('/api/bookings/',{field:value})
            self.assertEqual(response.status_code,400)
            self.assertIn(field,response.data)
        self.assertEqual(self.client.get('/api/bookings/',{'role':'','status':'','date':''}).status_code,200)

    def test_calendar_is_private(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get('/api/bookings/',{'date':'2026-06-03'}).status_code,403)
