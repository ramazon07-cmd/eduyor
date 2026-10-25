from datetime import timedelta
from decimal import Decimal
from importlib import import_module
from types import SimpleNamespace
from unittest.mock import patch
from django.apps import apps
from django.db import connection
from django.test import TestCase, Client
from django.urls import reverse
from rest_framework.test import APIClient
from .models import User, MentorProfile, Subject, Booking
from .tests import NOW, START
from . import services


class SimpleMentorAndPaymentTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.student=User.objects.create_user('simple-student@example.invalid',None)
        cls.teacher=User.objects.create_user('simple-teacher@example.invalid',None)
        cls.other=User.objects.create_user('simple-other@example.invalid',None)
        cls.admin=User.objects.create_user('simple-admin@example.invalid',None,is_staff=True,is_superuser=True)
        cls.staff=User.objects.create_user('simple-staff@example.invalid',None,is_staff=True)
        for user,name in [(cls.student,'Student'),(cls.teacher,'Mentor')]:
            user.profile.full_name=name;user.profile.save()
        cls.subject=Subject.objects.get_or_create(name='SAT')[0]
        cls.mentor=MentorProfile.objects.create(user=cls.teacher,headline='SAT mentor',bio='Bio',experience='Achievements',hourly_price=30000,teaching_languages='English',approval='approved')
        cls.mentor.subjects.add(cls.subject)
        from datetime import time
        from .models import AvailabilityRule
        for day in range(7):
            AvailabilityRule.objects.create(mentor=cls.mentor, weekday=day, start_time=time(0), end_time=time(23, 59))

    def setUp(self):
        self.clock=patch('core.services.timezone.now',return_value=NOW)
        self.clock.start();self.addCleanup(self.clock.stop)
        self.api=APIClient();self.api.force_authenticate(self.student)

    def booking(self):return services.reserve(self.student,self.teacher.pk,START,'SAT practice')

    def test_one_bio_is_enough_and_keeps_dual_role(self):
        self.api.force_authenticate(self.teacher)
        response=self.api.put('/api/mentor/settings/',{'headline':'SAT mentor','bio':'IELTS 8. SAT 1510. Tajribam.','subjects':[self.subject.pk],'teaching_languages':'O‘zbekcha, English','hourly_price':'35000','is_paused':False},format='json')
        self.assertEqual(response.status_code,200,response.content)
        self.assertNotIn('experience',response.json())
        self.mentor.refresh_from_db()
        self.assertEqual(self.mentor.experience,'')
        self.assertEqual(self.mentor.bio,'IELTS 8. SAT 1510. Tajribam.')
        self.assertEqual(self.mentor.approval,'pending')
        self.assertEqual(self.api.get('/api/bookings/').status_code,200)

    def test_legacy_duplicate_bio_read_once_and_migration_preserves_content(self):
        self.mentor.bio='IELTS 8';self.mentor.experience='IELTS 8';self.mentor.save()
        response=self.api.get(f'/api/mentors/{self.teacher.pk}/')
        self.assertEqual(response.json()['bio'],'IELTS 8')
        self.assertNotIn('experience',response.json())
        self.mentor.bio='A'*1500;self.mentor.experience='B'*1200;self.mentor.save()
        migrate=import_module('core.migrations.0003_combined_mentor_bio').combine_bios
        migrate(apps,SimpleNamespace(connection=connection));migrate(apps,SimpleNamespace(connection=connection))
        self.mentor.refresh_from_db()
        self.assertEqual(self.mentor.bio,'A'*1500+'\n\n'+'B'*1200)
        self.assertEqual(self.mentor.experience,'')
        self.assertEqual(self.mentor.approval,'approved')
        self.mentor.full_clean()

    def test_old_client_bio_and_experience_are_combined_on_save(self):
        self.api.force_authenticate(self.teacher)
        response=self.api.put('/api/mentor/settings/',{'headline':'SAT','bio':'About','experience':'Achievement','subjects':[self.subject.pk],'teaching_languages':'English','hourly_price':'40000'},format='json')
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json()['bio'],'About\n\nAchievement')

    def test_payment_button_without_reference_only_submits_claim(self):
        booking=self.booking();deadline=booking.expires_at
        url=f'/api/bookings/{booking.pk}/payment/'
        first=self.api.post(url,{},format='json')
        self.assertEqual(first.status_code,200)
        self.assertEqual(first.json()['status'],'pending_payment')
        self.assertEqual(first.json()['payment_status'],'submitted')
        booking.refresh_from_db()
        self.assertIn(f'Bron #{booking.pk}',booking.payment_reference)
        self.assertIsNone(booking.payment_verified_at)
        self.assertEqual(booking.payout_status,'not_eligible')
        self.assertEqual(booking.expires_at,deadline)
        second=self.api.post(url,{},format='json')
        self.assertEqual(second.json(),first.json())
        self.assertEqual(Booking.objects.count(),1)

    def test_optional_reference_and_server_field_validation(self):
        booking=self.booking();url=f'/api/bookings/{booking.pk}/payment/'
        self.assertEqual(self.api.post(url,{'reference':'x'*161},format='json').status_code,400)
        response=self.api.post(url,{'reference':'bank-app-123'},format='json')
        self.assertEqual(response.json()['payment_reference'],'bank-app-123')
        self.api.post(url,{},format='json')
        booking.refresh_from_db();self.assertEqual(booking.payment_reference,'bank-app-123')
        self.assertEqual(booking.payment_status,'submitted')

    def test_payment_claim_is_student_only_and_expired_hold_is_rejected(self):
        booking=self.booking();url=f'/api/bookings/{booking.pk}/payment/'
        for user in [self.teacher,self.other,None]:
            self.api.force_authenticate(user)
            self.assertEqual(self.api.post(url,{},format='json').status_code,403)
        self.api.force_authenticate(self.student)
        with patch('core.services.timezone.now',return_value=NOW+timedelta(minutes=61)):
            self.assertEqual(self.api.post(url,{},format='json').status_code,409)
        booking.refresh_from_db();self.assertNotEqual(booking.status,'confirmed')
        self.assertEqual(booking.payment_status,'unpaid')

    def test_admin_review_requires_bank_reference_and_checked_receipt(self):
        booking=services.submit_payment(self.booking().pk,self.student)
        client=Client();client.force_login(self.admin)
        url=reverse('admin:core_booking_payment_review',args=[booking.pk])
        response=client.get(url)
        self.assertEqual(response.status_code,200)
        self.assertContains(response,'30000')
        self.assertContains(response,'Student')
        self.assertEqual(client.post(url,{'reference':'actual-bank-id'}).status_code,400)
        self.assertEqual(client.post(url,{'receipt_checked':'on'}).status_code,400)
        booking.refresh_from_db();self.assertEqual(booking.payment_status,'submitted')
        self.assertEqual(client.post(url,{'reference':'actual-bank-id','receipt_checked':'on'}).status_code,302)
        booking.refresh_from_db();self.assertEqual((booking.status,booking.payment_status),('confirmed','verified'))
        self.assertEqual(booking.receipt_reference,'actual-bank-id')
        self.assertEqual(booking.mentor_net,Decimal('21000'))
        client.post(url,{'reference':'repeated-click','receipt_checked':'on'})
        booking.refresh_from_db();self.assertEqual(booking.receipt_reference,'actual-bank-id')

    def test_expired_admin_review_records_full_refund_instead_of_confirmation(self):
        booking=services.submit_payment(self.booking().pk,self.student)
        client=Client();client.force_login(self.admin)
        url=reverse('admin:core_booking_payment_review',args=[booking.pk])
        with patch('core.services.timezone.now',return_value=NOW+timedelta(minutes=61)):
            response=client.post(url,{'reference':'late-bank-id','receipt_checked':'on'})
        self.assertEqual(response.status_code,409)
        booking.refresh_from_db()
        self.assertEqual((booking.status,booking.payment_status),('expired','refund_required'))
        self.assertEqual(booking.payout_status,'not_eligible')

    def test_review_permissions_and_csrf(self):
        booking=services.submit_payment(self.booking().pk,self.student)
        url=reverse('admin:core_booking_payment_review',args=[booking.pk])
        client=Client(enforce_csrf_checks=True)
        client.force_login(self.staff)
        self.assertEqual(client.get(url).status_code,403)
        client.force_login(self.student)
        self.assertEqual(client.get(url).status_code,302)
        client.force_login(self.admin)
        self.assertEqual(client.post(url,{'reference':'actual-id','receipt_checked':'on'}).status_code,403)
        self.assertEqual(client.get(url).status_code,200)
        token=client.cookies['csrftoken'].value
        self.assertEqual(client.post(url,{'reference':'actual-id','receipt_checked':'on'},HTTP_X_CSRFTOKEN=token).status_code,302)
        booking.refresh_from_db();self.assertEqual(booking.payment_status,'verified')

    def test_admin_list_has_review_queue_link(self):
        services.submit_payment(self.booking().pk,self.student)
        client=Client();client.force_login(self.admin)
        response=client.get(reverse('admin:core_booking_changelist'))
        self.assertEqual(response.status_code,200)
        self.assertContains(response,'To‘lov xabarlari')
        self.assertContains(response,'payment-review/')
