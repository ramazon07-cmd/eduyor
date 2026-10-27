from django.urls import path
from . import views as v
from .health import health
urlpatterns = [
    path('health/',health),
    path('auth/csrf/',v.csrf),path('auth/register/',v.RegisterView.as_view()),path('auth/login/',v.LoginView.as_view()),path('auth/logout/',v.LogoutView.as_view()),path('auth/verify-email/',v.VerifyEmailView.as_view()),path('auth/verify-email/resend/',v.ResendEmailCodeView.as_view()),path('referrals/',v.ReferralView.as_view()),
    path('me/',v.MeView.as_view()),path('subjects/',v.SubjectsView.as_view()),path('mentors/',v.MentorListView.as_view()),path('mentors/<int:pk>/',v.MentorDetailView.as_view()),path('mentors/<int:pk>/slots/',v.SlotsView.as_view()),
    path('mentor/settings/',v.MentorSettingsView.as_view()),path('mentor/availability/',v.ScheduleView.as_view()),path('bookings/',v.BookingListView.as_view()),path('bookings/<int:pk>/',v.BookingDetailView.as_view()),path('bookings/<int:pk>/<str:action>/',v.BookingActionView.as_view()),path('payment-info/',v.PaymentInfoView.as_view()),path('earnings/',v.EarningsView.as_view()),
]

# EduYor custom website administration
from django.urls import include as _control_include, path as _control_path
urlpatterns += [_control_path('control/', _control_include('core.control_urls'))]

from . import request_api as r
urlpatterns += [
    path('requests/', r.RequestListView.as_view()),
    path('requests/<int:pk>/', r.RequestDetailView.as_view()),
    path('requests/<int:pk>/close/', r.RequestCloseView.as_view()),
    path('requests/<int:pk>/offers/', r.RequestOfferView.as_view()),
    path('requests/<int:pk>/offers/<int:offer_id>/accept/', r.OfferAcceptView.as_view()),
]

from . import learning_api as learning
urlpatterns += [
    path('learning/students/', learning.LearningStudentsView.as_view()),
    path('assignments/', learning.AssignmentListView.as_view()),
    path('assignments/<int:pk>/', learning.AssignmentDetailView.as_view()),
    path('assignments/<int:pk>/submit/', learning.AssignmentSubmitView.as_view()),
    path('assignments/<int:pk>/review/', learning.AssignmentReviewView.as_view()),
]

from . import family_api as family
urlpatterns += [
    path('family/', family.FamilyView.as_view()),
    path('family/invite/', family.FamilyInviteView.as_view()),
    path('family/join/', family.FamilyJoinView.as_view()),
    path('family/links/<int:pk>/', family.FamilyLinkView.as_view()),
    path('family/children/<int:pk>/', family.ChildProgressView.as_view()),
]

from . import center_api as centers
urlpatterns += [
    path('centers/', centers.CenterListView.as_view()),
    path('centers/<int:pk>/', centers.CenterDetailView.as_view()),
    path('centers/mine/', centers.MyCenterView.as_view()),
    path('centers/mine/logo/', centers.CenterLogoView.as_view()),
    path('centers/join/', centers.CenterJoinView.as_view()),
    path('centers/members/<int:pk>/', centers.CenterMemberView.as_view()),
    path('centers/members/<int:pk>/share/', centers.CenterShareOfferView.as_view()),
    path('centers/share/<str:decision>/', centers.CenterShareDecisionView.as_view()),
]

from . import leaderboard_api as leaderboard
urlpatterns += [path('leaderboard/', leaderboard.LeaderboardView.as_view())]
