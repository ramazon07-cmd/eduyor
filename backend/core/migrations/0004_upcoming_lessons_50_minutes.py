from datetime import timedelta

from django.db import migrations
from django.utils import timezone


def shorten_upcoming_lessons(apps, schema_editor):
    Booking = apps.get_model('core', 'Booking')
    now = timezone.now()
    bookings = Booking.objects.using(schema_editor.connection.alias).filter(
        starts_at__gt=now, status__in=['pending_payment', 'confirmed'],
    )
    for booking in bookings.iterator():
        if booking.status == 'pending_payment' and booking.expires_at <= now:
            continue
        if booking.ends_at - booking.starts_at == timedelta(minutes=60):
            booking.ends_at = booking.starts_at + timedelta(minutes=50)
            booking.save(update_fields=['ends_at'], using=schema_editor.connection.alias)


class Migration(migrations.Migration):
    dependencies = [('core', '0003_combined_mentor_bio')]
    operations = [migrations.RunPython(shorten_upcoming_lessons, migrations.RunPython.noop)]
