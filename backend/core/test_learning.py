from datetime import timedelta
from unittest.mock import patch
from django.test import TestCase, TransactionTestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from .models import User, MentorProfile, Assignment, Submission, Booking, LearningRateLimit


class LearningTests(TestCase):
    def setUp(self):
        self.now = timezone.now()
        self.mentor = User.objects.create_user('mentor@learning.test', None, first_name='Mentor')
        self.student = User.objects.create_user('student@learning.test', None, first_name='Student')
        self.other = User.objects.create_user('other@learning.test', None)
        self.profile = MentorProfile.objects.create(user=self.mentor, headline='Math', bio='Math', hourly_price=30000, approval='approved')
        self.booking = Booking.objects.create(mentor=self.mentor, student=self.student, starts_at=self.now+timedelta(days=2), ends_at=self.now+timedelta(days=2, minutes=50), expires_at=self.now+timedelta(hours=1), objective='Math', total_price=30000, platform_fee=9000, mentor_net=21000, status='confirmed', payment_status='verified')
        self.client = APIClient()
        self.client.force_authenticate(self.mentor)
        self.payload = dict(student=self.student.pk, title='Algebra', instructions='Solve the problems.', kind='homework', deadline=(self.now+timedelta(days=3)).isoformat())

    def create_task(self, **changes):
        data = {**self.payload, **changes}
        result = self.client.post('/api/assignments/', data, format='json')
        self.assertEqual(result.status_code, 201, result.content)
        return result.json()

    def test_homework_full_flow_and_private_results(self):
        task = self.create_task()
        self.client.force_authenticate(self.student)
        listing = self.client.get('/api/assignments/').json()['results']
        self.assertEqual(listing[0]['id'], task['id'])
        self.assertIsNone(listing[0]['submission'])
        result = self.client.post(f"/api/assignments/{task['id']}/submit/", {'answer': 'x = 4', 'score': 100}, format='json')
        self.assertEqual(result.status_code, 201, result.content)
        self.assertNotIn('score', result.json()['submission'])
        self.assertIsNone(result.json()['submission']['reviewed_at'])
        self.client.force_authenticate(self.mentor)
        result = self.client.post(f"/api/assignments/{task['id']}/review/", {'feedback': 'Show each step.', 'expected_reviewed_at': None}, format='json')
        self.assertEqual(result.status_code, 200, result.content)
        self.client.force_authenticate(self.student)
        row = self.client.get(f"/api/assignments/{task['id']}/").json()
        self.assertNotIn('score', row['submission'])
        self.assertNotIn('max_score', row)
        self.assertIsNotNone(row['submission']['reviewed_at'])
        self.assertEqual(row['submission']['feedback'], 'Show each step.')
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get('/api/assignments/').json()['results'], [])
        for action in ['review', 'submit']:
            result = self.client.post(f"/api/assignments/{task['id']}/{action}/", {'expected_reviewed_at': None, 'answer': 'x'}, format='json')
            self.assertEqual(result.status_code, 404)

    def test_answer_checks_without_scores_and_hidden_answer_key(self):
        task = self.create_task(kind='test', questions=[dict(prompt='2 + 2?', options=['3', '4'], correct=1), dict(prompt='3 + 2?', options=['5', '6'], correct=0)])
        self.assertEqual(task['questions'][0]['correct'], 1)
        self.client.force_authenticate(self.student)
        self.assertNotIn('correct', self.client.get(f"/api/assignments/{task['id']}/").json()['questions'][0])
        result = self.client.post(f"/api/assignments/{task['id']}/submit/", {'answers': [1, 1], 'score': 75}, format='json')
        self.assertEqual(result.status_code, 201, result.content)
        self.assertNotIn('score', result.json()['submission'])
        self.assertNotIn('max_score', result.json())
        self.assertEqual(result.json()['submission']['answer_checks'], [True, False])
        self.assertNotIn('correct', result.json()['questions'][0])
        self.assertIsNotNone(result.json()['submission']['reviewed_at'])
        self.client.force_authenticate(self.mentor)
        self.assertEqual(self.client.post(f"/api/assignments/{task['id']}/review/", {'feedback': 'Reviewed', 'expected_reviewed_at': None}, format='json').status_code, 409)

    def test_invalid_questions_and_deadline(self):
        for changes in [dict(kind='test', questions=[]), dict(kind='test', questions=[dict(prompt='?', options=['A', 'B'], correct=2)]), dict(kind='test', questions=[dict(prompt='?', options=['A', 'A'], correct=0)]), dict(deadline=self.now.isoformat()), dict(student=self.other.pk)]:
            with self.subTest(changes=changes):
                self.assertEqual(self.client.post('/api/assignments/', {**self.payload, **changes}, format='json').status_code, 400)
        self.assertFalse(Assignment.objects.exists())

    def test_only_approved_mentor_and_verified_student(self):
        self.profile.approval = 'pending'; self.profile.save()
        self.assertEqual(self.client.post('/api/assignments/', self.payload, format='json').status_code, 403)
        self.profile.approval = 'approved'; self.profile.save()
        self.booking.payment_status = 'unpaid'; self.booking.save()
        self.assertEqual(self.client.post('/api/assignments/', self.payload, format='json').status_code, 400)
        self.assertEqual(self.client.get('/api/learning/students/').json()['results'], [])

    def test_student_list_is_scoped(self):
        self.assertEqual(self.client.get('/api/learning/students/').json()['results'], [{'id': self.student.pk, 'name': 'Student'}])
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get('/api/learning/students/').json()['results'], [])

    def test_expired_and_duplicate_submission_rejected(self):
        task = self.create_task()
        self.client.force_authenticate(self.student)
        url = f"/api/assignments/{task['id']}/submit/"
        with patch('core.learning_api.timezone.now', return_value=self.now+timedelta(days=4)):
            self.assertEqual(self.client.post(url, {'answer': 'Late'}, format='json').status_code, 409)
        self.assertEqual(self.client.post(url, {'answer': 'On time'}, format='json').status_code, 201)
        self.assertEqual(self.client.post(url, {'answer': 'Again'}, format='json').status_code, 409)
        self.assertEqual(Submission.objects.count(), 1)
        self.assertEqual(Submission.objects.get().answer, 'On time')

    def test_invalid_answers_are_rejected(self):
        task = self.create_task(kind='test', questions=[dict(prompt='?', options=['A', 'B'], correct=0)])
        self.client.force_authenticate(self.student)
        url = f"/api/assignments/{task['id']}/submit/"
        for answers in [[], [True], [0.5], ['0'], [-1], [2], [0, 1], {}, None]:
            with self.subTest(answers=answers):
                self.assertEqual(self.client.post(url, {'answers': answers}, format='json').status_code, 400)
        self.assertFalse(Submission.objects.exists())

    def test_student_cannot_review_and_mentor_cannot_submit(self):
        task = self.create_task()
        self.assertEqual(self.client.post(f"/api/assignments/{task['id']}/submit/", {'answer': 'x'}, format='json').status_code, 404)
        self.client.force_authenticate(self.student)
        self.client.post(f"/api/assignments/{task['id']}/submit/", {'answer': 'x'}, format='json')
        self.assertEqual(self.client.post(f"/api/assignments/{task['id']}/review/", {'expected_reviewed_at': None}, format='json').status_code, 404)
        self.client.force_authenticate(self.mentor)
        result = self.client.post(f"/api/assignments/{task['id']}/review/", {'expected_reviewed_at': None}, format='json')
        self.assertEqual(result.status_code, 200, result.content)
        self.assertIsNotNone(result.json()['submission']['reviewed_at'])
        self.assertNotIn('score', result.json()['submission'])

    def test_anonymous_access_rejected(self):
        self.client.force_authenticate(None)
        for url in ['/api/assignments/', '/api/learning/students/']:
            self.assertIn(self.client.get(url).status_code, [401, 403])

    def test_pagination_summary_filters_and_private_detail(self):
        tasks = [Assignment(mentor=self.mentor, student=self.student, title=f'Task {n}', instructions='Private instructions', kind='homework', deadline=self.now+timedelta(days=3)) for n in range(23)]
        Assignment.objects.bulk_create(tasks)
        Submission.objects.create(assignment=tasks[0], answer='Private answer')
        Submission.objects.create(assignment=tasks[1], answer='Reviewed answer', reviewed_at=self.now)
        self.client.force_authenticate(self.student)
        first = self.client.get('/api/assignments/?role=learning').json()
        second = self.client.get('/api/assignments/?role=learning&page=2').json()
        self.assertEqual(first['count'], 23)
        self.assertEqual(len(first['results']), 20)
        self.assertEqual(len(second['results']), 3)
        self.assertFalse({t['id'] for t in first['results']} & {t['id'] for t in second['results']})
        self.assertEqual(first['summary'], {'total': 23, 'submitted': 2, 'reviewed': 1})
        self.assertNotIn('instructions', first['results'][0])
        self.assertNotIn('questions', first['results'][0])
        for status, count in [('pending', 21), ('review', 1), ('reviewed', 1)]:
            result = self.client.get(f'/api/assignments/?role=learning&status={status}').json()
            self.assertEqual(result['count'], count)
            self.assertEqual(result['summary'], first['summary'])
        self.assertEqual(self.client.get('/api/assignments/?role=teaching').json()['count'], 0)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(f'/api/assignments/{tasks[0].pk}/').status_code, 404)
        self.assertEqual(self.client.get('/api/assignments/').json()['summary']['total'], 0)
        self.assertEqual(self.client.get('/api/assignments/?role=invalid').status_code, 400)

    def test_stale_review_cannot_overwrite_newer_feedback(self):
        task = self.create_task()
        Submission.objects.create(assignment_id=task['id'], answer='Student work')
        url = f"/api/assignments/{task['id']}/review/"
        result = self.client.post(url, {'feedback': 'First review', 'expected_reviewed_at': None}, format='json')
        self.assertEqual(result.status_code, 200, result.content)
        version = result.json()['submission']['reviewed_at']
        duplicate = self.client.post(url, {'feedback': 'First review', 'expected_reviewed_at': None}, format='json')
        self.assertEqual(duplicate.status_code, 200)
        self.assertEqual(duplicate.json()['submission']['reviewed_at'], version)
        stale = self.client.post(url, {'feedback': 'Stale edit', 'expected_reviewed_at': None}, format='json')
        self.assertEqual(stale.status_code, 409)
        result = self.client.post(url, {'feedback': 'Updated review', 'expected_reviewed_at': version}, format='json')
        self.assertEqual(result.status_code, 200, result.content)
        self.assertEqual(Submission.objects.get(assignment_id=task['id']).feedback, 'Updated review')
        self.assertEqual(self.client.post(url, {'feedback': 'Missing version'}, format='json').status_code, 400)

    @override_settings(LEARNING_READ_LIMIT=2)
    def test_read_limit_is_shared_between_sessions_and_resets(self):
        second_client = APIClient();second_client.force_authenticate(self.mentor)
        self.assertEqual(self.client.get('/api/assignments/').status_code, 200)
        self.assertEqual(second_client.get('/api/assignments/').status_code, 200)
        result = self.client.get('/api/assignments/')
        self.assertEqual(result.status_code, 429)
        self.assertGreater(int(result['Retry-After']), 0)
        self.assertEqual(LearningRateLimit.objects.filter(user=self.mentor, bucket='read').get().requests, 2)
        with patch('core.learning_limits.timezone.now', return_value=self.now+timedelta(minutes=2)):
            self.assertEqual(second_client.get('/api/assignments/').status_code, 200)

    @override_settings(LEARNING_WRITE_LIMIT=2)
    def test_write_quota_is_separate_from_reads(self):
        for _ in range(2):
            self.assertEqual(self.client.post('/api/assignments/', self.payload, format='json').status_code, 201)
        self.assertEqual(self.client.post('/api/assignments/', self.payload, format='json').status_code, 429)
        self.assertEqual(self.client.get('/api/assignments/').status_code, 200)
        self.assertEqual(Assignment.objects.count(), 2)
        self.assertEqual(LearningRateLimit.objects.filter(user=self.mentor).count(), 2)

    def test_session_writes_require_csrf_and_responses_are_private(self):
        browser = APIClient(enforce_csrf_checks=True);browser.force_login(self.mentor)
        self.assertEqual(browser.post('/api/assignments/', self.payload, format='json').status_code, 403)
        token = browser.get('/api/auth/csrf/').json()['csrfToken']
        result = browser.post('/api/assignments/', self.payload, format='json', HTTP_X_CSRFTOKEN=token)
        self.assertEqual(result.status_code, 201, result.content)
        self.assertEqual(browser.get('/api/assignments/')['Cache-Control'], 'private, no-store')

    def test_submission_at_exact_deadline_is_rejected(self):
        task = self.create_task()
        self.client.force_authenticate(self.student)
        with patch('core.learning_api.timezone.now', return_value=Assignment.objects.get(pk=task['id']).deadline):
            result = self.client.post(f"/api/assignments/{task['id']}/submit/", {'answer': 'Boundary'}, format='json')
        self.assertEqual(result.status_code, 409)
        self.assertFalse(Submission.objects.exists())

    def test_student_pagination_and_search(self):
        users = [User.objects.create_user(f'extra-{n}@learning.test', None, first_name=f'Learner {n:02}') for n in range(51)]
        Booking.objects.bulk_create([Booking(mentor=self.mentor, student=user, starts_at=self.now, ends_at=self.now+timedelta(minutes=50), expires_at=self.now, objective='Eligible', total_price=30000, platform_fee=9000, mentor_net=21000, status='completed', payment_status='verified') for user in users])
        first = self.client.get('/api/learning/students/').json()
        second = self.client.get('/api/learning/students/?page=2').json()
        self.assertEqual(first['count'], 52)
        self.assertEqual(len(first['results']), 50)
        self.assertEqual(len(second['results']), 2)
        match = self.client.get('/api/learning/students/?search=Learner%2007').json()
        self.assertEqual(match['results'], [{'id': users[7].pk, 'name': 'Learner 07'}])


