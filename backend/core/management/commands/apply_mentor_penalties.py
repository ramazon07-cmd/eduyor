from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from core.models import MentorProfile
from core.services import apply_penalties, lock_users
class Command(BaseCommand):
    help = 'Hide or remove mentors whose students keep leaving after the first lesson. Run daily; idempotent.'
    def handle(self,*args,**options):
        now = timezone.now()
        changed = []
        for pk in MentorProfile.objects.filter(approval='approved').values_list('user_id',flat=True):
            with transaction.atomic():
                lock_users([pk])
                result = apply_penalties(MentorProfile.objects.get(user_id=pk),now)
            if result:
                changed.append(f'{pk}:{result}')
        self.stdout.write(self.style.SUCCESS(f'Mentor penalties applied: {", ".join(changed) or "none"}.'))
