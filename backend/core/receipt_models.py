from django.db import models


class PaymentReceipt(models.Model):
    booking = models.OneToOneField('core.Booking', on_delete=models.CASCADE, related_name='payment_receipt')
    image = models.BinaryField()
    digest = models.CharField(max_length=64)
    uploaded_at = models.DateTimeField(auto_now=True)
