from datetime import timedelta
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from .tests import NOW, START
from . import tests as baseline
from .models import Booking
from . import services
from unittest.mock import patch


class PaymentAndListingUpdates(TestCase):
    setUp = baseline.BookingTests.setUp
    reserve = baseline.BookingTests.reserve
    confirm = baseline.BookingTests.confirm
    @override_settings(PAYMENT_INSTRUCTIONS='',PAYMENT_CARD_NUMBER='8600 0000 0000 0000',PAYMENT_CARD_HOLDER='TEST RECIPIENT',PAYMENT_BANK_NAME='Test Bank')
    def test_card_only_configuration_allows_manual_reservation(self):
        info=self.client.get('/api/payment-info/').json()
        self.assertEqual(info['card_number'],'8600000000000000')
        self.assertEqual(info['card_holder'],'TEST RECIPIENT')
        self.assertTrue(info['can_accept_payment'])
        response=self.client.post('/api/bookings/',{'mentor_id':self.b.pk,'starts_at':START.isoformat(),'objective':'SAT'},format='json')
        self.assertEqual(response.status_code,201)
        self.assertEqual(response.json()['payment_status'],'unpaid')

    @override_settings(PAYMENT_INSTRUCTIONS='Legacy instructions',PAYMENT_CARD_NUMBER='bad-card',PAYMENT_CARD_HOLDER='TEST')
    def test_invalid_card_configuration_disables_booking(self):
        info=self.client.get('/api/payment-info/').json()
        self.assertEqual(info['card_number'],'')
        self.assertFalse(info['can_accept_payment'])
        response=self.client.post('/api/bookings/',{'mentor_id':self.b.pk,'starts_at':START.isoformat(),'objective':'SAT'},format='json')
        self.assertEqual(response.status_code,400)

    def test_pending_listing_visible_only_to_its_owner(self):
        mentor=self.a.mentor;mentor.approval='pending';mentor.save()
        own=self.client.get('/api/me/').json()['mentor_listing']
        self.assertEqual(own['id'],self.a.pk)
        self.assertEqual(own['approval'],'pending')
        self.assertFalse(own['is_public'])
        self.assertTrue(own['has_availability'])
        self.assertNotIn('email',own)
        guest=APIClient()
        self.assertEqual(guest.get(f'/api/mentors/{self.a.pk}/').status_code,404)
        self.assertNotIn(self.a.pk,[m['id'] for m in guest.get('/api/mentors/').json()['results']])

    def test_paused_owner_preview_and_approved_directory_exclusion(self):
        public=self.client.get('/api/mentors/').json()['results']
        self.assertIn(self.a.pk,[m['id'] for m in public])
        without_own=self.client.get('/api/mentors/?exclude_self=1').json()['results']
        self.assertNotIn(self.a.pk,[m['id'] for m in without_own])
        mentor=self.a.mentor;mentor.is_paused=True;mentor.save()
        own=self.client.get('/api/me/').json()['mentor_listing']
        self.assertTrue(own['is_paused']);self.assertFalse(own['is_public'])
        self.assertEqual(self.client.get(f'/api/mentors/{self.a.pk}/').status_code,404)

    def test_meeting_alerts_are_private_and_for_student(self):
        b=self.confirm(self.reserve())
        services.set_meeting(b.pk,self.b,'https://meet.google.com/abc-defg-hij')
        result=self.client.get('/api/bookings/?meeting_ready=1').json()['results']
        self.assertEqual([row['id'] for row in result],[b.pk])
        self.client.force_authenticate(self.b)
        self.assertEqual(self.client.get('/api/bookings/?meeting_ready=1').json()['results'],[])
        self.client.force_authenticate(self.c)
        self.assertEqual(self.client.get('/api/bookings/?meeting_ready=1').json()['results'],[])
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get('/api/payment-info/').status_code,403)

    def test_card_payment_stays_pending_until_independently_verified(self):
        b=self.reserve()
        b=services.submit_payment(b.pk,self.a,'TEST CLAIM ONLY')
        self.assertEqual((b.status,b.payment_status,b.payout_status),('pending_payment','submitted','not_eligible'))
        b=self.confirm(b)
        self.assertEqual(b.payout_status,'not_eligible')
        with patch('core.services.timezone.now',return_value=START+timedelta(hours=2)):
            b=services.refresh_booking(b.pk)
            self.assertEqual(b.status,'confirmed')
            b=services.complete(b.pk,self.a)
            self.assertEqual(b.payout_status,'pending')
            b=services.pay_out(b.pk,'TEST TRANSFER AFTER LESSON')
            self.assertEqual(b.payout_status,'paid')
        self.assertEqual(b.mentor_net,45000)
