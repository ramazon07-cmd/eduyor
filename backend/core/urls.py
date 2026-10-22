from django.urls import path
from . import views as v
from .health import health
urlpatterns = [
    path('health/',health),
    path('auth/csrf/',v.csrf),path('auth/register/',v.RegisterView.as_view()),path('auth/login/',v.LoginView.as_view()),path('auth/logout/',v.LogoutView.as_view()),
    path('me/',v.MeView.as_view()),path('subjects/',v.SubjectsView.as_view()),path('mentors/',v.MentorListView.as_view()),path('mentors/<int:pk>/',v.MentorDetailView.as_view()),path('mentors/<int:pk>/slots/',v.SlotsView.as_view()),
    path('mentor/settings/',v.MentorSettingsView.as_view()),path('mentor/availability/',v.ScheduleView.as_view()),path('bookings/',v.BookingListView.as_view()),path('bookings/<int:pk>/',v.BookingDetailView.as_view()),path('bookings/<int:pk>/<str:action>/',v.BookingActionView.as_view()),path('payment-info/',v.PaymentInfoView.as_view()),path('earnings/',v.EarningsView.as_view()),
]

# EduYor custom website administration
from django.urls import include as _control_include, path as _control_path
urlpatterns += [_control_path('control/', _control_include('core.control_urls'))]
