from django.urls import path

from .admin_views import (
    B2CCreditGrantView,
    B2CUserDetailView,
    B2CUsersListView,
)
from .views import (
    B2CCancelAttemptView,
    B2CCatalogDetailView,
    B2CCatalogListView,
    B2CCreditsView,
    B2CDashboardView,
    B2CGoogleAuthView,
    B2CLoginView,
    B2CLogoutView,
    B2CMeView,
    B2CProfileView,
    B2CRedeemPromoCodeView,
    B2CSignupView,
    B2CStartTestView,
)

urlpatterns = [
    path('auth/signup', B2CSignupView.as_view(), name='b2c-signup'),
    path('auth/login', B2CLoginView.as_view(), name='b2c-login'),
    path('auth/google', B2CGoogleAuthView.as_view(), name='b2c-google'),
    path('auth/logout', B2CLogoutView.as_view(), name='b2c-logout'),
    path('auth/me', B2CMeView.as_view(), name='b2c-me'),
    path('profile', B2CProfileView.as_view(), name='b2c-profile'),
    path('dashboard', B2CDashboardView.as_view(), name='b2c-dashboard'),

    # ETAP 19 — B2C user uchun balans va tranzaksiya tarixi
    path('credits', B2CCreditsView.as_view(), name='b2c-credits'),
    path(
        'credits/redeem-promo', B2CRedeemPromoCodeView.as_view(),
        name='b2c-redeem-promo',
    ),

    # ETAP 16 — Catalog
    path('catalog', B2CCatalogListView.as_view(), name='b2c-catalog'),
    path(
        'catalog/<uuid:pk>',
        B2CCatalogDetailView.as_view(), name='b2c-catalog-detail',
    ),
    # ETAP 19 — Test boshlash (kredit deduct + attempt yaratish)
    path(
        'catalog/<uuid:pk>/start',
        B2CStartTestView.as_view(), name='b2c-catalog-start',
    ),
    path(
        'attempts/<uuid:pk>/cancel',
        B2CCancelAttemptView.as_view(), name='b2c-attempt-cancel',
    ),
]


# ETAP 19 — Super-admin endpoint'lari config/urls.py orqali ulanadi:
# /api/v1/super/b2c-users/, /api/v1/super/b2c-users/<id>/, /credit-grant/
__all__ = [
    'B2CCreditGrantView',
    'B2CUserDetailView',
    'B2CUsersListView',
]
