#!/usr/bin/env python3
"""Run from the EduYor repository; creates one separate Django admin account."""
import importlib.util
import os
from pathlib import Path
import secrets
import subprocess
import sys


def main():
    root = Path.cwd()
    backend = root / 'backend'
    if not (backend / 'manage.py').is_file():
        raise SystemExit('Avval eduyor repo papkasiga kiring va buyruqni qayta bajaring.')
    if importlib.util.find_spec('django') is None:
        for candidate in [root / '.venv/bin/python', backend / '.venv/bin/python',
                          root / 'venv/bin/python', backend / 'venv/bin/python']:
            if candidate.is_file() and subprocess.run(
                [str(candidate), '-c', 'import django'], stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            ).returncode == 0:
                os.execv(str(candidate), [str(candidate), str(Path(__file__).resolve())])
        raise SystemExit('Django muhitingizni yoqing: source .venv/bin/activate. Keyin shu buyruqni qayta bajaring.')
    sys.path.insert(0, str(backend))
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings_local')
    import django
    django.setup()
    from django.contrib.auth import get_user_model
    from django.core.management import call_command
    from django.db import transaction
    admin_path = '/admin-panel/login/'
    call_command('migrate', interactive=False, verbosity=0)
    User = get_user_model()
    email = 'admin@eduyor.local'
    # Never overwrite an existing password or upgrade a public account.
    existing = User.objects.filter(email__iexact=email).first()
    if existing and existing.is_superuser and existing.is_staff and existing.is_active:
        print('\nAdmin hisobi mavjud: ' + existing.email)
        print('Parolni yangilash:')
        print('  ' + sys.executable + ' backend/manage.py changepassword ' + existing.email)
        print('Panel: http://localhost:3000' + admin_path)
        return
    password = secrets.token_urlsafe(20)
    with transaction.atomic():
        if existing:
            email = 'admin-' + secrets.token_hex(5) + '@eduyor.local'
        user = User.objects.create_superuser(email=email, password=password, is_active=True)
        user.profile.full_name = 'EduYor Admin'
        user.profile.save(update_fields=['full_name'])
    print('\n========== EDUYOR ADMIN ==========')
    print('Panel:  http://localhost:3000' + admin_path)
    print('Login:  ' + email)
    print('Parol:  ' + password)
    print('=================================')
    print('Parolni saqlab oling. U kod fayllariga yozilmagan.')
    print('Backend ishlamasa: ' + sys.executable + ' backend/manage.py runserver')


if __name__ == '__main__':
    main()
