from django.db import migrations, models


def combine_bios(apps, schema_editor):
    Mentor = apps.get_model('core', 'MentorProfile')
    for mentor in Mentor.objects.using(schema_editor.connection.alias).all().iterator():
        bio = (mentor.bio or '').strip()
        experience = (mentor.experience or '').strip()
        if experience and experience not in bio:
            bio = '\n\n'.join(part for part in [bio, experience] if part)
        Mentor.objects.using(schema_editor.connection.alias).filter(pk=mentor.pk).update(bio=bio, experience='')


class Migration(migrations.Migration):
    dependencies = [('core', '0002_pricing_policy')]
    operations = [
        migrations.AlterField('mentorprofile', 'bio', models.TextField(max_length=3000)),
        migrations.AlterField('mentorprofile', 'experience', models.TextField(max_length=1200, blank=True)),
        migrations.RunPython(combine_bios, migrations.RunPython.noop),
    ]
