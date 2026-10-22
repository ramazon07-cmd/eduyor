from django.db import migrations


def create_directions(apps, schema_editor):
    Subject = apps.get_model('core', 'Subject')
    for name in ('SAT', 'IELTS', 'Mathematics', 'University Admissions'):
        Subject.objects.using(schema_editor.connection.alias).get_or_create(name=name)


class Migration(migrations.Migration):
    dependencies = [('core', '0004_upcoming_lessons_50_minutes')]
    operations = [migrations.RunPython(create_directions, migrations.RunPython.noop)]
