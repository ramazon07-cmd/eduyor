"""Public rankings of mentors and learning centers. Only students of paid, completed lessons can rate."""
from django.db.models import Count, ExpressionWrapper, FloatField, Q, Sum
from django.db.models.functions import Cast
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from .models import LearningCenter
from .serializers import logo_url, public_center
from .views import SecureView, public_mentors

# Bayesian average: every entry starts as if it had five 4-star ratings,
# so one or two perfect reviews cannot outrank a long, steady record.
PRIOR_MEAN = 4.0
PRIOR_WEIGHT = 5.0
TOP = 20


def successful(lessons):
    # Same bar as mentor payouts: finished, paid and not under dispute.
    return Q(**{f'{lessons}__status': 'completed', f'{lessons}__payment_status': 'verified', f'{lessons}__disputed': False})


def weighted_rating():
    return ExpressionWrapper((PRIOR_WEIGHT*PRIOR_MEAN + Cast('rating_sum', FloatField())) / (PRIOR_WEIGHT + Cast('rating_count', FloatField())), output_field=FloatField())


def stats(row):
    return {'rating_average': round(row.rating_sum/row.rating_count, 1), 'rating_count': row.rating_count, 'lessons_completed': row.lessons_completed}


def mentor_rows():
    lessons = 'user__teaching_bookings'
    mentors = public_mentors().annotate(
        rating_count=Count(lessons, filter=Q(user__teaching_bookings__feedback_rating__isnull=False)),
        rating_sum=Sum('user__teaching_bookings__feedback_rating'),
        lessons_completed=Count(lessons, filter=successful(lessons)),
    ).filter(rating_count__gt=0).annotate(score=weighted_rating()).order_by('-score', '-rating_count', '-lessons_completed', 'pk')[:TOP]
    return [{'rank': rank, 'id': m.user_id, 'full_name': m.user.profile.full_name, 'avatar': m.user.profile.avatar.url if m.user.profile.avatar else None, 'headline': m.headline, 'center': public_center(m.center), **stats(m)} for rank, m in enumerate(mentors, start=1)]


def center_rows():
    # A center is judged by its current public mentors; paused or unapproved mentors do not count.
    public = Q(mentors__approval='approved', mentors__is_paused=False, mentors__user__is_active=True)
    lessons = 'mentors__user__teaching_bookings'
    centers = LearningCenter.objects.filter(approval='approved').annotate(
        mentor_count=Count('mentors', filter=public, distinct=True),
        rating_count=Count(lessons, filter=public & Q(mentors__user__teaching_bookings__feedback_rating__isnull=False)),
        rating_sum=Sum('mentors__user__teaching_bookings__feedback_rating', filter=public),
        lessons_completed=Count(lessons, filter=public & successful(lessons)),
    ).filter(rating_count__gt=0).annotate(score=weighted_rating()).order_by('-score', '-rating_count', '-lessons_completed', 'name')[:TOP]
    return [{'rank': rank, 'id': c.pk, 'name': c.name, 'kind': c.kind, 'city': c.city, 'logo': logo_url(c), 'mentor_count': c.mentor_count, **stats(c)} for rank, c in enumerate(centers, start=1)]


class LeaderboardView(SecureView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({'mentors': mentor_rows(), 'centers': center_rows()})
