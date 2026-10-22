from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [('core', '0005_default_directions')]
    operations = [migrations.CreateModel(name='PaymentReceipt', fields=[
        ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
        ('image', models.BinaryField()), ('digest', models.CharField(max_length=64)),
        ('uploaded_at', models.DateTimeField(auto_now=True)),
        ('booking', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='payment_receipt', to='core.booking')),
    ])]
