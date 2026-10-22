from django.db import migrations


def create_directions(apps, schema_editor):
    Subject = apps.get_model('core', 'Subject')
    # Admissions keeps its existing ID and mentor relationships. International
    # programs are opt-in: an admissions mentor is not automatically listed there.
    for name in ('International Programs', 'Chinese'):
        Subject.objects.using(schema_editor.connection.alias).get_or_create(name=name)


class Migration(migrations.Migration):
    dependencies = [('core', '0006_payment_receipt')]
    operations = [migrations.RunPython(create_directions, migrations.RunPython.noop)]
