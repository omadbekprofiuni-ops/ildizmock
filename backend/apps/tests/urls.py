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
from .super_audio_views import SuperAdminAudioListView
from .pdf_views import (
    create_pdf_test,
    delete_pdf_test,
    get_pdf_test,
    list_all_tests_for_center,
    list_pdf_tests,
    list_student_pdf_tests,
    submit_pdf_test,
    update_pdf_test,
)
from .upload_views import AudioUploadView, ImageUploadView
from .views import PracticeStatsView, TestCountsView, TestViewSet
from .views_answer_sheet import AnswerSheetPreviewView
from .views_audio_health import AudioHealthCheckView
from .views_available_for_mock import AvailableTestsForMockView
from .views_html_content import HtmlContentPreviewView
from .views_pdf_import import PDFImportConfirmView, PDFImportPreviewView
from .views_library import (
    LibraryCloneToOrgView,
    LibraryTestDetailView,
    LibraryTestListView,
)
from .views_smart_paste import (
    SmartPasteCreateView,
    SmartPasteExcelImportView,
    SmartPasteExcelTemplateView,
    SmartPastePreviewView,
)

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
    path('admin/upload/image', ImageUploadView.as_view()),
    path('tests/counts/', TestCountsView.as_view()),
    path('practice/stats/', PracticeStatsView.as_view()),
    path('super/audio/', SuperAdminAudioListView.as_view(), name='super-audio'),

    # ETAP 24 — Smart Paste / Excel
    path('admin/smart-paste/preview/', SmartPastePreviewView.as_view(),
         name='smart-paste-preview'),
    path('admin/smart-paste/create/', SmartPasteCreateView.as_view(),
         name='smart-paste-create'),
    path('admin/smart-paste/import-excel/', SmartPasteExcelImportView.as_view(),
         name='smart-paste-excel'),
    path('admin/smart-paste/excel-template.xlsx',
         SmartPasteExcelTemplateView.as_view(),
         name='smart-paste-template'),

    # ETAP 27 — Smart Answer Sheet (pasted answer key only, qtype auto-detect)
    path('admin/answer-sheet/preview/', AnswerSheetPreviewView.as_view(),
         name='answer-sheet-preview'),

    # ETAP 30 — HTML Test Platform (DSL → HTML preview + validation)
    path('admin/html-content/preview/', HtmlContentPreviewView.as_view(),
         name='html-content-preview'),

    # ETAP 31 — Smart PDF Import (extract structured questions from a PDF)
    path('admin/tests/import-pdf/preview/', PDFImportPreviewView.as_view(),
         name='pdf-import-preview'),
    path('admin/tests/import-pdf/confirm/', PDFImportConfirmView.as_view(),
         name='pdf-import-confirm'),

    # HOTFIX — Mock session test dropdown'i uchun yagona endpoint
    # (org-owned + library testlarni birlashtirib qaytaradi)
    path('admin/available-for-mock/', AvailableTestsForMockView.as_view(),
         name='admin-available-for-mock'),

    # HOTFIX — Audio playback diagnostic vositasi (admin)
    path('admin/audio-health/', AudioHealthCheckView.as_view(),
         name='admin-audio-health'),

    # ETAP 27 — Library (superadmin global testlar, markaz clone qiladi)
    path('library/tests/', LibraryTestListView.as_view(),
         name='library-tests-list'),
    path('library/tests/<uuid:pk>/', LibraryTestDetailView.as_view(),
         name='library-tests-detail'),
    path('library/tests/<uuid:pk>/clone-to-org/',
         LibraryCloneToOrgView.as_view(),
         name='library-tests-clone'),

    # PDF Tests (PDF + audio + answer key)
    path('pdf-tests/create/', create_pdf_test, name='create-pdf-test'),
    path('pdf-tests/', list_pdf_tests, name='list-pdf-tests'),
    path('pdf-tests/student/', list_student_pdf_tests, name='list-student-pdf-tests'),
    path('pdf-tests/<uuid:test_id>/', get_pdf_test, name='get-pdf-test'),
    path('pdf-tests/<uuid:test_id>/update/', update_pdf_test, name='update-pdf-test'),
    path('pdf-tests/<uuid:test_id>/delete/', delete_pdf_test, name='delete-pdf-test'),
    path('pdf-tests/<uuid:test_id>/submit/', submit_pdf_test, name='submit-pdf-test'),
    path(
        'center/<slug:slug>/tests/all/', list_all_tests_for_center,
        name='list-all-tests-for-center',
    ),
] + router.urls
