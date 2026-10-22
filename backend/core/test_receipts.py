from io import BytesIO
from unittest.mock import patch
from datetime import timedelta
from PIL import Image
from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from .models import User, MentorProfile, PaymentReceipt
from .tests import NOW, START
from . import services


class ReceiptTests(TestCase):
    def setUp(self):
        self.clock = patch('core.services.timezone.now', return_value=NOW)
        self.clock.start()
        self.addCleanup(self.clock.stop)
        self.student = User.objects.create_user('receipt-student@example.invalid', None)
        self.teacher = User.objects.create_user('receipt-mentor@example.invalid', None)
        self.other = User.objects.create_user('receipt-other@example.invalid', None)
        self.admin = User.objects.create_superuser('receipt-admin@example.invalid', None)
        MentorProfile.objects.create(user=self.teacher, headline='SAT', bio='Bio', hourly_price=30000, teaching_languages='English', approval='approved')
        self.booking = services.reserve(self.student, self.teacher.pk, START, 'Test')
        self.url = f'/api/control/receipts/{self.booking.pk}/'
        self.client = APIClient()
        self.client.force_login(self.student)

    def image(self):
        output = BytesIO()
        Image.new('RGB', (120, 180), 'white').save(output, 'PNG')
        return SimpleUploadedFile('check.png', output.getvalue(), content_type='image/png')

    def upload(self):
        response = self.client.post(self.url, {'receipt':self.image()}, format='multipart')
        self.assertEqual(response.status_code, 200, response.content)
        return response.data['digest']

    def test_upload_private_view_and_approve(self):
        digest = self.upload()
        self.booking.refresh_from_db()
        self.assertEqual(self.booking.payment_status, 'submitted')
        response = self.client.get(self.url)
        self.assertEqual(response['Content-Type'], 'image/jpeg')
        self.assertEqual(response['Cache-Control'], 'private, no-store')
        for user in [self.teacher, self.other]:
            self.client.force_login(user)
            self.assertEqual(self.client.get(self.url).status_code, 403)
            self.assertEqual(self.client.post(self.url, {'receipt':self.image()}).status_code, 403)
        self.client.force_login(self.admin)
        self.assertEqual(self.client.get(self.url).status_code, 200)
        queue = self.client.get('/api/control/bookings/').data['results'][0]
        self.assertEqual(queue['receipt_digest'], digest)
        approve = f'/api/control/bookings/{self.booking.pk}/'
        self.assertEqual(self.client.post(approve, {'action':'verify','receipt_digest':'stale'}).status_code,409)
        response = self.client.post(approve, {'action':'verify','receipt_digest':digest})
        self.assertEqual(response.status_code,200,response.data)
        self.assertEqual(response.data['payment_status'],'verified')
        self.assertEqual(response.data['status'],'confirmed')
        self.assertEqual(self.client.post(approve, {'action':'verify','receipt_digest':digest}).data['payment_status'],'verified')

    def test_invalid_file_and_missing_file_do_not_submit(self):
        self.assertEqual(self.client.post(self.url, {}).status_code,400)
        self.assertEqual(self.client.post(self.url, {'receipt':SimpleUploadedFile('fake.png',b'not an image')}).status_code,400)
        self.booking.refresh_from_db()
        self.assertEqual(self.booking.payment_status,'unpaid')
        self.assertFalse(PaymentReceipt.objects.exists())

    def test_expired_approval_requires_refund(self):
        digest = self.upload()
        self.client.force_login(self.admin)
        with patch('core.services.timezone.now', return_value=NOW+timedelta(hours=1)):
            response = self.client.post(f'/api/control/bookings/{self.booking.pk}/', {'action':'verify','receipt_digest':digest})
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.data['payment_status'],'refund_required')
        self.assertNotEqual(response.data['status'],'confirmed')
