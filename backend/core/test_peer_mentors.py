import tempfile
from io import BytesIO
from pathlib import Path
from django.core.management import call_command
from django.test import TestCase, override_settings
from PIL import Image
from rest_framework.test import APIClient
from .models import User, Subject
from .subjects import SUBJECT_NAMES
from .peer_mentors import PEER_MENTORS, ASSET_DIR

class PeerMentorTests(TestCase):
    def setUp(self):
        for name in SUBJECT_NAMES:
            Subject.objects.get_or_create(name=name)
        self.media=tempfile.TemporaryDirectory()
        self.addCleanup(self.media.cleanup)
        config=override_settings(MEDIA_ROOT=self.media.name)
        config.enable();self.addCleanup(config.disable)

    def test_dry_run_makes_no_accounts_and_apply_covers_every_subject(self):
        call_command('seed_peer_mentors')
        self.assertEqual(User.objects.count(),0)
        call_command('seed_peer_mentors',apply=True)
        client=APIClient()
        for p in PEER_MENTORS:
            result=client.get('/api/mentors/',{'subject':Subject.objects.get(name=p['subject']).pk}).json()
            self.assertEqual(result['count'],1)
            row=result['results'][0]
            self.assertEqual(row['full_name'],p['name'])
            self.assertEqual(row['study_level'],'High school student')
            self.assertGreater(len(row['bio']),400)
            response=client.get(f"/media/avatars/curated/{p['key']}-v1.jpg")
            self.assertEqual(response.status_code,200)
            with Image.open(BytesIO(b''.join(response.streaming_content))) as image:
                self.assertEqual(image.format,'JPEG')
                self.assertLessEqual(max(image.size),600)
            self.assertFalse(User.objects.get(pk=row['id']).has_usable_password())

    def test_repeat_preserves_operator_edits_and_unrelated_profiles(self):
        original=User.objects.create_user('actual@example.invalid',None)
        call_command('seed_peer_mentors',apply=True)
        first=User.objects.get(email='demo.peer.ielts@example.invalid')
        first.profile.full_name='Operator edited';first.profile.save()
        count=User.objects.count()
        call_command('seed_peer_mentors',apply=True)
        first.refresh_from_db()
        self.assertEqual(first.profile.full_name,'Operator edited')
        self.assertEqual(User.objects.count(),count)
        self.assertTrue(User.objects.filter(pk=original.pk).exists())

    def test_media_does_not_expose_unrelated_files(self):
        client=APIClient()
        self.assertEqual(client.get('/media/avatars/curated/nonexistent.jpg').status_code,404)
        self.assertEqual(client.get('/media/avatars/curated/README.md').status_code,404)
        self.assertEqual(client.get('/media/avatars/curated/../peer_mentors.py').status_code,404)
