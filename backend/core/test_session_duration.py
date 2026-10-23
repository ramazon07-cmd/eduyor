from datetime import timedelta
from unittest.mock import patch
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework.exceptions import APIException
from .models import User, MentorProfile, Subject, Booking
from .serializers import BookingSerializer
from .tests import NOW, START
from . import services


class FiftyMinuteSessionTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.student=User.objects.create_user('duration-student@example.invalid',None)
        cls.teacher=User.objects.create_user('duration-teacher@example.invalid',None)
        cls.other=User.objects.create_user('duration-other@example.invalid',None)
        cls.subject=Subject.objects.get_or_create(name='SAT')[0]
        for user in [cls.teacher,cls.other]:
            mentor=MentorProfile.objects.create(user=user,headline='Demo',bio='Demo',teaching_languages='English',hourly_price=30000,approval='approved')
            mentor.subjects.add(cls.subject)

    def setUp(self):
        self.clock=patch('core.services.timezone.now',return_value=NOW)
        self.clock.start();self.addCleanup(self.clock.stop)
        self.client=APIClient();self.client.force_authenticate(self.student)

    def reserve(self):return services.reserve(self.student,self.teacher.pk,START,'SAT')

    def historical(self,start,end):
        return Booking.objects.create(student=self.student,mentor=self.other,starts_at=start,ends_at=end,expires_at=NOW+timedelta(minutes=60),objective='Historical fixture',total_price=30000,commission_rate='0.20',platform_fee=6000,mentor_net=24000,status='confirmed',payment_status='verified')

    def test_new_session_is_fifty_and_payment_hold_is_still_sixty(self):
        booking=self.reserve()
        self.assertEqual(booking.ends_at-booking.starts_at,timedelta(minutes=50))
        self.assertEqual(booking.expires_at-NOW,timedelta(minutes=60))
        response=self.client.get(f'/api/bookings/{booking.pk}/')
        self.assertEqual(response.json()['duration_minutes'],50)
        self.assertEqual((booking.total_price,booking.platform_fee,booking.mentor_net),(30000,9000,21000))

    def test_public_profiles_and_timezone_slot_ends_agree(self):
        self.assertEqual(self.client.get(f'/api/mentors/{self.teacher.pk}/').json()['session_duration_minutes'],50)
        result=self.client.get(f'/api/mentors/{self.teacher.pk}/slots/?timezone=Europe/London').json()
        self.assertEqual(result['duration_minutes'],50)
        from datetime import datetime
        for slot in result['slots']:
            self.assertEqual(datetime.fromisoformat(slot['ends_at'])-datetime.fromisoformat(slot['starts_at']),timedelta(minutes=50))
        row=next(slot for slot in result['slots'] if slot['starts_at']==START.isoformat())
        self.assertEqual(row['time'],'14:00')

    def test_availability_and_reserve_use_actual_fifty_minute_boundary(self):
        busy=self.historical(START+timedelta(minutes=50),START+timedelta(minutes=100))
        self.assertIn(START,services.available_slots(self.teacher.mentor,self.student,now=NOW))
        booking=self.reserve()
        self.assertEqual(booking.ends_at,busy.starts_at)

    def test_one_minute_overlap_in_either_role_is_rejected(self):
        self.historical(START+timedelta(minutes=49),START+timedelta(minutes=99))
        self.assertNotIn(START,services.available_slots(self.teacher.mentor,self.student,now=NOW))
        with self.assertRaises(APIException):self.reserve()

    def test_student_completion_opens_exactly_at_fifty_minutes(self):
        booking=services.verify_payment(self.reserve().pk,'verified-bank-receipt')
        with patch('core.services.timezone.now',return_value=START+timedelta(minutes=49,seconds=59)):
            with self.assertRaises(APIException):services.complete(booking.pk,self.student)
        with patch('core.services.timezone.now',return_value=START+timedelta(minutes=50)):
            booking=services.complete(booking.pk,self.student)
        self.assertEqual((booking.status,booking.payout_status),('completed','pending'))

    def test_existing_sixty_minute_snapshot_is_preserved_and_displayed_honestly(self):
        booking=Booking.objects.create(student=self.student,mentor=self.teacher,starts_at=START,ends_at=START+timedelta(minutes=60),expires_at=NOW+timedelta(minutes=60),objective='Existing reservation',total_price=30000,commission_rate='0.20',platform_fee=6000,mentor_net=24000)
        booking=services.verify_payment(booking.pk,'legacy-receipt')
        self.assertEqual(booking.ends_at,START+timedelta(minutes=60))
        self.assertEqual(BookingSerializer(booking).data['duration_minutes'],60)
        with patch('core.services.timezone.now',return_value=START+timedelta(minutes=50)):
            with self.assertRaises(APIException):services.complete(booking.pk,self.student)
