"""Platform card details for manual receipt verification; no bank API or checkout."""
import os
import re
from django.conf import settings


def payment_info():
    def value(name):
        return str(getattr(settings, name, os.getenv(name, '')) or '').strip()
    raw_card = value('PAYMENT_CARD_NUMBER')
    card = re.sub(r'[\s-]', '', raw_card)
    holder = value('PAYMENT_CARD_HOLDER')
    valid_card = bool(re.fullmatch(r'[0-9]{16}', card) and holder)
    invalid_card = bool(raw_card and not valid_card)
    instructions = value('PAYMENT_INSTRUCTIONS')
    return {
        'instructions': instructions,
        'support': value('PAYMENT_SUPPORT'),
        'card_number': card if valid_card else '',
        'card_holder': holder if valid_card else '',
        'bank_name': value('PAYMENT_BANK_NAME') if valid_card else '',
        'can_accept_payment': not invalid_card and bool(valid_card or instructions),
        'method': 'manual_card_transfer',
        'verification': 'admin',
        'mentor_payout': 'manual_after_verified_completion',
    }
