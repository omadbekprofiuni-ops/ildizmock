from rest_framework.routers import DefaultRouter

from apps.mock.admin_views import CenterMockSessionViewSet

from .tests_views import CenterTestViewSet
from .views import CenterStudentViewSet, CenterTeacherViewSet

router = DefaultRouter()
router.register('students', CenterStudentViewSet, basename='center-students')
router.register('teachers', CenterTeacherViewSet, basename='center-teachers')
router.register('tests', CenterTestViewSet, basename='center-tests')
router.register('mock', CenterMockSessionViewSet, basename='center-mock')

urlpatterns = router.urls
