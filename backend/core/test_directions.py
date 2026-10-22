from importlib import import_module
from types import SimpleNamespace

from django.apps import apps
from django.db import connection
from django.test import TestCase
from rest_framework.test import APIClient

from .models import MentorProfile, Subject, User


class DirectionTests(TestCase):
    def test_migration_seeds_six_directions_without_demo_accounts(self):
        self.assertEqual(Subject.objects.count(), 6)
        self.assertFalse(User.objects.exists())
        self.assertEqual(APIClient().get('/api/subjects/').json(), [
            {'id': Subject.objects.get(name=name).pk, 'name': label}
            for name, label in [('SAT', 'SAT'), ('IELTS', 'IELTS'),
                                ('Mathematics', 'Matematika'), ('University Admissions', 'Admissions'),
                                ('International Programs', 'International Programs'), ('Chinese', 'Xitoy tili')]
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
        self.assertEqual(len(response), 6)
        self.assertEqual(response[2], {'id': subject.pk, 'name': 'Matematika'})
        rows = APIClient().get('/api/mentors/', {'subject': subject.pk}).json()['results']
        self.assertEqual([row['id'] for row in rows], [user.pk])
        rows = APIClient().get('/api/mentors/', {'search': 'matematika'}).json()['results']
        self.assertEqual([row['id'] for row in rows], [user.pk])

    def test_new_directions_have_independent_filters_and_counts(self):
        users = {}
        for index, name in enumerate(('University Admissions', 'International Programs', 'Chinese')):
            user = User.objects.create_user(f'direction{index}@example.invalid', None)
            mentor = MentorProfile.objects.create(user=user, headline=name, bio='Experience',
                                                 hourly_price=30000, teaching_languages='English', approval='approved')
            mentor.subjects.add(Subject.objects.get(name=name))
            users[name] = user.pk
        client = APIClient()
        for name, user_id in users.items():
            with self.subTest(direction=name):
                data = client.get('/api/mentors/', {'subject': Subject.objects.get(name=name).pk}).json()
                self.assertEqual(data['count'], 1)
                self.assertEqual([row['id'] for row in data['results']], [user_id])
        for query in ('Xitoy tili', 'Chinese', 'Китайский язык'):
            self.assertEqual(client.get('/api/mentors/', {'search': query}).json()['count'], 1)
        self.assertEqual(client.get('/api/mentors/', {'search': 'Международные программы'}).json()['results'][0]['id'], users['International Programs'])
        self.assertEqual(client.get('/api/mentors/', {'search': 'Поступление'}).json()['results'][0]['id'], users['University Admissions'])

    def test_new_seed_preserves_existing_admissions_links_and_is_idempotent(self):
        admissions = Subject.objects.get(name='University Admissions')
        user = User.objects.create_user('admissions@example.invalid', None)
        mentor = MentorProfile.objects.create(user=user, headline='Admissions', bio='Experience',
                                             hourly_price=30000, teaching_languages='English', approval='approved')
        mentor.subjects.add(admissions)
        before = dict(Subject.objects.values_list('name', 'pk'))
        seed = import_module('core.migrations.0007_expand_directions').create_directions
        for _ in range(2):
            seed(apps, SimpleNamespace(connection=connection))
        self.assertEqual(dict(Subject.objects.values_list('name', 'pk')), before)
        self.assertEqual(list(mentor.subjects.values_list('pk', flat=True)), [admissions.pk])
