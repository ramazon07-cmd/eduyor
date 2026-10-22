from django.test import TestCase
from rest_framework.test import APIClient
from .models import User, MentorProfile


class ControlTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser('operator@example.invalid', 'Strong-test-password!')
        self.user = User.objects.create_user('student@example.invalid', 'Strong-test-password!')
        self.client = APIClient()
        self.mentor = MentorProfile.objects.create(user=self.user, headline='Test', bio='Bio', teaching_languages='Uzbek', hourly_price=30000)

    def test_ordinary_user_cannot_enter_or_read(self):
        response = self.client.post('/api/control/login/', {'email': self.user.email, 'password': 'Strong-test-password!'})
        self.assertEqual(response.status_code, 400)
        self.client.force_login(self.user)
        for path in ['me', 'summary', 'mentors', 'bookings', 'users']:
            self.assertEqual(self.client.get(f'/api/control/{path}/').status_code, 403)
        self.assertEqual(self.client.post(f'/api/control/mentors/{self.mentor.pk}/', {'action':'approve'}).status_code, 403)

    def test_admin_login_review_and_stale_review(self):
        self.assertEqual(self.client.post('/api/control/login/', {'email': self.admin.email, 'password':'Strong-test-password!'}).status_code, 200)
        response = self.client.get('/api/control/mentors/')
        self.assertEqual(response['Cache-Control'], 'private, no-store')
        version = response.data['results'][0]['version']
        url = f'/api/control/mentors/{self.mentor.pk}/'
        self.assertEqual(self.client.post(url, {'action':'approve', 'version':version}).status_code, 200)
        self.assertEqual(self.client.post(url, {'action':'reject', 'version':version}).status_code, 409)
        self.mentor.refresh_from_db()
        self.assertEqual(self.mentor.approval, 'approved')
        self.assertEqual(self.client.delete('/api/control/me/').status_code, 200)
        self.assertEqual(self.client.get('/api/control/users/').status_code, 403)

    def test_login_csrf_required(self):
        client = APIClient(enforce_csrf_checks=True)
        self.assertEqual(client.post('/api/control/login/', {'email':self.admin.email,'password':'Strong-test-password!'}).status_code, 403)
        client.get('/api/auth/csrf/')
        csrf = client.cookies['csrftoken'].value
        self.assertEqual(client.post('/api/control/login/', {'email':self.admin.email,'password':'Strong-test-password!'}, HTTP_X_CSRFTOKEN=csrf).status_code, 200)

    def test_staff_without_superuser_cannot_access(self):
        self.user.is_staff = True
        self.user.save()
        self.client.force_login(self.user)
        self.assertEqual(self.client.get('/api/control/summary/').status_code, 403)

