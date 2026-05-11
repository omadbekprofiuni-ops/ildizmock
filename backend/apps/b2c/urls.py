from django.urls import path

from .views import (
    B2CGoogleAuthView,
    B2CLoginView,
    B2CLogoutView,
    B2CMeView,
    B2CProfileView,
    B2CSignupView,
)

urlpatterns = [
    path('auth/signup', B2CSignupView.as_view(), name='b2c-signup'),
    path('auth/login', B2CLoginView.as_view(), name='b2c-login'),
    path('auth/google', B2CGoogleAuthView.as_view(), name='b2c-google'),
    path('auth/logout', B2CLogoutView.as_view(), name='b2c-logout'),
    path('auth/me', B2CMeView.as_view(), name='b2c-me'),
    path('profile', B2CProfileView.as_view(), name='b2c-profile'),
]
