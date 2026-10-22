from importlib import import_module
from types import SimpleNamespace

from django.apps import apps
from django.db import connection
from django.test import TestCase
from rest_framework.test import APIClient

from .models import MentorProfile, Subject, User


class DirectionTests(TestCase):
    def test_migration_seeds_four_directions_without_demo_accounts(self):
        self.assertEqual(Subject.objects.count(), 4)
        self.assertFalse(User.objects.exists())
        self.assertEqual(APIClient().get('/api/subjects/').json(), [
            {'id': Subject.objects.get(name=name).pk, 'name': label}
            for name, label in [('SAT', 'SAT'), ('IELTS', 'IELTS'),
                                ('Mathematics', 'Matematika'), ('University Admissions', 'Admission')]
        ])

    def test_reapplying_seed_preserves_ids_and_existing_mentor_links(self):
        subject = Subject.objects.get(name='Mathematics')
        user = User.objects.create_user('mentor@example.invalid', None)
        mentor = MentorProfile.objects.create(user=user, headline='Tajribali mentor', bio='Tajriba',
                                             hourly_price=30000, teaching_languages='O‘zbekcha', approval='approved')
        mentor.subjects.add(subject)
        Subject.objects.create(name='English')
        seed = import_module('core.migrations.0005_default_directions').create_directions
        seed(apps, SimpleNamespace(connection=connection))
        self.assertEqual(mentor.subjects.get().pk, subject.pk)
        response = APIClient().get('/api/subjects/').json()
        self.assertEqual(len(response), 4)
        self.assertEqual(response[2], {'id': subject.pk, 'name': 'Matematika'})
        rows = APIClient().get('/api/mentors/', {'subject': subject.pk}).json()['results']
        self.assertEqual([row['id'] for row in rows], [user.pk])
        rows = APIClient().get('/api/mentors/', {'search': 'matematika'}).json()['results']
        self.assertEqual([row['id'] for row in rows], [user.pk])
