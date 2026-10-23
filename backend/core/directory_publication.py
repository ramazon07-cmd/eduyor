"""Import the frozen, public-only mentor release using stable account identities."""
import hashlib
import json
from pathlib import Path


def publish_directory(apps, schema_editor):
    root = Path(__file__).resolve().parent
    release = json.loads((root / 'directory_releases/v1.json').read_text())
    # Validate every bundled photo before writing any database records.
    for row in release['mentors']:
        portrait = root / 'mentor_assets' / Path(row['avatar']).name
        if hashlib.sha256(portrait.read_bytes()).hexdigest() != row['avatar_sha256']:
            raise RuntimeError(f"Directory portrait checksum mismatch: {row['key']}")

    db = schema_editor.connection.alias
    User = apps.get_model('core', 'User')
    Profile = apps.get_model('core', 'Profile')
    Mentor = apps.get_model('core', 'MentorProfile')
    Subject = apps.get_model('core', 'Subject')
    Rule = apps.get_model('core', 'AvailabilityRule')
    BlockedDate = apps.get_model('core', 'BlockedDate')

    for row in release['mentors']:
        candidates = list(User.objects.using(db).filter(email__in=row['account_aliases']).order_by('pk'))
        if not candidates:
            # Preserve an existing real mentor's account, password and bookings.
            profiles = list(Profile.objects.using(db).filter(
                full_name=row['profile']['full_name'], user__mentor__isnull=False,
            ).select_related('user'))
            if len(profiles) > 1:
                raise RuntimeError(f"Ambiguous directory account: {row['key']}")
            candidates = [profiles[0].user] if profiles else []
        if candidates:
            user = candidates[0]
        else:
            user = User.objects.using(db).create(
                email=row['account_aliases'][0], password='!', is_active=True,
                is_staff=False, is_superuser=False,
            )
        # Retire only duplicate reserved seed listings; never delete accounts/bookings.
        if len(candidates) > 1:
            Mentor.objects.using(db).filter(user_id__in=[u.pk for u in candidates[1:]]).update(is_paused=True)
        Profile.objects.using(db).update_or_create(
            user_id=user.pk, defaults={**row['profile'], 'avatar':row['avatar']},
        )
        mentor, _ = Mentor.objects.using(db).update_or_create(user_id=user.pk, defaults=row['mentor'])
        subject_ids = [Subject.objects.using(db).get_or_create(name=name)[0].pk for name in row['subjects']]
        mentor.subjects.set(subject_ids)
        Rule.objects.using(db).filter(mentor_id=mentor.pk).delete()
        Rule.objects.using(db).bulk_create([Rule(mentor_id=mentor.pk, **rule) for rule in row['availability']])
        BlockedDate.objects.using(db).filter(mentor_id=mentor.pk).delete()
        BlockedDate.objects.using(db).bulk_create([BlockedDate(mentor_id=mentor.pk, date=date) for date in row['blocked_dates']])

    Mentor.objects.using(db).filter(user__email__in=release['retired_accounts']).update(is_paused=True)

