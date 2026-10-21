from decimal import Decimal
from django.db import migrations, models
from django.core.validators import MinValueValidator, MaxValueValidator


def normalize_listing_prices(apps, schema_editor):
    Mentor = apps.get_model('core', 'MentorProfile')
    db = schema_editor.connection.alias
    Mentor.objects.using(db).filter(hourly_price__lt=30000).update(hourly_price=30000)
    Mentor.objects.using(db).filter(hourly_price__gt=60000).update(hourly_price=60000)


class Migration(migrations.Migration):
    dependencies = [('core', '0001_initial')]
    operations = [
        migrations.RunPython(normalize_listing_prices, migrations.RunPython.noop),
        migrations.RemoveConstraint('mentorprofile', 'positive_mentor_price'),
        migrations.AlterField('mentorprofile', 'hourly_price', models.DecimalField(max_digits=12, decimal_places=0, validators=[MinValueValidator(Decimal('30000')), MaxValueValidator(Decimal('60000'))])),
        migrations.AddConstraint('mentorprofile', models.CheckConstraint(condition=models.Q(hourly_price__gte=30000, hourly_price__lte=60000), name='mentor_price_range')),
        migrations.AlterField('booking', 'commission_rate', models.DecimalField(max_digits=3, decimal_places=2, default=Decimal('0.20'))),
    ]
