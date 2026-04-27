from django.urls import path
from rest_framework.routers import DefaultRouter

from .admin_views import (
    AdminDashboardView,
    AdminPassageViewSet,
    AdminQuestionViewSet,
    AdminTestViewSet,
)
from .super_views import (
    SuperListeningPartViewSet,
    SuperPassageViewSet,
    SuperQuestionViewSet,
    SuperTestViewSet,
    SuperWritingTaskViewSet,
)
from .upload_views import AudioUploadView
from .views import TestCountsView, TestViewSet

router = DefaultRouter()
router.register(r'tests', TestViewSet, basename='tests')
router.register(r'admin/tests', AdminTestViewSet, basename='admin-tests')
router.register(r'admin/passages', AdminPassageViewSet, basename='admin-passages')
router.register(r'admin/questions', AdminQuestionViewSet, basename='admin-questions')

# ETAP 2: SuperAdmin / Wizard
router.register(r'super/tests', SuperTestViewSet, basename='super-tests')
router.register(
    r'super/listening-parts', SuperListeningPartViewSet,
    basename='super-listening-parts',
)
router.register(r'super/passages', SuperPassageViewSet, basename='super-passages')
router.register(
    r'super/writing-tasks', SuperWritingTaskViewSet,
    basename='super-writing-tasks',
)
router.register(
    r'super/questions', SuperQuestionViewSet, basename='super-questions',
)

urlpatterns = [
    path('admin/stats/overview', AdminDashboardView.as_view()),
    path('admin/upload/audio', AudioUploadView.as_view()),
    path('tests/counts/', TestCountsView.as_view()),
] + router.urls
