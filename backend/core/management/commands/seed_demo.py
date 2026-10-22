from datetime import time
from django.core.management.base import BaseCommand
from django.db import transaction
from core.models import User, Subject, MentorProfile, AvailabilityRule
from core.services import lock_users
from core.subjects import SUBJECT_NAMES
class Command(BaseCommand):
    help = 'Create clearly labelled demo mentors. Demo users have unusable passwords.'
    @transaction.atomic
    def handle(self,*args,**options):
        subjects = {name:Subject.objects.get_or_create(name=name)[0] for name in SUBJECT_NAMES}
        rows = [
            ('demo.sat@example.invalid','Demo · Aziz','SAT matematikasini birga o‘rganamiz','SAT',30000),
            ('demo.ielts@example.invalid','Demo · Madina','IELTS uchun aniq mashq rejasi','IELTS',45000),
            ('demo.admissions@example.invalid','Demo · Kamola','Universitet arizasini tartibga keltiring','University Admissions',60000),
        ]
        for email,name,headline,subject,price in rows:
            user,created = User.objects.get_or_create(email=email)
            if not created:
                continue  # Idempotent; never overwrite operator edits or existing sessions.
            user.set_unusable_password()
            user.save()
            lock_users([user.pk])
            p = user.profile
            p.full_name,p.school,p.study_level = name,'Namuna maktabi','Demo profil'
            p.save()
            mentor = MentorProfile.objects.create(user=user,headline=headline,bio='Bu namuna profil. Haqiqiy mentor yoki natija emas. Ishga tushirishdan oldin o‘chiring yoki pauza qiling.',teaching_languages='O‘zbekcha, English',experience='',hourly_price=price,approval='approved')
            mentor.subjects.add(subjects[subject])
            for day in range(7):
                AvailabilityRule.objects.create(mentor=mentor,weekday=day,start_time=time(18),end_time=time(21))
        self.stdout.write(self.style.SUCCESS('Demo subjects and labelled mentors ready. No demo login passwords.'))
