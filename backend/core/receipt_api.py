import hashlib
import warnings
from io import BytesIO
from PIL import Image, ImageOps, UnidentifiedImageError
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.db import transaction
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError
from .views import SecureView
from .models import Booking, PaymentReceipt
from . import services


class ReceiptView(SecureView):
    def booking(self, request, pk):
        booking = get_object_or_404(Booking, pk=pk)
        user = request.user
        if user.pk != booking.student_id and not (user.is_active and user.is_staff and user.is_superuser):
            raise PermissionDenied()
        return booking

    def get(self, request, pk):
        booking = self.booking(request, pk)
        receipt = PaymentReceipt.objects.filter(booking=booking).first()
        if request.query_params.get('meta') == '1':
            return Response({'uploaded': bool(receipt), 'digest': receipt.digest if receipt else ''})
        receipt = get_object_or_404(PaymentReceipt, booking=booking)
        response = HttpResponse(bytes(receipt.image), content_type='image/jpeg')
        response['Content-Disposition'] = 'inline; filename="payment-receipt.jpg"'
        response['X-Content-Type-Options'] = 'nosniff'
        return response

    def post(self, request, pk):
        booking = self.booking(request, pk)
        if request.user.pk != booking.student_id:
            raise PermissionDenied()
        upload = request.FILES.get('receipt')
        if not upload or upload.size > 5 * 1024 * 1024:
            raise ValidationError('JPG, PNG yoki WEBP chek rasmini yuklang. Eng ko‘pi 5 MB.')
        try:
            with warnings.catch_warnings():
                warnings.simplefilter('error', Image.DecompressionBombWarning)
                with Image.open(upload) as source:
                    if source.format not in ['JPEG', 'PNG', 'WEBP'] or source.width * source.height > 20000000:
                        raise ValueError()
                    source.load()
                    image = ImageOps.exif_transpose(source).convert('RGB')
                    image.thumbnail((2400, 3200))
                    output = BytesIO()
                    image.save(output, format='JPEG', quality=90)
        except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
            raise ValidationError('Rasmni ochib bo‘lmadi. JPG, PNG yoki WEBP yuboring.')
        content = output.getvalue()
        with transaction.atomic():
            services.lock_users([booking.student_id, booking.mentor_id])
            services.submit_payment(pk, request.user, 'Chek rasmi yuborilgan')
            receipt, _ = PaymentReceipt.objects.update_or_create(booking_id=pk, defaults={'image':content, 'digest':hashlib.sha256(content).hexdigest()})
        return Response({'uploaded':True, 'digest':receipt.digest})
