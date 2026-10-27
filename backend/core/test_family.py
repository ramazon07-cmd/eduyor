from datetime import timedelta
from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient
from .models import User, Booking, Assignment, Submission
from . import services


def make_user(email, name, account_type='student'):
    user = User.objects.create_user(email, None)
    user.profile.full_name = name
    user.profile.account_type = account_type
    user.profile.save()
    return user


def lesson(student, mentor, starts_at, **extra):
    return Booking.objects.create(student=student, mentor=mentor, starts_at=starts_at, ends_at=starts_at+timedelta(minutes=50), expires_at=extra.pop('expires_at', starts_at), objective=extra.pop('objective', 'Algebra'), total_price=30000, platform_fee=9000, mentor_net=21000, **extra)


class FamilyTests(TestCase):
    def setUp(self):
        cache.clear()
        self.now = timezone.now()
        self.parent = make_user('parent@family.test', 'Parent One', 'parent')
        self.child = make_user('child@family.test', 'Child One')
        self.mentor = make_user('mentor@family.test', 'Mentor Math')
        self.client = APIClient()

    def as_user(self, user):
        self.client.force_authenticate(user)
        return self.client

    def invite_code(self):
        result = self.as_user(self.parent).post('/api/family/invite/', {}, format='json')
        self.assertEqual(result.status_code, 200, result.content)
        return result.json()['code']

    def link_child(self, child=None):
        code = self.invite_code()
        result = self.as_user(child or self.child).post('/api/family/join/', {'code': code}, format='json')
        self.assertEqual(result.status_code, 201, result.content)
        return result.json()

    def test_registration_stores_account_type_and_profile_edit_cannot_change_it(self):
        client = APIClient()
        result = client.post('/api/auth/register/', {'email': 'mum@example.com', 'password': 'Strong-Random-Password-826', 'full_name': 'Mum', 'account_type': 'parent'}, format='json')
        self.assertEqual(result.status_code, 201, result.content)
        self.assertEqual(result.json()['profile']['account_type'], 'parent')
        client.patch('/api/me/', {'account_type': 'student'}, format='json')
        self.assertEqual(User.objects.get(email='mum@example.com').profile.account_type, 'parent')
        result = APIClient().post('/api/auth/register/', {'email': 'kid@example.com', 'password': 'Strong-Random-Password-826', 'full_name': 'Kid'}, format='json')
        self.assertEqual(result.json()['profile']['account_type'], 'student')

    def test_only_parent_accounts_get_invite_codes(self):
        self.assertEqual(self.as_user(self.child).post('/api/family/invite/', {}, format='json').status_code, 403)

    def test_invite_code_is_reused_until_a_child_redeems_it(self):
        first = self.invite_code()
        self.assertEqual(self.invite_code(), first)
        self.as_user(self.child).post('/api/family/join/', {'code': first}, format='json')
        self.assertNotEqual(self.invite_code(), first)

    def test_join_accepts_lowercase_code_with_separator_and_lists_both_sides(self):
        code = self.invite_code()
        result = self.as_user(self.child).post('/api/family/join/', {'code': f' {code[:4].lower()}-{code[4:]} '}, format='json')
        self.assertEqual(result.status_code, 201, result.content)
        self.assertEqual([p['full_name'] for p in result.json()['parents']], ['Parent One'])
        family = self.as_user(self.parent).get('/api/family/').json()
        self.assertEqual([(c['id'], c['full_name']) for c in family['children']], [(self.child.pk, 'Child One')])
        self.assertIsNone(family['invite'])

    def test_code_cannot_be_redeemed_twice_guessed_or_used_by_parent_account(self):
        code = self.invite_code()
        other_parent = make_user('other-parent@family.test', 'Other Parent', 'parent')
        self.assertEqual(self.as_user(other_parent).post('/api/family/join/', {'code': code}, format='json').status_code, 400)
        self.assertEqual(self.as_user(self.child).post('/api/family/join/', {'code': 'ZZZZ9999'}, format='json').status_code, 400)
        self.assertEqual(self.as_user(self.child).post('/api/family/join/', {'code': code}, format='json').status_code, 201)
        sibling = make_user('sibling@family.test', 'Sibling')
        self.assertEqual(self.as_user(sibling).post('/api/family/join/', {'code': code}, format='json').status_code, 400)
        second_code = self.invite_code()
        self.assertEqual(self.as_user(self.child).post('/api/family/join/', {'code': second_code}, format='json').status_code, 400)

    def test_parent_sees_child_progress_without_private_lesson_or_answer_data(self):
        self.link_child()
        stranger = make_user('stranger@family.test', 'Stranger')
        done = lesson(self.child, self.mentor, self.now-timedelta(days=3), status='completed', payment_status='verified')
        upcoming = lesson(self.child, self.mentor, self.now+timedelta(days=2), status='confirmed', payment_status='verified', meeting_url='https://meet.google.com/abc-defg-hij')
        hold = lesson(self.child, self.mentor, self.now+timedelta(days=3), expires_at=self.now+timedelta(hours=1))
        lesson(self.child, self.mentor, self.now+timedelta(days=4), expires_at=self.now-timedelta(hours=1))
        lesson(stranger, self.mentor, self.now+timedelta(days=2), status='confirmed', payment_status='verified')
        task = dict(mentor=self.mentor, student=self.child, instructions='Solve.')
        reviewed = Assignment.objects.create(**task, title='Fractions', kind='homework', deadline=self.now-timedelta(days=1))
        Submission.objects.create(assignment=reviewed, answer='my private answer', feedback='Good work', reviewed_at=self.now)
        test = Assignment.objects.create(**task, title='Quiz', kind='test', deadline=self.now+timedelta(days=1), questions=[{'prompt': '2+2', 'options': ['3', '4'], 'correct': 1}, {'prompt': '3+2', 'options': ['5', '6'], 'correct': 0}])
        Submission.objects.create(assignment=test, answers=[1, 1], reviewed_at=self.now)
        todo = Assignment.objects.create(**task, title='Essay', kind='homework', deadline=self.now+timedelta(days=2))
        Assignment.objects.create(mentor=self.mentor, student=stranger, instructions='x', title='Not yours', kind='homework', deadline=self.now+timedelta(days=5))

        result = self.as_user(self.parent).get(f'/api/family/children/{self.child.pk}/')
        self.assertEqual(result.status_code, 200, result.content)
        data = result.json()
        self.assertEqual(data['child']['full_name'], 'Child One')
        self.assertEqual(data['lessons'], {'completed': 1, 'upcoming': 2, 'awaiting_payment': 1})
        self.assertEqual([row['id'] for row in data['upcoming']], [upcoming.pk, hold.pk])
        self.assertEqual([row['id'] for row in data['recent']], [done.pk])
        self.assertEqual(data['upcoming'][0]['mentor_name'], 'Mentor Math')
        self.assertEqual(data['tasks'], {'total': 3, 'submitted': 2, 'reviewed': 2})
        self.assertEqual([row['id'] for row in data['assignments']], [todo.pk, test.pk, reviewed.pk])
        self.assertIsNone(data['assignments'][0]['submission'])
        self.assertEqual((data['assignments'][1]['submission']['correct_answers'], data['assignments'][1]['question_count']), (1, 2))
        self.assertEqual(data['assignments'][2]['submission']['feedback'], 'Good work')
        body = result.content.decode()
        for private in ['meet.google.com', 'my private answer', 'payment_reference', '"correct"', 'child@family.test']:
            self.assertNotIn(private, body)

    def test_parent_account_cannot_book_lessons_under_its_own_name(self):
        # A booking from the parent account would never appear in the child's progress.
        with self.assertRaises(ValidationError):
            services.reserve(self.parent, self.mentor.pk, self.now+timedelta(days=2), 'For my child')
        self.assertFalse(Booking.objects.filter(student=self.parent).exists())

    def test_progress_is_only_visible_to_a_linked_parent(self):
        self.link_child()
        other_parent = make_user('other-parent@family.test', 'Other Parent', 'parent')
        for user in [other_parent, self.mentor, self.child]:
            self.assertEqual(self.as_user(user).get(f'/api/family/children/{self.child.pk}/').status_code, 404)

    def test_child_can_unlink_and_parent_loses_access(self):
        link = self.link_child()['parents'][0]['link']
        self.assertEqual(self.as_user(self.mentor).delete(f'/api/family/links/{link}/').status_code, 404)
        self.assertEqual(self.as_user(self.child).delete(f'/api/family/links/{link}/').status_code, 204)
        self.assertEqual(self.as_user(self.parent).get(f'/api/family/children/{self.child.pk}/').status_code, 404)
        self.assertEqual(self.as_user(self.child).get('/api/family/').json()['parents'], [])
