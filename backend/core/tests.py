from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, time, timedelta, timezone as dt_timezone
from decimal import Decimal
from io import BytesIO
from threading import Barrier
from unittest.mock import patch
from zoneinfo import ZoneInfo
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.management import call_command
from django.db import connection, connections, close_old_connections
from django.test import TestCase, TransactionTestCase, override_settings
from django.utils import timezone
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework.exceptions import ValidationError, PermissionDenied
from .models import User, MentorProfile, Subject, AvailabilityRule, BlockedDate, Booking
from . import services as s
from .errors import Conflict

UTC = dt_timezone.utc
NOW = datetime(2026,6,1,6,tzinfo=UTC)  # Monday 11:00 Tashkent
START = datetime(2026,6,3,13,tzinfo=UTC)  # Wednesday 18:00 Tashkent


def people():
    subject = Subject.objects.get_or_create(name='SAT')[0]
    users = [User.objects.create_user(f'person{i}@example.com','Test-password-826!',first_name=f'Person {i}') for i in range(4)]
    for u in users:
        m = MentorProfile.objects.create(user=u,headline='SAT mentor',bio='Bio',teaching_languages='Uzbek',experience='Experience',hourly_price=50000,approval='approved')
        m.subjects.add(subject)
        for day in range(7):
            AvailabilityRule.objects.create(mentor=m,weekday=day,start_time=time(18),end_time=time(21))
    return users


