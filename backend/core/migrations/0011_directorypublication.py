from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('core', '0010_alter_booking_commission_rate')]
    operations = [
        migrations.CreateModel(
            name='DirectoryPublication',
            fields=[
                ('version', models.CharField(max_length=40, primary_key=True, serialize=False)),
                ('published_at', models.DateTimeField(auto_now_add=True)),
            ],
        ),
    ]
