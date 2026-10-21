from django.core.management.base import BaseCommand
from django.utils import timezone
from core.models import Booking
from core.services import refresh_booking
class Command(BaseCommand):
    help = 'Idempotently expire overdue holds. Availability ignores them even before cleanup.'
    def handle(self,*args,**options):
        ids = list(Booking.objects.filter(status='pending_payment',expires_at__lte=timezone.now()).values_list('pk',flat=True))
        for pk in ids:
            refresh_booking(pk)
        self.stdout.write(self.style.SUCCESS(f'Processed {len(ids)} overdue reservations.'))