@override_settings(PAYMENT_INSTRUCTIONS='Test instructions')
class BookingTests(TestCase):
    def setUp(self):
        self.a,self.b,self.c,self.d = people()
        self.ops = User.objects.create_user('support@example.com',None,is_staff=True)
        self.clock = patch('core.services.timezone.now',return_value=NOW)
        self.clock.start()
        self.addCleanup(self.clock.stop)
        self.client = APIClient()
        self.client.force_authenticate(self.a)

    def reserve(self,student=None,mentor=None,start=START):
        return s.reserve(student or self.a,(mentor or self.b).pk,start,'SAT practice')

    def confirm(self,b):
        # created_at uses Django's clock, so patch service's shared timezone too.
        return s.verify_payment(b.pk,'bank-verified-123')

    def test_dual_role_does_not_remove_student_functionality(self):
        b = self.reserve()
        other = self.reserve(self.c,self.a,START+timedelta(hours=1))
        result = self.client.get('/api/bookings/').json()['results']
        self.assertEqual({r['id'] for r in result},{b.pk,other.pk})
        self.assertTrue(hasattr(self.a,'mentor'))
        self.assertTrue(hasattr(self.a,'profile'))

    def test_self_booking_rejected(self):
        with self.assertRaises(ValidationError): self.reserve(self.a,self.a)
        response=self.client.post('/api/bookings/',{'mentor_id':self.a.pk,'starts_at':START.isoformat(),'objective':'x'},format='json')
        self.assertEqual(response.status_code,400)

    def test_same_mentor_and_cross_role_conflicts(self):
        self.reserve()
        for student,mentor in [(self.c,self.b),(self.b,self.c),(self.c,self.a),(self.a,self.c)]:
            with self.assertRaises(Conflict): self.reserve(student,mentor)

    def test_partial_overlap_cross_role(self):
        b=self.reserve()
        # Existing half-hour-anchored bookings from the prior scheduler still block new whole-hour slots.
        Booking.objects.filter(pk=b.pk).update(starts_at=START+timedelta(minutes=30),ends_at=START+timedelta(minutes=90))
        with self.assertRaises(Conflict): self.reserve(self.b,self.c,START+timedelta(hours=1))

    def test_adjacent_sessions_allowed(self):
        self.reserve()
        self.reserve(self.b,self.c,START+timedelta(hours=1))
        self.assertEqual(Booking.objects.count(),2)

    def test_invalid_past_and_less_than_24_hours(self):
        for start in [NOW-timedelta(days=1),NOW+timedelta(hours=23),START+timedelta(minutes=30)]:
            with self.assertRaises(Conflict): self.reserve(start=start)

    def test_hold_expiry_without_cleanup_releases_slot(self):
        b=self.reserve()
        Booking.objects.filter(pk=b.pk).update(expires_at=NOW-timedelta(seconds=1))
        self.assertIn(START,s.available_slots(self.b.mentor,self.c,now=NOW))
        other=self.reserve(self.c,self.b)
        self.assertNotEqual(b.pk,other.pk)
        call_command('expire_reservations',verbosity=0)
        call_command('expire_reservations',verbosity=0)
        b.refresh_from_db()
        self.assertEqual(b.status,'expired')

    def test_timezone_conversion_and_all_day_slots(self):
        slots=s.available_slots(self.b.mentor,now=NOW)
        self.assertIn(START,slots)
        self.assertEqual(START.astimezone(ZoneInfo('Asia/Tashkent')).hour,18)
        self.assertIn(START+timedelta(hours=3),slots)
        self.assertIn(START.replace(hour=19),slots)  # midnight in Tashkent
        result=self.client.get(f'/api/mentors/{self.b.pk}/slots/?timezone=Europe/London').json()
        slot=next(x for x in result['slots'] if x['starts_at']==START.isoformat())
        self.assertEqual(slot['time'],'14:00')
        self.assertEqual(result['timezone'],'Europe/London')

    def test_dst_gap_and_fold_not_guessed(self):
        self.assertIsNone(s.wall_utc(datetime(2026,3,8).date(),time(2,30),ZoneInfo('America/New_York')))
        self.assertIsNone(s.wall_utc(datetime(2026,11,1).date(),time(1,30),ZoneInfo('America/New_York')))

    def test_legacy_windows_ignored_but_listing_pause_enforced(self):
        self.b.mentor.availability.all().delete()
        BlockedDate.objects.create(mentor=self.b.mentor,date=START.astimezone(ZoneInfo('Asia/Tashkent')).date())
        self.assertIn(START,s.available_slots(self.b.mentor,now=NOW))
        self.b.mentor.is_paused=True;self.b.mentor.save()
        self.assertEqual(self.client.get(f'/api/mentors/{self.b.pk}/').status_code,404)
        with self.assertRaises(Conflict):self.reserve()

    def test_money_and_immutable_snapshot(self):
        b=self.reserve()
        self.assertEqual((b.total_price,b.platform_fee,b.mentor_net,b.commission_rate),(Decimal('50000'),Decimal('10000'),Decimal('40000'),Decimal('0.20')))
        self.b.mentor.hourly_price=60000;self.b.mentor.save()
        b=self.confirm(b)
        self.assertEqual(b.total_price,50000)
        b.total_price=500
        with self.assertRaises(DjangoValidationError):b.save()

    def test_submission_is_not_payment_verification(self):
        b=s.submit_payment(self.reserve().pk,self.a,'claim-1')
        self.assertEqual((b.status,b.payment_status),('pending_payment','submitted'))
        self.assertEqual(b.payment_verified_at,None)

    def test_repeat_verification_and_payout_idempotent(self):
        b=self.confirm(self.reserve())
        first=b.payment_verified_at
        b=s.verify_payment(b.pk,'second-click')
        self.assertEqual(b.receipt_reference,'bank-verified-123')
        self.assertEqual(b.payment_verified_at,first)
        with patch('core.services.timezone.now',return_value=START+timedelta(hours=2)):
            b=s.complete(b.pk,self.a)
            b=s.complete(b.pk,self.a)
            b=s.pay_out(b.pk,'transfer-1')
            paid_at=b.paid_at
            b=s.pay_out(b.pk,'transfer-2')
        self.assertEqual((b.payout_reference,b.paid_at),('transfer-1',paid_at))

    def test_late_received_funds_flag_refund_never_confirm(self):
        b=self.reserve()
        with patch('core.services.timezone.now',return_value=NOW+timedelta(hours=1,seconds=1)):
            b=s.verify_payment(b.pk,'late-bank-receipt')
        self.assertEqual((b.status,b.payment_status),('expired','refund_required'))
        self.assertEqual(Booking.objects.get(pk=b.pk).payment_status,'refund_required')

    def test_confirm_rechecks_listing_pause(self):
        b=self.reserve()
        self.b.mentor.is_paused=True;self.b.mentor.save()
        self.assertEqual(self.confirm(b).payment_status,'refund_required')

    def test_confirmation_uses_original_notice_threshold(self):
        # Hold created exactly 24h before: 10 minutes spent reviewing does not invalidate notice.
        with patch('core.services.timezone.now',return_value=START-timedelta(hours=24)):
            b=self.reserve()
        # auto_now_add may be milliseconds later than the initial notice check.
        Booking.objects.filter(pk=b.pk).update(created_at=b.created_at+timedelta(milliseconds=5))
        with patch('core.services.timezone.now',return_value=START-timedelta(hours=23,minutes=50)):
            self.assertEqual(self.confirm(b).status,'confirmed')

    def test_admin_cancel_unpaid_and_verified_refund_release_slot(self):
        b=s.cancel(self.reserve().pk,self.ops)
        self.assertEqual((b.status,b.payment_status),('cancelled','unpaid'))
        b=self.confirm(self.reserve())
        b=s.cancel(b.pk,self.ops)
        self.assertEqual(b.payment_status,'refund_required')
        self.assertIn(START,s.available_slots(self.b.mentor,self.c,now=NOW))
        b=s.refund(b.pk,'refund-1');b=s.refund(b.pk,'refund-2')
        self.assertEqual(b.refund_reference,'refund-1')
        self.assertEqual(s.earnings(self.b)['net_earned'],'0')

    def test_cancel_submitted_then_receipt_requires_refund(self):
        b=s.submit_payment(self.reserve().pk,self.a,'claim')
        s.cancel(b.pk,self.ops)
        b=s.verify_payment(b.pk,'received-after-cancellation')
        self.assertEqual((b.status,b.payment_status),('cancelled','refund_required'))

    def test_completion_requires_student_after_end_no_auto_completion(self):
        b=self.confirm(self.reserve())
        with self.assertRaises(Conflict):s.complete(b.pk,self.a)
        with patch('core.services.timezone.now',return_value=START+timedelta(hours=2)):
            with self.assertRaises(PermissionDenied):s.complete(b.pk,self.b)
            self.assertEqual(s.refresh_booking(b.pk).status,'confirmed')
            b=s.complete(b.pk,self.a)
        self.assertEqual(b.payout_status,'pending')

    def test_cancel_after_start_rejected_and_dispute_excludes_earnings(self):
        b=self.confirm(self.reserve())
        with patch('core.services.timezone.now',return_value=START+timedelta(hours=2)):
            with self.assertRaises(Conflict):s.cancel(b.pk,self.ops)
            s.complete(b.pk,self.a)
            self.assertEqual(s.earnings(self.b)['net_earned'],'40000')
            s.report_issue(b.pk,self.a,'Lesson issue')
            self.assertEqual(s.earnings(self.b)['net_earned'],'0')
            with self.assertRaises(Conflict):s.pay_out(b.pk,'x')
            s.resolve_issue(b.pk,'Resolved with both participants')
            self.assertEqual(s.earnings(self.b)['pending_payout'],'40000')

    def test_unpaid_is_not_earnings(self):
        self.reserve()
        self.assertEqual(s.earnings(self.b),dict.fromkeys(['gross','platform_fee','net_earned','pending_payout','paid'],'0'))

    def test_ownership_and_private_public_api(self):
        b=self.confirm(self.reserve());s.set_meeting(b.pk,self.b,'https://meet.google.com/abc-defg-hij')
        self.client.force_authenticate(self.c)
        self.assertEqual(self.client.get(f'/api/bookings/{b.pk}/').status_code,403)
        self.assertEqual(self.client.post(f'/api/bookings/{b.pk}/cancel/').status_code,403)
        public=self.client.get(f'/api/mentors/{self.b.pk}/').json()
        for field in ['email','learning_goals','meeting_url','payment_reference','mentor_net']:
            self.assertNotIn(field,public)
        self.client.force_authenticate(self.a)
        private=self.client.get(f'/api/bookings/{b.pk}/').json()
        self.assertEqual(private['meeting_url'],'https://meet.google.com/abc-defg-hij')

    def test_meeting_link_validation_and_payment_gating(self):
        b=self.reserve()
        with self.assertRaises(Conflict):s.set_meeting(b.pk,self.b,'https://meet.google.com/abc-defg-hij')
        self.confirm(b)
        with self.assertRaises(PermissionDenied):s.set_meeting(b.pk,self.a,'https://meet.google.com/abc-defg-hij')
        for url in ['http://meet.google.com/abc-defg-hij','https://meet.google.com.evil.test/abc-defg-hij','https://meet.google.com@evil.test/abc-defg-hij','https://meet.google.com/abc-defg-hij?x=1']:
            with self.assertRaises(ValidationError):s.set_meeting(b.pk,self.b,url)

    def test_schedule_editing_disabled(self):
        for rules in [[{'weekday':0,'start_time':'20:00','end_time':'18:00'}],[{'weekday':0,'start_time':'18:00','end_time':'20:00'},{'weekday':0,'start_time':'19:00','end_time':'21:00'}]]:
            self.assertEqual(self.client.put('/api/mentor/availability/',{'rules':rules,'blocked_dates':[]},format='json').status_code,405)
        self.assertEqual(self.client.get('/api/mentor/availability/').json()['mode'],'always_available')

    def test_clients_cannot_set_finances_or_approval(self):
        response=self.client.post('/api/bookings/',{'mentor_id':self.b.pk,'starts_at':START.isoformat(),'objective':'test','payment_status':'verified','total_price':'1','commission_rate':'0'},format='json')
        self.assertEqual(response.status_code,201)
        self.assertEqual(response.json()['payment_status'],'unpaid')
        self.assertEqual(response.json()['total_price'],'50000')
        self.assertEqual(self.client.post(f'/api/bookings/{response.json()["id"]}/verify/',{},format='json').status_code,404)

    def test_seed_idempotent(self):
        call_command('seed_demo',verbosity=0);count=User.objects.count()
        call_command('seed_demo',verbosity=0)
        self.assertEqual(User.objects.count(),count)
        self.assertFalse(User.objects.get(email='demo.sat@example.invalid').has_usable_password())

    def test_registration_application_preserves_account(self):
        self.client.force_authenticate(user=None)
        result=self.client.post('/api/auth/register/',{'email':'new@example.com','password':'Strong-Random-Password-826','full_name':'New Learner'},format='json')
        self.assertEqual(result.status_code,201)
        new=User.objects.get(email='new@example.com')
        self.client.force_authenticate(new)
        result=self.client.put('/api/mentor/settings/',{'headline':'SAT','bio':'Help','subjects':[Subject.objects.first().pk],'teaching_languages':'Uzbek','experience':'Experience','hourly_price':'50000','is_paused':False,'approval':'approved'},format='json')
        self.assertEqual(result.status_code,200)
        self.assertEqual(new.mentor.approval,'pending')
        self.assertEqual(self.client.get('/api/me/').json()['id'],new.pk)
        self.assertEqual(self.client.get('/api/bookings/').status_code,200)

    def test_avatar_rejects_svg_and_oversized(self):
        for f in [SimpleUploadedFile('x.svg',b'<svg></svg>',content_type='image/svg+xml'),SimpleUploadedFile('huge.png',b'x'*(2*1024*1024+1),content_type='image/png')]:
            response=self.client.patch('/api/me/',{'avatar':f},format='multipart')
            self.assertEqual(response.status_code,400)

    def test_csrf_required_for_login_and_authenticated_mutations(self):
        c=APIClient(enforce_csrf_checks=True)
        self.assertEqual(c.post('/api/auth/login/',{'email':self.a.email,'password':'Test-password-826!'},format='json').status_code,403)
        c.get('/api/auth/csrf/')
        token=c.cookies['csrftoken'].value
        response=c.post('/api/auth/login/',{'email':self.a.email,'password':'Test-password-826!'},format='json',HTTP_X_CSRFTOKEN=token)
        self.assertEqual(response.status_code,200)
        self.assertTrue(c.cookies['sessionid']['httponly'])
        self.assertEqual(c.patch('/api/me/',{'school':'x'},format='json').status_code,403)
        self.assertEqual(c.patch('/api/me/',{'school':'x'},format='json',HTTP_X_CSRFTOKEN=c.cookies['csrftoken'].value).status_code,200)


    def test_admin_operations_and_repeated_clicks(self):
        admin_user=User.objects.create_superuser('ops@example.com','Admin-Test-826!')
        client=APIClient();client.force_login(admin_user)
        b=self.reserve()
        url=f'/admin/core/booking/{b.pk}/operate/'
        for _ in range(2):
            response=client.post(url,{'operation':'verify','reference':'independently-checked'})
            self.assertEqual(response.status_code,302)
        b.refresh_from_db()
        self.assertEqual(b.status,'confirmed')
        self.assertEqual(b.receipt_reference,'independently-checked')
        self.assertContains(client.get(f'/admin/core/booking/{b.pk}/change/'),'Manual operations')
        with patch('core.services.timezone.now',return_value=START+timedelta(hours=2)):
            for _ in range(2):
                self.assertEqual(client.post(url,{'operation':'complete'}).status_code,302)
            for _ in range(2):
                self.assertEqual(client.post(url,{'operation':'payout','reference':'bank-transfer-1'}).status_code,302)
        b.refresh_from_db()
        self.assertEqual((b.payout_status,b.payout_reference),('paid','bank-transfer-1'))

    def test_admin_late_receipt_returns_409_and_persists_refund(self):
        admin_user=User.objects.create_superuser('ops@example.com','Admin-Test-826!')
        client=APIClient();client.force_login(admin_user)
        b=self.reserve()
        with patch('core.services.timezone.now',return_value=NOW+timedelta(hours=2)):
            response=client.post(f'/admin/core/booking/{b.pk}/operate/',{'operation':'verify','reference':'late-receipt'})
        self.assertEqual(response.status_code,409)
        b.refresh_from_db()
        self.assertEqual((b.status,b.payment_status),('expired','refund_required'))

    def test_admin_after_start_refund_resolution(self):
        b=self.confirm(self.reserve())
        with patch('core.services.timezone.now',return_value=START+timedelta(hours=2)):
            s.report_issue(b.pk,self.a,'Mentor absent')
            b=s.resolve_with_refund(b.pk,'Confirmed absence; full refund approved')
            b=s.refund(b.pk,'refund-transfer')
        self.assertEqual((b.status,b.payment_status,b.payout_status),('cancelled','refunded','not_eligible'))
        self.assertEqual(s.earnings(self.b)['net_earned'],'0')

    def test_avatar_reencoded_and_unknown_timezone_rejected(self):
        from PIL import Image
        buffer=BytesIO();Image.new('RGB',(20,20),'white').save(buffer,format='PNG')
        image=SimpleUploadedFile('original.png',buffer.getvalue(),content_type='image/png')
        response=self.client.patch('/api/me/',{'avatar':image},format='multipart')
        self.assertEqual(response.status_code,200)
        self.assertTrue(response.json()['profile']['avatar'].endswith('.jpg'))
        self.a.profile.refresh_from_db();self.a.profile.avatar.delete(save=False)
        self.assertEqual(self.client.patch('/api/me/',{'timezone':'invalid/zone'},format='json').status_code,400)


