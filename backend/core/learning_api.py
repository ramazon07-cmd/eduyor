"""Private, participant-scoped homework and tests. Answer keys never reach students."""
from django.db import transaction
from django.db.models import Q, Count
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied, Throttled
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from .models import Assignment, Submission, Booking, User, MentorProfile
from .views import SecureView
from .errors import Conflict
from .learning_limits import LearningThrottle
from .services import lock_users


class QuestionInput(serializers.Serializer):
    prompt = serializers.CharField(max_length=1000)
    options = serializers.ListField(child=serializers.CharField(max_length=500), min_length=2, max_length=6)
    correct = serializers.IntegerField(min_value=0, max_value=5)

    def validate(self, data):
        if data['correct'] >= len(data['options']):
            raise serializers.ValidationError('To‘g‘ri javobni variantlardan tanlang.')
        if len(set(data['options'])) != len(data['options']):
            raise serializers.ValidationError('Variantlar bir xil bo‘lmasin.')
        return data


class AssignmentInput(serializers.ModelSerializer):
    student = serializers.PrimaryKeyRelatedField(queryset=User.objects.filter(is_active=True))
    questions = QuestionInput(many=True, max_length=50, required=False, default=list)

    class Meta:
        model = Assignment
        fields = ['student', 'title', 'instructions', 'kind', 'deadline', 'questions']

    def validate(self, data):
        user = self.context['user']
        if not MentorProfile.objects.filter(user=user, approval='approved', is_paused=False).exists():
            raise PermissionDenied('Tasdiqlangan mentor profili kerak.')
        if not Booking.objects.filter(mentor=user, student=data['student'], status__in=['confirmed', 'completed'], payment_status='verified').exists():
            raise serializers.ValidationError({'student': 'Faqat o‘z darsingizdagi studentni tanlang.'})
        if data['deadline'] <= timezone.now():
            raise serializers.ValidationError({'deadline': 'Kelajakdagi muddatni belgilang.'})
        if data['kind'] == 'test' and not data['questions']:
            raise serializers.ValidationError({'questions': 'Kamida bitta savol qo‘shing.'})
        if data['kind'] == 'homework' and data['questions']:
            raise serializers.ValidationError({'questions': 'Savollar faqat test uchun.'})
        return data


class SubmissionOutput(serializers.ModelSerializer):
    answer_checks = serializers.SerializerMethodField()

    def get_answer_checks(self, obj):
        task = obj.assignment
        if task.kind != 'test':
            return []
        return [type(answer) is int and answer == question['correct'] for answer, question in zip(obj.answers, task.questions)]

    class Meta:
        model = Submission
        fields = ['id', 'answer', 'answers', 'answer_checks', 'feedback', 'submitted_at', 'reviewed_at']


class AssignmentOutput(serializers.ModelSerializer):
    mentor_name = serializers.CharField(source='mentor.profile.full_name')
    student_name = serializers.CharField(source='student.profile.full_name')
    submission = SubmissionOutput(read_only=True)
    questions = serializers.SerializerMethodField()

    def get_questions(self, obj):
        if self.context['user'].pk == obj.mentor_id:
            return obj.questions
        return [{'prompt': q['prompt'], 'options': q['options']} for q in obj.questions]

    class Meta:
        model = Assignment
        fields = ['id', 'mentor', 'student', 'mentor_name', 'student_name', 'title', 'instructions', 'kind', 'deadline', 'questions', 'submission', 'created_at']


def visible_tasks(user):
    return Assignment.objects.filter(Q(mentor=user) | Q(student=user)).select_related('mentor__profile', 'student__profile', 'submission')


def output(task, user):
    return AssignmentOutput(task, context={'user': user}).data


class LearningView(SecureView):
    throttle_classes = [LearningThrottle]

    def throttled(self, request, wait):
        raise Throttled(wait, detail='Juda ko‘p so‘rov. Birozdan keyin qayta urining.')


class StudentFilters(serializers.Serializer):
    search = serializers.CharField(max_length=120, required=False, allow_blank=True, default='')


class LearningStudentsView(LearningView):
    def get(self, request):
        filters = StudentFilters(data=request.query_params)
        filters.is_valid(raise_exception=True)
        students = User.objects.filter(learning_bookings__mentor=request.user, learning_bookings__status__in=['confirmed', 'completed'], learning_bookings__payment_status='verified', is_active=True).select_related('profile').distinct().order_by('profile__full_name', 'pk')
        if filters.validated_data['search']:
            students = students.filter(profile__full_name__icontains=filters.validated_data['search'])
        pager = PageNumberPagination()
        pager.page_size = 50
        page = pager.paginate_queryset(students, request)
        return pager.get_paginated_response([{'id': s.pk, 'name': s.profile.full_name} for s in page])


class AssignmentFilters(serializers.Serializer):
    role = serializers.ChoiceField(choices=['all', 'learning', 'teaching'], default='all')
    status = serializers.ChoiceField(choices=['all', 'pending', 'review', 'reviewed'], default='all')


