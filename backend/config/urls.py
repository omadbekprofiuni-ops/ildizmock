from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from apps.accounts.admin_views import (
    AdminAssignTeacherView,
    AdminStudentListView,
    AdminTeacherListCreateView,
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
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
