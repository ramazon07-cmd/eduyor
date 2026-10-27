"""Parent accounts follow a child's learning once the child redeems the parent's invite code."""
from django.db import transaction
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from .codes import clean_code, new_code
from .models import Assignment, Booking, FamilyLink
from .services import lock_users
from .views import SecureView, AuthThrottle


def avatar(profile):
    return profile.avatar.url if profile.avatar else None


def family(user):
    links = FamilyLink.objects.select_related('parent__profile', 'child__profile').order_by('linked_at', 'pk')
    invite = links.filter(parent=user, child__isnull=True).first()
    return {
        'invite': {'id': invite.pk, 'code': invite.code} if invite else None,
        'children': [{'link': link.pk, 'id': link.child_id, 'full_name': link.child.profile.full_name, 'avatar': avatar(link.child.profile), 'study_level': link.child.profile.study_level} for link in links.filter(parent=user, child__isnull=False)],
        'parents': [{'link': link.pk, 'full_name': link.parent.profile.full_name, 'linked_at': link.linked_at} for link in links.filter(child=user)],
    }


class FamilyView(SecureView):
    def get(self, request):
        return Response(family(request.user))


class FamilyInviteView(SecureView):
    def post(self, request):
        if request.user.profile.account_type != 'parent':
            raise PermissionDenied('Ulash kodi faqat ota-ona hisobida beriladi.')
        with transaction.atomic():
            lock_users([request.user.pk])
            invite = FamilyLink.objects.filter(parent=request.user, child__isnull=True).first() or FamilyLink.objects.create(parent=request.user, code=new_code(FamilyLink, 'code'))
        return Response({'id': invite.pk, 'code': invite.code})


class FamilyJoinView(SecureView):
    # Codes can only be brute-forced; share the per-account sign-in limit.
    throttle_classes = [AuthThrottle]

    def post(self, request):
        if request.user.profile.account_type == 'parent':
            raise ValidationError({'detail': 'Ota-ona hisobini farzand sifatida ulab bo‘lmaydi.'})
        code = clean_code(request.data.get('code', ''))
        with transaction.atomic():
            invite = FamilyLink.objects.select_for_update().filter(code=code, child__isnull=True).first()
            if not invite:
                raise ValidationError({'detail': 'Kod noto‘g‘ri yoki allaqachon ishlatilgan.'})
            if FamilyLink.objects.filter(parent_id=invite.parent_id, child=request.user).exists():
                raise ValidationError({'detail': 'Siz bu ota-onaga allaqachon ulangansiz.'})
            invite.child, invite.linked_at = request.user, timezone.now()
            invite.save(update_fields=['child', 'linked_at'])
        return Response(family(request.user), status=201)


class FamilyLinkView(SecureView):
    def delete(self, request, pk):
        # Either side may end the link; parenthood is not verified, so the child keeps control.
        get_object_or_404(FamilyLink, Q(parent=request.user) | Q(child=request.user), pk=pk).delete()
        return Response(status=204)


def lesson_row(booking):
    return {'id': booking.pk, 'mentor_name': booking.mentor.profile.full_name, 'starts_at': booking.starts_at, 'ends_at': booking.ends_at, 'status': booking.status, 'objective': booking.objective, 'total_price': str(booking.total_price)}


def task_row(task):
    submission = task.submission if hasattr(task, 'submission') else None
    return {
        'id': task.pk, 'title': task.title, 'kind': task.kind, 'mentor_name': task.mentor.profile.full_name, 'deadline': task.deadline, 'question_count': len(task.questions),
        'submission': None if submission is None else {
            'submitted_at': submission.submitted_at, 'reviewed_at': submission.reviewed_at, 'feedback': submission.feedback,
            'correct_answers': sum(type(answer) is int and answer == question['correct'] for answer, question in zip(submission.answers, task.questions)) if task.kind == 'test' else None,
        },
    }


class ChildProgressView(SecureView):
    """Summary data only: no meeting links, payment references, written answers or answer keys."""
    def get(self, request, pk):
        child = get_object_or_404(FamilyLink.objects.select_related('child__profile'), parent=request.user, child_id=pk).child
        now = timezone.now()
        lessons = Booking.objects.filter(student=child).select_related('mentor__profile')
        upcoming = lessons.filter(Q(status='confirmed') | Q(status='pending_payment', expires_at__gt=now), ends_at__gt=now)
        completed = lessons.filter(status='completed')
        tasks = Assignment.objects.filter(student=child).select_related('mentor__profile', 'submission')
        profile = child.profile
        return Response({
            'child': {'id': child.pk, 'full_name': profile.full_name, 'avatar': avatar(profile), 'study_level': profile.study_level, 'learning_goals': profile.learning_goals},
            'lessons': {'completed': completed.count(), 'upcoming': upcoming.count(), 'awaiting_payment': upcoming.filter(status='pending_payment').count()},
            'upcoming': [lesson_row(b) for b in upcoming.order_by('starts_at')[:5]],
            'recent': [lesson_row(b) for b in completed.order_by('-starts_at')[:5]],
            'tasks': tasks.aggregate(total=Count('pk'), submitted=Count('submission'), reviewed=Count('submission', filter=Q(submission__reviewed_at__isnull=False))),
            'assignments': [task_row(t) for t in tasks.order_by('-deadline', '-pk')[:10]],
        })
