from django.urls import path
from . import control_api as v
urlpatterns = [
    path('login/', v.Login.as_view()), path('me/', v.Me.as_view()),
    path('summary/', v.Summary.as_view()), path('mentors/', v.Mentors.as_view()),
    path('mentors/<int:pk>/', v.Mentors.as_view()), path('bookings/', v.Bookings.as_view()),
    path('bookings/<int:pk>/', v.Bookings.as_view()), path('users/', v.Users.as_view()),
]

from .receipt_api import ReceiptView
urlpatterns += [path('receipts/<int:pk>/', ReceiptView.as_view())]
