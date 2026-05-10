from django.urls import path
from rest_framework.routers import DefaultRouter

from .practice_views import PracticeHistoryView
from .student_views import (
    StudentAttemptDetailView,
    StudentSaveAnswerView,
    StudentStartTestView,
    StudentSubmitView,
    StudentTestDetailView,
    StudentTestListView,
    StudentUploadRecordingView,
)
from .violation_views import (
    AttemptViolationsView,
    OrgStrictModeSettingsView,
    RecordViolationView,
)
from .student_writing_views import MyDashboardView, MyWritingsView, SubmitWritingView
from .teacher_views import (
    TeacherQueueView,
    TeacherStudentsView,
    TeacherStudentStatsView,
    TeacherSubmissionViewSet,
)
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
    path('teacher/students/<int:student_id>/stats/', TeacherStudentStatsView.as_view()),

    # ETAP 25 — /student/* aliases for the new mock-test loop.
    path('student/tests/', StudentTestListView.as_view()),
    path('student/tests/<uuid:test_id>/', StudentTestDetailView.as_view()),
    path('student/tests/<uuid:test_id>/start/', StudentStartTestView.as_view()),
    path('student/attempts/<uuid:attempt_id>/',
         StudentAttemptDetailView.as_view()),
    path('student/attempts/<uuid:attempt_id>/answer/',
         StudentSaveAnswerView.as_view()),
    path('student/attempts/<uuid:attempt_id>/submit/',
         StudentSubmitView.as_view()),
    path('student/attempts/<uuid:attempt_id>/upload-recording/',
         StudentUploadRecordingView.as_view()),

    # ETAP 29 — Strict Test Mode (anti-cheating)
    path('student/attempts/<uuid:attempt_id>/violations/',
         RecordViolationView.as_view(),
         name='strict-record-violation'),
    path('admin/attempts/<uuid:attempt_id>/violations/',
         AttemptViolationsView.as_view(),
         name='strict-attempt-violations'),
    path('admin/strict-mode-settings/',
         OrgStrictModeSettingsView.as_view(),
         name='strict-mode-settings'),
] + router.urls
