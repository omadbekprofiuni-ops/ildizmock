from django.urls import path
from rest_framework.routers import DefaultRouter

from .admin_views import (
    AdminDashboardView,
    AdminPassageViewSet,
    AdminQuestionViewSet,
    AdminTestViewSet,
)
from .upload_views import AudioUploadView
from .views import TestCountsView, TestViewSet

router = DefaultRouter()
router.register(r'tests', TestViewSet, basename='tests')
router.register(r'admin/tests', AdminTestViewSet, basename='admin-tests')
router.register(r'admin/passages', AdminPassageViewSet, basename='admin-passages')
router.register(r'admin/questions', AdminQuestionViewSet, basename='admin-questions')

urlpatterns = [
    path('admin/stats/overview', AdminDashboardView.as_view()),
    path('admin/upload/audio', AudioUploadView.as_view()),
    path('tests/counts/', TestCountsView.as_view()),
] + router.urls
