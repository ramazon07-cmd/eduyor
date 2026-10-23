from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from core.models import User, Subject, MentorProfile
from core.peer_mentors import PEER_MENTORS, ASSET_DIR
from core.services import lock_users

class Command(BaseCommand):
    help = 'Create the six requested peer mentors. Dry run by default; never modifies unrelated accounts.'
    def add_arguments(self, parser):
        parser.add_argument('--apply', action='store_true')
    def handle(self, *args, **options):
        missing = [p['key'] for p in PEER_MENTORS if not (ASSET_DIR / f"{p['key']}-v1.jpg").is_file()]
        if missing:
            raise CommandError('Missing portraits: '+', '.join(missing))
        if not options['apply']:
            self.stdout.write('Dry run: six peer mentors ready. Use --apply to create missing profiles.')
            return
        created_ids = []
        with transaction.atomic():
            for p in PEER_MENTORS:
                # SAT is a supplied real identity; other names are illustrative profiles.
                email = 'peer.akbarshoh@example.invalid' if p['key']=='sat' else f"demo.peer.{p['key']}@example.invalid"
                user, created = User.objects.get_or_create(email=email)
                if not created:
                    continue
                lock_users([user.pk])
                user.set_unusable_password()
                user.save(update_fields=['password'])
                profile = user.profile
                profile.full_name = p['name']
                profile.study_level = 'High school student'
                profile.avatar = f"avatars/curated/{p['key']}-v1.jpg"
                profile.save()
                mentor = MentorProfile.objects.create(user=user, headline=p['headline'], bio=p['bio'], teaching_languages='O‘zbekcha, English', hourly_price=p['price'], approval='approved')
                mentor.subjects.set([Subject.objects.get(name=p['subject'])])
                created_ids.append(user.pk)
        self.stdout.write(self.style.SUCCESS(f'Created peer mentor IDs: {created_ids}. Existing accounts preserved.'))
