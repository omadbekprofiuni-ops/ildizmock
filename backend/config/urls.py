from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from apps.accounts.admin_views import (
    AdminAssignTeacherView,
    AdminStudentListView,
    AdminTeacherListCreateView,
)
from apps.b2c.admin_views import (
    AdminCreditsBulkGrantView,
    AdminCreditsOverviewView,
    B2CCreditGrantView,
    B2CUserDetailView,
    B2CUsersListView,
    PromoCodeDetailView,
    PromoCodesListCreateView,
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/auth/', include('apps.accounts.urls')),
    path('api/v1/admin/teachers/', AdminTeacherListCreateView.as_view()),
    path('api/v1/admin/students/', AdminStudentListView.as_view()),
    path('api/v1/admin/students/<int:pk>/assign-teacher/',
         AdminAssignTeacherView.as_view()),
    path('api/v1/', include('apps.tests.urls')),
    path('api/v1/', include('apps.attempts.urls')),
    path('api/v1/', include('apps.organizations.urls')),
    path('api/v1/', include('apps.mock.urls')),
    path('api/v1/center/<slug:org_slug>/', include('apps.center.urls')),
    path('api/v1/super/billing/', include('apps.billing.urls')),
    path('api/v1/b2c/', include('apps.b2c.urls')),

    # ETAP 19 — Super-admin B2C boshqaruvi
    path('api/v1/super/b2c-users/', B2CUsersListView.as_view()),
    path('api/v1/super/b2c-users/<int:user_id>/', B2CUserDetailView.as_view()),
    path(
        'api/v1/super/b2c-users/<int:user_id>/credit-grant/',
        B2CCreditGrantView.as_view(),
    ),
    # ETAP 19 — Promo kodlar
    path('api/v1/super/promo-codes/', PromoCodesListCreateView.as_view()),
    path('api/v1/super/promo-codes/<int:pk>/', PromoCodeDetailView.as_view()),
    # ETAP 19 — Kreditlar umumiy
    path('api/v1/super/credits/', AdminCreditsOverviewView.as_view()),
    path('api/v1/super/credits/bulk-grant/', AdminCreditsBulkGrantView.as_view()),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
