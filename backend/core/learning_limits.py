"""Database-backed per-account quotas, serialized across PostgreSQL workers."""
from datetime import timedelta
from math import ceil
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework.throttling import BaseThrottle
from .models import LearningRateLimit, User


class LearningThrottle(BaseThrottle):
    def allow_request(self, request, view):
        if not request.user.is_authenticated:
            return True  # Authentication/permissions handle anonymous requests.
        reading = request.method in ('GET', 'HEAD', 'OPTIONS')
        bucket = 'read' if reading else 'write'
        limit = getattr(settings, 'LEARNING_READ_LIMIT' if reading else 'LEARNING_WRITE_LIMIT', 120 if reading else 60)
        duration = timedelta(minutes=1) if reading else timedelta(hours=1)
        with transaction.atomic():
            # Always lock the user before the quota, consistently across workers.
            User.objects.select_for_update().only('pk').get(pk=request.user.pk)
            now = timezone.now()
            quota, _ = LearningRateLimit.objects.get_or_create(
                user_id=request.user.pk, bucket=bucket,
                defaults={'window_started_at': now, 'requests': 0},
            )
            if now >= quota.window_started_at + duration or now < quota.window_started_at:
                quota.window_started_at, quota.requests = now, 0
            self.remaining = max(1, ceil((quota.window_started_at + duration - now).total_seconds()))
            if quota.requests >= limit:
                return False
            quota.requests += 1
            quota.save(update_fields=['window_started_at', 'requests'])
        return True

    def wait(self):
        return self.remaining
