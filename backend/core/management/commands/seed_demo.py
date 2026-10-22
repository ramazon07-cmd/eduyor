from datetime import time
from pathlib import Path

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from core.models import User, Subject, MentorProfile, AvailabilityRule
from core.services import lock_users
from core.serializers import prepare_avatar
from core.subjects import SUBJECT_NAMES


DEMO_MENTORS = (
    ('sat', 'Azizbek Karimov', 'SAT Math: masalalarni bosqichma-bosqich yechamiz', 'SAT', 40000,
     'Algebra, geometriya va matnli masalalar ustida ishlash uchun namuna dars rejasi.'),
    ('ielts', 'Madina Rasulova', 'IELTS: speaking va writing mashg‘ulotlari', 'IELTS', 45000,
     'Speaking savollarini mashq qilish, essay tuzilishini tushunish va yozma ishni birga tahlil qilish.'),
    ('mathematics', 'Javohir Abdullayev', 'Matematikani tushunib, mustaqil yechishni o‘rganing', 'Mathematics', 35000,
     'Maktab algebrasi, geometriya va funksiyalarni tushunarli misollar orqali o‘rganish.'),
    ('admissions', 'Kamola Mirzayeva', 'Admissions: universitet arizangizni tartibga keltiring', 'University Admissions', 60000,
     'Universitet tanlash, ariza taqvimi, personal statement tuzilishi va hujjatlar ro‘yxati ustida ishlash.'),
    ('programs', 'Sardor Ismoilov', 'International Programs: xalqaro imkoniyatlarni o‘rganing', 'International Programs', 50000,
     'Almashinuv, yozgi maktab va xalqaro dasturlarni izlash, talablarini solishtirish va arizani rejalash. '
     'Bu yo‘nalish universitetga qabul bo‘yicha Admissions yo‘nalishidan alohida.'),
    ('chinese', 'Dilnoza Tursunova', 'Xitoy tili: pinyin va dastlabki suhbatlardan boshlaymiz', 'Chinese', 40000,
     'Pinyin, ohanglar, boshlang‘ich iyerogliflar va kundalik suhbatlar. Boshlovchilar uchun namuna mashg‘ulotlar.'),
)
ASSET_DIR = Path(__file__).resolve().parents[2] / 'demo_assets'
DEMO_NOTICE = 'Namuna profil. Ism va portret namoyish uchun yaratilgan; bu haqiqiy mentor yoki tasdiqlangan malaka emas.'


class Command(BaseCommand):
    help = 'Create one fictional demo mentor with a portrait per direction; preserve existing accounts by default.'

    def add_arguments(self, parser):
        parser.add_argument('--refresh-demo-profiles', action='store_true',
                            help='Refresh only the six reserved demo profiles, preserving their IDs and existing avatars.')

    @transaction.atomic
    def handle(self, *args, **options):
        missing = [key for key, *_ in DEMO_MENTORS if not (ASSET_DIR / f'{key}.png').is_file()]
        if missing:
            raise CommandError(f'Missing demo portraits: {", ".join(missing)}')
        subjects = {name: Subject.objects.get_or_create(name=name)[0] for name in SUBJECT_NAMES}
        for key, name, headline, subject, price, description in DEMO_MENTORS:
            email = f'demo.{key}@example.invalid'
            user, created = User.objects.get_or_create(email=email)
            if not created and not options['refresh_demo_profiles']:
                continue
            # Only reserved demo addresses are touched. Never create working credentials.
            user.set_unusable_password()
            user.save()
            lock_users([user.pk])
            profile = user.profile
            profile.full_name = name
            profile.school = 'EduYor · namuna profil'
            profile.study_level = 'Demo mentor'
            if not profile.avatar:
                portrait = prepare_avatar(ContentFile((ASSET_DIR / f'{key}.png').read_bytes(), name=f'demo-{key}.png'), max_size=8*1024*1024)
                profile.avatar.save(f'demo-{key}.jpg', portrait, save=False)
            profile.save()
            mentor, _ = MentorProfile.objects.update_or_create(user=user, defaults={
                'headline': headline, 'bio': f'{DEMO_NOTICE}\n\n{description}',
                'teaching_languages': 'O‘zbekcha, English', 'experience': '',
                'hourly_price': price, 'approval': 'approved', 'is_paused': False,
            })
            mentor.subjects.set([subjects[subject]])
            if not mentor.availability.exists():
                for day in range(7):
                    AvailabilityRule.objects.create(mentor=mentor, weekday=day, start_time=time(18), end_time=time(21))
        self.stdout.write(self.style.SUCCESS('Six fictional demo mentors with portraits are ready. No demo login passwords.'))
