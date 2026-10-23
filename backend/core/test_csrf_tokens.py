from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from .models import User

class CsrfTokenTests(TestCase):
    @override_settings(CSRF_COOKIE_NAME='eduyor_production_preview_csrf')
    def test_custom_cookie_token_registers_and_rotates_on_login(self):
        client=APIClient(enforce_csrf_checks=True)
        token=client.get('/api/auth/csrf/').json()['csrfToken']
        response=client.post('/api/auth/register/',{'full_name':'Test Student','email':'csrf.student@example.invalid','password':'Test-Student-Strong-2098'},format='json',HTTP_X_CSRFTOKEN=token)
        self.assertEqual(response.status_code,201,response.content)
        self.assertTrue(User.objects.filter(email='csrf.student@example.invalid').exists())
        # Authentication rotated the cookie; old token must fail without changing profile.
        response=client.patch('/api/me/',{'school':'Changed'},format='json',HTTP_X_CSRFTOKEN=token)
        self.assertEqual(response.status_code,403)
        self.assertEqual(response.json()['code'],'csrf_failed')
        fresh=client.get('/api/auth/csrf/')
        self.assertIn('no-store',fresh['Cache-Control'])
        response=client.patch('/api/me/',{'school':'Changed'},format='json',HTTP_X_CSRFTOKEN=fresh.json()['csrfToken'])
        self.assertEqual(response.status_code,200,response.content)
