"""Six-digit email codes that confirm a self-registered account owns its address."""
import logging
import secrets
import smtplib
from datetime import timedelta
from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from .errors import Conflict
from .models import EmailCode, Profile

CODE_TTL = timedelta(minutes=10)
RESEND_AFTER = timedelta(seconds=60)
MAX_ATTEMPTS = 5
log = logging.getLogger(__name__)


def send_code(user):
    now = timezone.now()
    code = f'{secrets.randbelow(10**6):06d}'
    with transaction.atomic():
        current = EmailCode.objects.select_for_update().filter(user=user).first()
        if current and now - current.sent_at < RESEND_AFTER:
            raise Conflict('Kod yaqinda yuborildi. Bir daqiqadan keyin qayta urinib ko‘ring.')
        EmailCode.objects.update_or_create(user=user, defaults={'code_hash': make_password(code), 'sent_at': now, 'expires_at': now + CODE_TTL, 'attempts': 0})
    try:
        send_mail('EduYor tasdiqlash kodi', f'Sizning EduYor tasdiqlash kodingiz: {code}\n\nKod 10 daqiqa amal qiladi. Agar siz ro‘yxatdan o‘tmagan bo‘lsangiz, bu xatni e’tiborsiz qoldiring.', settings.DEFAULT_FROM_EMAIL, [user.email])
    except (smtplib.SMTPException, OSError):
        # The account already exists; the user can ask for a new code.
        log.exception('Email code delivery failed for user %s', user.pk)
        return False
    return True


def verify_code(user, code):
    code = str(code).strip()
    with transaction.atomic():
        entry = EmailCode.objects.select_for_update().filter(user=user).first()
        if not entry or entry.expires_at <= timezone.now():
            raise ValidationError({'code': 'Kod eskirgan. Yangi kod so‘rang.'})
        if entry.attempts >= MAX_ATTEMPTS:
            raise ValidationError({'code': 'Urinishlar tugadi. Yangi kod so‘rang.'})
        matched = check_password(code, entry.code_hash)
        if matched:
            entry.delete()
            Profile.objects.filter(user=user).update(email_verified=True)
        else:
            entry.attempts += 1
            entry.save(update_fields=['attempts'])
    # Raised after commit so the failed attempt is counted.
    if not matched:
        raise ValidationError({'code': 'Kod noto‘g‘ri.'})