class ConcurrencyTests(TransactionTestCase):
    """Real concurrent connections: these MUST run on PostgreSQL, never SQLite."""
    def setUp(self):
        if connection.vendor != 'postgresql':
            self.skipTest('PostgreSQL required for actual row-lock/concurrency verification')
        self.a,self.b,self.c,self.d=people()
        self.start=s.candidate_slots(self.b.mentor)[0]

    def race(self,pairs):
        gate=Barrier(2)
        def worker(pair):
            close_old_connections()
            try:
                gate.wait(timeout=10)
                return ('ok',s.reserve(User.objects.get(pk=pair[0]),pair[1],self.start,'Concurrent test').pk)
            except Conflict:
                return ('conflict',None)
            finally:
                connections.close_all()
        with ThreadPoolExecutor(max_workers=2) as pool:
            result=list(pool.map(worker,pairs))
        self.assertCountEqual([r[0] for r in result],['ok','conflict'])
        self.assertEqual(Booking.objects.filter(status='pending_payment').count(),1)

    def test_concurrent_same_mentor_one_winner(self):
        self.race([(self.a.pk,self.b.pk),(self.c.pk,self.b.pk)])

    def test_concurrent_cross_role_one_winner(self):
        self.race([(self.a.pk,self.b.pk),(self.b.pk,self.c.pk)])

    def test_parallel_confirmation_is_idempotent(self):
        b=s.reserve(self.a,self.b.pk,self.start,'test')
        gate=Barrier(2)
        def worker(n):
            close_old_connections()
            try:
                gate.wait(timeout=10)
                return s.verify_payment(b.pk,f'receipt-{n}').status
            finally:
                connections.close_all()
        with ThreadPoolExecutor(max_workers=2) as pool:
            statuses=list(pool.map(worker,[1,2]))
        self.assertEqual(statuses,['confirmed','confirmed'])
        b.refresh_from_db()
        self.assertIn(b.receipt_reference,['receipt-1','receipt-2'])
        self.assertEqual(Booking.objects.count(),1)
