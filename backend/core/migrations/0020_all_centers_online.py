from django.db import migrations


def make_online(apps, schema_editor):
    # Centers are brands of online mentors; addresses stay stored but are no longer shown.
    apps.get_model('core', 'LearningCenter').objects.filter(kind='offline').update(kind='online')


class Migration(migrations.Migration):
    dependencies = [('core', '0019_center_share_and_penalties')]
    operations = [migrations.RunPython(make_online, migrations.RunPython.noop)]
