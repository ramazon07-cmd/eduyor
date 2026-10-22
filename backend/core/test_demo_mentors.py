import tempfile
from pathlib import Path

from django.core.management import call_command
from django.test import TestCase, override_settings
from PIL import Image
from rest_framework.test import APIClient

from .management.commands.seed_demo import DEMO_MENTORS, DEMO_NOTICE
from .models import User, Subject


class DemoMentorTests(TestCase):
    def setUp(self):
        self.media = tempfile.TemporaryDirectory()
        self.addCleanup(self.media.cleanup)
        settings = override_settings(MEDIA_ROOT=self.media.name)
        settings.enable()
        self.addCleanup(settings.disable)

    def test_every_direction_has_one_public_demo_with_real_image(self):
        call_command('seed_demo', verbosity=0)
        self.assertEqual(User.objects.filter(email__startswith='demo.').count(), 6)
        for key, name, _, direction, _, _ in DEMO_MENTORS:
            with self.subTest(direction=direction):
                user = User.objects.get(email=f'demo.{key}@example.invalid')
                self.assertEqual(user.profile.full_name, name)
                self.assertEqual(len(name.split()), 2)
                self.assertFalse(user.has_usable_password())
                self.assertTrue(user.profile.avatar)
                with Image.open(user.profile.avatar.path) as portrait:
                    portrait.verify()
                self.assertIn(DEMO_NOTICE, user.mentor.bio)
                result = APIClient().get('/api/mentors/', {'subject': Subject.objects.get(name=direction).pk}).json()
                self.assertEqual(result['count'], 1)
                self.assertEqual(result['results'][0]['id'], user.pk)
                self.assertTrue(result['results'][0]['is_demo'])
                detail = APIClient().get(f'/api/mentors/{user.pk}/').json()
                self.assertEqual(detail['avatar'], result['results'][0]['avatar'])
                self.assertTrue(detail['avatar'])

    def test_repeat_preserves_edits_and_refresh_only_updates_demo_accounts(self):
        call_command('seed_demo', verbosity=0)
        user = User.objects.get(email='demo.sat@example.invalid')
        original_id, avatar = user.pk, user.profile.avatar.name
        profile = user.profile
        profile.full_name = 'Edited Demo'
        profile.save()
        normal = User.objects.create_user('actual@example.invalid', 'Existing-Password-123')
        normal.profile.full_name = 'Existing Person'
        normal.profile.save()
        before = set(Path(self.media.name).rglob('*.jpg'))
        call_command('seed_demo', verbosity=0)
        profile.refresh_from_db()
        self.assertEqual(profile.full_name, 'Edited Demo')
        call_command('seed_demo', refresh_demo_profiles=True, verbosity=0)
        user.refresh_from_db()
        profile.refresh_from_db()
        normal.profile.refresh_from_db()
        self.assertEqual(user.pk, original_id)
        self.assertEqual(profile.full_name, 'Azizbek Karimov')
        self.assertEqual(profile.avatar.name, avatar)
        self.assertEqual(set(Path(self.media.name).rglob('*.jpg')), before)
        self.assertEqual(normal.profile.full_name, 'Existing Person')
        self.assertTrue(normal.has_usable_password())
        self.assertEqual(User.objects.count(), 7)
