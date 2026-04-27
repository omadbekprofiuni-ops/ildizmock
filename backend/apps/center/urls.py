from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.mock.admin_views import CenterMockSessionViewSet

from .analytics_views import CenterAnalyticsExcelView, CenterAnalyticsView
from .tests_views import CenterTestViewSet
from .views import CenterStudentViewSet, CenterTeacherViewSet

router = DefaultRouter()
router.register('students', CenterStudentViewSet, basename='center-students')
router.register('teachers', CenterTeacherViewSet, basename='center-teachers')
router.register('tests', CenterTestViewSet, basename='center-tests')
router.register('mock', CenterMockSessionViewSet, basename='center-mock')

urlpatterns = router.urls + [
    path('analytics/', CenterAnalyticsView.as_view(), name='center-analytics'),
    path(
        'analytics/export.xlsx',
        CenterAnalyticsExcelView.as_view(),
        name='center-analytics-export',
    ),
]
