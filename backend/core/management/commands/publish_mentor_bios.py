import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from core.models import DirectoryPublication, MentorProfile


class Command(BaseCommand):
    help = 'Publish the three edited bios once, preserving all other profile fields.'

    @transaction.atomic
    def handle(self, *args, **options):
        _, created = DirectoryPublication.objects.get_or_create(version='bios-v2')
        if not created:
            self.stdout.write('Bios v2 already published; preserving later admin edits.')
            return
        release = Path(__file__).resolve().parents[2] / 'directory_releases/bios-v2.json'
        for row in json.loads(release.read_text()):
            mentors = list(MentorProfile.objects.select_for_update().filter(
                user__profile__full_name=row['name'], is_paused=False,
            ))
            if len(mentors) != 1:
                raise CommandError(f"Expected one mentor profile for {row['name']}; found {len(mentors)}.")
            mentor = mentors[0]
            mentor.bio = row['bio']
            # Public serializers append this legacy field; clear the duplicated copy.
            mentor.experience = ''
            mentor.full_clean()
            mentor.save(update_fields=['bio', 'experience'])
        self.stdout.write(self.style.SUCCESS('Published three concise mentor biographies.'))
