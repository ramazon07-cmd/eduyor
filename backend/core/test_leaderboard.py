from datetime import timedelta
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from .models import User, MentorProfile, Booking, LearningCenter


def mentor(email, name, approval='approved', center=None, **extra):
    user = User.objects.create_user(email, None)
    user.profile.full_name = name
    user.profile.save()
    MentorProfile.objects.create(user=user, headline='Math', bio='Math', hourly_price=30000, approval=approval, center=center, **extra)
    return user


class LeaderboardTests(TestCase):
    def setUp(self):
        self.student = User.objects.create_user('student@board.test', None)
        self.owner = User.objects.create_user('owner@board.test', None)

    def lessons(self, teacher, *stars):
        # None is a completed lesson the student did not rate.
        for day, star in enumerate(stars, start=2):
            start = timezone.now()-timedelta(days=day)
            Booking.objects.create(student=self.student, mentor=teacher, starts_at=start, ends_at=start+timedelta(minutes=50), expires_at=start, objective='Algebra', total_price=30000, platform_fee=9000, mentor_net=21000, status='completed', payment_status='verified', feedback_rating=star)

    def center(self, name, approval='approved'):
        return LearningCenter.objects.create(owner=User.objects.create_user(f'{name}@board.test', None), name=name, kind='online', description='Team', approval=approval, invite_code=name.upper()[:8].ljust(8, 'X'))

    def test_mentors_rank_by_weighted_rating_so_one_review_cannot_win(self):
        single = mentor('single@board.test', 'Single Five')
        self.lessons(single, 5, None)
        steady = mentor('steady@board.test', 'Steady Four')
        self.lessons(steady, 5, 5, 4, 4)
        proven = mentor('proven@board.test', 'Proven Ten')
        self.lessons(proven, *[5]*10)
        mentor('unrated@board.test', 'No Ratings')
        self.lessons(mentor('paused@board.test', 'Paused', is_paused=True), 5, 5, 5)
        self.lessons(mentor('pending@board.test', 'Pending', approval='pending'), 5, 5, 5)
        rows = APIClient().get('/api/leaderboard/').json()['mentors']
        self.assertEqual([(r['rank'], r['full_name']) for r in rows], [(1, 'Proven Ten'), (2, 'Steady Four'), (3, 'Single Five')])
        self.assertEqual((rows[1]['rating_average'], rows[1]['rating_count']), (4.5, 4))
        self.assertEqual((rows[2]['rating_count'], rows[2]['lessons_completed']), (1, 2))

    def test_successful_lessons_exclude_disputed_and_unverified(self):
        teacher = mentor('success@board.test', 'Success')
        self.lessons(teacher, 5, 4, None)
        Booking.objects.filter(mentor=teacher, feedback_rating=4).update(disputed=True)
        Booking.objects.filter(mentor=teacher, feedback_rating__isnull=True).update(payment_status='refunded')
        row = APIClient().get('/api/leaderboard/').json()['mentors'][0]
        self.assertEqual((row['lessons_completed'], row['rating_count'], row['rating_average']), (1, 2, 4.5))

    def test_centers_rank_by_pooled_ratings_of_their_public_mentors(self):
        strong, small = self.center('strong'), self.center('small')
        self.lessons(mentor('m1@board.test', 'M1', center=strong), 5, 5, 5)
        self.lessons(mentor('m2@board.test', 'M2', approval='pending', center=strong), 1, 1)
        mentor('m3@board.test', 'M3', center=strong)
        self.lessons(mentor('m4@board.test', 'M4', center=small), 5)
        self.lessons(mentor('m5@board.test', 'M5', center=self.center('hidden', approval='pending')), *[5]*10)
        mentor('m6@board.test', 'M6', center=self.center('quiet'))
        rows = APIClient().get('/api/leaderboard/').json()['centers']
        self.assertEqual([(r['rank'], r['name']) for r in rows], [(1, 'strong'), (2, 'small')])
        self.assertEqual({k: rows[0][k] for k in ['mentor_count', 'rating_count', 'rating_average', 'lessons_completed']}, {'mentor_count': 2, 'rating_count': 3, 'rating_average': 5.0, 'lessons_completed': 3})
