from django.urls import path
from rest_framework.routers import DefaultRouter

from .practice_views import PracticeHistoryView
from .student_writing_views import MyDashboardView, MyWritingsView, SubmitWritingView
from .teacher_views import TeacherQueueView, TeacherStudentsView, TeacherSubmissionViewSet
from .views import AttemptViewSet, StartAttemptView

router = DefaultRouter()
router.register(r'attempts', AttemptViewSet, basename='attempts')
router.register(
    r'teacher/submissions', TeacherSubmissionViewSet, basename='teacher-submissions',
)

urlpatterns = [
    path('tests/<uuid:test_id>/attempts', StartAttemptView.as_view()),
    path('attempts/<uuid:pk>/submit-writing/', SubmitWritingView.as_view()),
    path('me/writings/', MyWritingsView.as_view()),
    path('me/dashboard/', MyDashboardView.as_view()),
    path('me/practice/history/', PracticeHistoryView.as_view()),
    path('teacher/queue/', TeacherQueueView.as_view()),
    path('teacher/students/', TeacherStudentsView.as_view()),
] + router.urls
