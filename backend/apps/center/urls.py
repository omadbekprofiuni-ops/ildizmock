from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.mock.admin_views import CenterMockSessionViewSet

from .analytics_views import CenterAnalyticsExcelView, CenterAnalyticsView
from .dashboard_views import CenterDashboardView, CenterSettingsView
from .groups_views import CenterGroupViewSet
from .tests_views import CenterTestViewSet
from .views import CenterStudentViewSet, CenterTeacherViewSet

router = DefaultRouter()
router.register('students', CenterStudentViewSet, basename='center-students')
router.register('teachers', CenterTeacherViewSet, basename='center-teachers')
router.register('tests', CenterTestViewSet, basename='center-tests')
router.register('mock', CenterMockSessionViewSet, basename='center-mock')
router.register('groups', CenterGroupViewSet, basename='center-groups')

urlpatterns = router.urls + [
    path('dashboard/', CenterDashboardView.as_view(), name='center-dashboard'),
    path('settings/', CenterSettingsView.as_view(), name='center-settings'),
    path('analytics/', CenterAnalyticsView.as_view(), name='center-analytics'),
    path(
        'analytics/export.xlsx',
        CenterAnalyticsExcelView.as_view(),
        name='center-analytics-export',
    ),
    # ETAP 15 — Davomat tizimi
    path('', include('apps.attendance.urls')),
]