class SubmissionSummary(serializers.ModelSerializer):
    class Meta:
        model = Submission
        fields = ['id', 'submitted_at', 'reviewed_at']


class AssignmentSummary(AssignmentOutput):
    submission = SubmissionSummary(read_only=True)

    class Meta(AssignmentOutput.Meta):
        fields = [f for f in AssignmentOutput.Meta.fields if f not in ['instructions', 'questions']]


class AssignmentListView(LearningView):
    def get(self, request):
        filters = AssignmentFilters(data=request.query_params)
        filters.is_valid(raise_exception=True)
        qs = visible_tasks(request.user)
        role, status = filters.validated_data['role'], filters.validated_data['status']
        if role == 'learning':
            qs = qs.filter(student=request.user)
        elif role == 'teaching':
            qs = qs.filter(mentor=request.user)
        summary = qs.aggregate(total=Count('pk'), submitted=Count('submission'), reviewed=Count('submission', filter=Q(submission__reviewed_at__isnull=False)))
        if status == 'pending':
            qs = qs.filter(submission__isnull=True)
        elif status == 'review':
            qs = qs.filter(submission__isnull=False, submission__reviewed_at__isnull=True)
        elif status == 'reviewed':
            qs = qs.filter(submission__reviewed_at__isnull=False)
        pager = PageNumberPagination()
        pager.page_size = 20
        page = pager.paginate_queryset(qs.defer('instructions', 'questions', 'submission__answer', 'submission__answers', 'submission__feedback').order_by('deadline', '-pk'), request)
        response = pager.get_paginated_response(AssignmentSummary(page, many=True, context={'user': request.user}).data)
        response.data['summary'] = summary
        return response

    def post(self, request):
        data = AssignmentInput(data=request.data, context={'user': request.user})
        data.is_valid(raise_exception=True)
        with transaction.atomic():
            lock_users([request.user.pk, data.validated_data['student'].pk])
            # Recheck approval, deadline and lesson eligibility under participant locks.
            data.validate(data.validated_data)
            task = data.save(mentor=request.user)
        return Response(output(task, request.user), status=201)


class AssignmentDetailView(LearningView):
    def get(self, request, pk):
        return Response(output(get_object_or_404(visible_tasks(request.user), pk=pk), request.user))


class SubmissionInput(serializers.Serializer):
    answer = serializers.CharField(max_length=12000, allow_blank=True, required=False, default='')
    # JSONField preserves integers so booleans, strings, and fractional numbers can be rejected.
    answers = serializers.JSONField(required=False, default=list)


class AssignmentSubmitView(LearningView):
    def post(self, request, pk):
        data = SubmissionInput(data=request.data)
        data.is_valid(raise_exception=True)
        with transaction.atomic():
            task = get_object_or_404(Assignment.objects.select_for_update(), pk=pk, student=request.user)
            if Submission.objects.filter(assignment=task).exists():
                raise Conflict('Topshiriq allaqachon yuborilgan.')
            if timezone.now() >= task.deadline:
                raise Conflict('Topshirish muddati tugagan.')
            answer, answers = data.validated_data['answer'], data.validated_data['answers']
            if task.kind == 'test':
                if not isinstance(answers, list) or len(answers) != len(task.questions) or any(type(a) is not int or not 0 <= a < len(q['options']) for a, q in zip(answers, task.questions)):
                    raise serializers.ValidationError({'answers': 'Barcha savollarga bittadan javob tanlang.'})
                answer = ''
            elif not answer.strip():
                raise serializers.ValidationError({'answer': 'Javobingizni kiriting.'})
            else:
                answers = []
            Submission.objects.create(assignment=task, answer=answer, answers=answers, reviewed_at=timezone.now() if task.kind == 'test' else None)
        return Response(output(visible_tasks(request.user).get(pk=pk), request.user), status=201)


class ReviewInput(serializers.Serializer):
    expected_reviewed_at = serializers.DateTimeField(allow_null=True)
    feedback = serializers.CharField(max_length=3000, allow_blank=True, required=False, default='')


class AssignmentReviewView(LearningView):
    def post(self, request, pk):
        data = ReviewInput(data=request.data)
        data.is_valid(raise_exception=True)
        with transaction.atomic():
            task = get_object_or_404(Assignment.objects.select_for_update(), pk=pk, mentor=request.user)
            submission = get_object_or_404(Submission, assignment=task)
            if task.kind != 'homework':
                raise Conflict('Test javoblari avtomatik tekshiriladi.')
            if submission.reviewed_at != data.validated_data['expected_reviewed_at']:
                if submission.reviewed_at is not None and submission.feedback == data.validated_data['feedback']:
                    return Response(output(visible_tasks(request.user).get(pk=pk), request.user))
                raise Conflict('Izoh boshqa oynada o‘zgartirilgan. Yangilab, qayta urinib ko‘ring.')
            submission.feedback = data.validated_data['feedback']
            submission.reviewed_at = timezone.now()
            submission.save(update_fields=['feedback', 'reviewed_at'])
        return Response(output(visible_tasks(request.user).get(pk=pk), request.user))
