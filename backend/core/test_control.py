from django.test import TestCase
from rest_framework.test import APIClient
from .models import User, MentorProfile, Profile, LearningCenter


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
        for path in ['me', 'summary', 'mentors', 'bookings', 'users', 'centers']:
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

    def test_users_without_profiles_do_not_break_listing_or_search(self):
        Profile.objects.filter(user=self.user).delete()
        self.client.force_login(self.admin)
        response = self.client.get('/api/control/users/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 2)
        row = next(row for row in response.data['results'] if row['id'] == self.user.pk)
        self.assertEqual(row['name'], '')
        response = self.client.get('/api/control/users/', {'search': 'student@'})
        self.assertEqual([row['id'] for row in response.data['results']], [self.user.pk])
        Profile.objects.filter(user=self.admin).delete()
        self.assertEqual(self.client.get('/api/control/me/').status_code, 200)
        self.assertEqual(self.client.get('/api/control/mentors/').status_code, 200)

    def test_center_review_permissions_publication_filters_and_stale_version(self):
        center = LearningCenter.objects.create(owner=self.user, name='Test Center', kind='online', description='Math classes', invite_code='ABCD2345')
        url = f'/api/control/centers/{center.pk}/'
        self.client.force_login(self.user)
        self.assertEqual(self.client.post(url, {'action': 'approve'}).status_code, 403)
        self.client.force_login(self.admin)
        self.assertEqual(self.client.get('/api/control/summary/').data['centers'], 1)
        row = self.client.get('/api/control/centers/').data['results'][0]
        self.assertNotIn('invite_code', row)
        self.assertEqual(self.client.post(url, {'action': 'pause', 'version': row['version']}).status_code, 400)
        self.assertEqual(self.client.post(url, {'action': 'approve', 'version': row['version']}).status_code, 200)
        self.assertEqual(self.client.get('/api/control/centers/').data['count'], 0)
        self.assertEqual(self.client.get('/api/control/centers/?state=approved').data['count'], 1)
        self.assertEqual(APIClient().get(f'/api/centers/{center.pk}/').status_code, 200)
        self.assertEqual(self.client.post(url, {'action': 'reject', 'version': row['version']}).status_code, 409)
        row = self.client.get('/api/control/centers/?state=all').data['results'][0]
        LearningCenter.objects.filter(pk=center.pk).update(description='Updated classes', approval='pending')
        self.assertEqual(self.client.post(url, {'action': 'approve', 'version': row['version']}).status_code, 409)
        row = self.client.get('/api/control/centers/').data['results'][0]
        self.assertEqual(self.client.post(url, {'action': 'reject', 'version': row['version']}).status_code, 200)
        self.assertEqual(self.client.get('/api/control/centers/?state=rejected').data['count'], 1)
        self.assertEqual(APIClient().get(f'/api/centers/{center.pk}/').status_code, 404)

