from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import APIException
from rest_framework.views import exception_handler as drf_handler
from rest_framework.response import Response

class Conflict(APIException):
    status_code = 409
    default_detail = 'Vaqt band yoki bron muddati tugagan. Boshqa vaqt tanlang.'


def exception_handler(exc, context):
    if isinstance(exc, DjangoValidationError):
        return Response(getattr(exc,'message_dict',{'detail':exc.messages}),status=400)
    result = drf_handler(exc, context)
    if result is None:
        import logging
        logging.getLogger(__name__).exception('Unhandled API error',exc_info=exc)
        return Response({'detail':'Server xatosi. Keyinroq urinib ko‘ring.'},status=500)
    return result
