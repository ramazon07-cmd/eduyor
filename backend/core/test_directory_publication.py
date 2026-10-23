import hashlib
import json
import tempfile
from pathlib import Path

from django.core.management import call_command
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import DirectoryPublication, MentorProfile, User
from .subjects import SUBJECT_LABELS


RELEASE = json.loads((Path(__file__).parent / 'directory_releases/v1.json').read_text())


class DirectoryPublicationTests(TestCase):
    def test_fresh_deployment_matches_every_public_field_and_photo_without_media_disk(self):
        call_command('publish_mentor_directory')
        client = APIClient()
        with tempfile.TemporaryDirectory() as media, override_settings(MEDIA_ROOT=media, DEBUG=False):
            rows = client.get('/api/mentors/').json()
            self.assertEqual(rows['count'], 7)
            by_name = {row['full_name']:row for row in rows['results']}
            for expected in RELEASE['mentors']:
                row = by_name[expected['profile']['full_name']]
                for field, value in expected['profile'].items():
                    self.assertEqual(row[field], value)
                for field in ('headline', 'hourly_price', 'teaching_languages'):
                    self.assertEqual(row[field], expected['mentor'][field])
                bio = '\n\n'.join(v.strip() for v in (expected['mentor']['bio'], expected['mentor']['experience']) if v.strip())
                self.assertEqual(row['bio'], bio)
                self.assertEqual(sorted(s['name'] for s in row['subjects']), sorted(
                    SUBJECT_LABELS.get(name, name)
                    for name in expected['subjects']
                ))
                self.assertEqual(row['avatar'], '/media/' + expected['avatar'])
                response = client.get(row['avatar'])
                self.assertEqual(response.status_code, 200)
                content = b''.join(response.streaming_content)
                self.assertEqual(hashlib.sha256(content).hexdigest(), expected['avatar_sha256'])
                mentor = MentorProfile.objects.get(user_id=row['id'])
                self.assertEqual(mentor.availability.count(), len(expected['availability']))
                self.assertFalse(mentor.user.has_usable_password())

    def test_existing_seed_ids_credentials_and_bookings_identity_are_preserved(self):
        call_command('seed_peer_mentors', apply=True)
        sat = User.objects.get(email='peer.akbarshoh@example.invalid')
        sat.set_password('existing-test-password')
        sat.save()
        original_id = sat.pk
        real_user = User.objects.create_user('unrelated@example.invalid', 'test-password')
        call_command('publish_mentor_directory')
        sat.refresh_from_db()
        self.assertEqual(sat.pk, original_id)
        self.assertTrue(sat.check_password('existing-test-password'))
        self.assertEqual(sat.profile.full_name, 'Akbarshoh Turobov')
        self.assertTrue(User.objects.filter(pk=real_user.pk).exists())
        self.assertTrue(MentorProfile.objects.get(user__email='demo.peer.mathematics@example.invalid').is_paused)
        self.assertEqual(APIClient().get('/api/mentors/').json()['count'], 7)
        sat.profile.full_name = 'Later admin edit'
        sat.profile.save()
        call_command('publish_mentor_directory')
        sat.profile.refresh_from_db()
        self.assertEqual(sat.profile.full_name, 'Later admin edit')
        self.assertEqual(DirectoryPublication.objects.count(), 1)

    def test_missing_photo_rolls_back_publication_so_deployment_can_retry(self):
        from unittest.mock import patch
        with patch('core.directory_publication.Path.read_bytes', side_effect=FileNotFoundError):
            with self.assertRaises(FileNotFoundError):
                call_command('publish_mentor_directory')
        self.assertFalse(DirectoryPublication.objects.exists())
        self.assertFalse(User.objects.exists())
