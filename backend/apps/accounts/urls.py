from django.urls import path

from .admin_views import (
    AdminAssignTeacherView,
    AdminStudentListView,
    AdminTeacherListCreateView,
)
from .views import ChangePasswordView, LoginView, LogoutView, MeView, RefreshView

urlpatterns = [
    # public registration is closed — superadmin/center_admin creates users
    path('login', LoginView.as_view()),
    path('logout', LogoutView.as_view()),
    path('refresh', RefreshView.as_view()),
    path('me', MeView.as_view()),
    path('change-password', ChangePasswordView.as_view()),
]
