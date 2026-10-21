from datetime import timedelta
from decimal import Decimal
from importlib import import_module
from unittest.mock import patch
from django.apps import apps
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import TestCase
from rest_framework.test import APIClient
from .models import User, Subject, MentorProfile, Booking
from .tests import NOW, START
from . import services


class PricingPolicyTests(TestCase):
    def setUp(self):
        self.student = User.objects.create_user('pricing-student@example.invalid', None)
        self.mentor = User.objects.create_user('pricing-mentor@example.invalid', None)
        self.subject = Subject.objects.create(name='SAT')
        self.profile = MentorProfile.objects.create(user=self.mentor, headline='SAT', bio='Demo', experience='Demo', teaching_languages='O‘zbekcha', hourly_price=30000, approval='approved')
        self.profile.subjects.add(self.subject)
        self.clock = patch('core.services.timezone.now', return_value=NOW)
        self.clock.start()
        self.addCleanup(self.clock.stop)

    def reserve(self):
        return services.reserve(self.student, self.mentor.pk, START, 'SAT')

    def test_inclusive_boundaries_and_decimal_twenty_percent(self):
        for price, fee, net in [(30000,6000,24000),(60000,12000,48000),(45001,9000,36001)]:
            with self.subTest(price=price):
                self.profile.hourly_price=price
                self.profile.save()
                booking=self.reserve()
                self.assertEqual((booking.total_price,booking.platform_fee,booking.mentor_net,booking.commission_rate),(Decimal(price),Decimal(fee),Decimal(net),Decimal('0.20')))
                Booking.objects.filter(pk=booking.pk).delete()

    def test_api_price_validation_is_field_level(self):
        client=APIClient();client.force_authenticate(self.mentor)
        for price in ['29999','60001','0','-10','30000.5']:
            result=client.put('/api/mentor/settings/',{'headline':'SAT','bio':'Demo','subjects':[self.subject.pk],'experience':'Demo','teaching_languages':'O‘zbekcha','hourly_price':price},format='json')
            self.assertEqual(result.status_code,400)
            self.assertIn('hourly_price',str(result.json()))
        self.profile.refresh_from_db();self.assertEqual(self.profile.hourly_price,30000)

    def test_model_and_database_reject_out_of_range_prices(self):
        for price in [29999,60001]:
            self.profile.hourly_price=price
            with self.assertRaises(ValidationError):self.profile.full_clean()
            with self.assertRaises(IntegrityError),transaction.atomic():
                MentorProfile.objects.filter(pk=self.profile.pk).update(hourly_price=price)

    def test_price_edit_does_not_change_reservation_or_confirmation(self):
        booking=self.reserve()
        self.profile.hourly_price=60000;self.profile.save()
        booking=services.verify_payment(booking.pk,'independently-verified')
        self.assertEqual((booking.total_price,booking.platform_fee,booking.mentor_net),(30000,6000,24000))
        booking.platform_fee=12000
        with self.assertRaises(ValidationError):booking.save()

    def test_historical_ten_percent_booking_retains_snapshot_and_payout(self):
        old=Booking.objects.create(student=self.student,mentor=self.mentor,starts_at=START,ends_at=START+timedelta(hours=1),objective='Historical',expires_at=NOW+timedelta(hours=1),total_price=100000,commission_rate=Decimal('0.10'),platform_fee=10000,mentor_net=90000)
        old=services.verify_payment(old.pk,'legacy-payment')
        with patch('core.services.timezone.now',return_value=START+timedelta(hours=2)):
            old=services.complete(old.pk,self.student)
            old=services.pay_out(old.pk,'legacy-transfer')
        self.assertEqual((old.commission_rate,old.total_price,old.mentor_net),(Decimal('0.10'),100000,90000))
        self.assertEqual(services.earnings(self.mentor)['paid'],'90000')
        client=APIClient();client.force_authenticate(self.student)
        self.assertEqual(client.get(f'/api/bookings/{old.pk}/').json()['commission_rate'],'0.10')

    def test_data_migration_never_updates_booking_snapshots(self):
        booking=self.reserve()
        migration=import_module('core.migrations.0002_pricing_policy')
        from types import SimpleNamespace
        from django.db import connection
        editor=SimpleNamespace(connection=connection)
        migration.normalize_listing_prices(apps,editor)
        migration.normalize_listing_prices(apps,editor)
        booking.refresh_from_db()
        self.assertEqual((booking.total_price,booking.commission_rate),(30000,Decimal('0.20')))