class LearningConcurrencyTests(TransactionTestCase):
    """Run on an existing PostgreSQL test environment; never infer locks from SQLite."""
    def setUp(self):
        from django.db import connection
        if connection.vendor != 'postgresql':
            self.skipTest('PostgreSQL required for actual concurrent learning verification')
        LearningTests.setUp(self)
        self.task = Assignment.objects.create(mentor=self.mentor, student=self.student, title='Concurrent task', instructions='Work', kind='homework', deadline=self.now+timedelta(days=1))

    def race(self, user_id, method, url, payload=None):
        from concurrent.futures import ThreadPoolExecutor
        from threading import Barrier
        from django.db import close_old_connections, connections
        gate = Barrier(2)
        def worker(_):
            close_old_connections()
            try:
                client = APIClient();client.force_authenticate(User.objects.get(pk=user_id))
                gate.wait(timeout=10)
                return getattr(client, method)(url, payload or {}, format='json').status_code
            finally:
                connections.close_all()
        with ThreadPoolExecutor(max_workers=2) as pool:
            return list(pool.map(worker, range(2)))

    def test_simultaneous_submission_has_one_winner(self):
        statuses = self.race(self.student.pk, 'post', f'/api/assignments/{self.task.pk}/submit/', {'answer': 'Once'})
        self.assertCountEqual(statuses, [201, 409])
        self.assertEqual(Submission.objects.filter(assignment=self.task).count(), 1)

    def test_simultaneous_identical_review_is_idempotent(self):
        Submission.objects.create(assignment=self.task, answer='Work')
        statuses = self.race(self.mentor.pk, 'post', f'/api/assignments/{self.task.pk}/review/', {'feedback': 'Reviewed once', 'expected_reviewed_at': None})
        self.assertEqual(statuses, [200, 200])
        self.assertEqual(Submission.objects.get(assignment=self.task).feedback, 'Reviewed once')

    @override_settings(LEARNING_READ_LIMIT=1)
    def test_quota_cannot_be_bypassed_with_parallel_requests(self):
        self.assertCountEqual(self.race(self.mentor.pk, 'get', '/api/assignments/'), [200, 429])
