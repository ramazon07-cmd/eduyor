"""Short invite codes shared by family links and learning centers."""
import re
import secrets

# No 0/O or 1/I/L, so a code read aloud or copied by hand stays unambiguous.
ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'


def new_code(model, field):
    while True:
        code = ''.join(secrets.choice(ALPHABET) for _ in range(8))
        if not model.objects.filter(**{field: code}).exists():
            return code


def clean_code(value):
    return re.sub(r'[^A-Z0-9]', '', str(value).upper())
