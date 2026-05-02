"""Mock app — student va teacher URL'lari.

Centre-admin URL'lari `apps/center/urls.py` ga qo'shilgan.
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import me_views, student_views
from .teacher_views import TeacherMockViewSet

teacher_router = DefaultRouter()
teacher_router.register('mock', TeacherMockViewSet, basename='teacher-mock')

urlpatterns = [
    path('teacher/', include(teacher_router.urls)),

    # Login qilingan talaba — o'z mock natijalari
    path('student/mock/results/', me_views.my_mock_results, name='my-mock-results'),
    path(
        'student/mock/results/<int:participant_id>/',
        me_views.my_mock_detail, name='my-mock-detail',
    ),
    path(
        'student/mock/results/<int:participant_id>/certificate/',
        me_views.my_mock_certificate, name='my-mock-certificate',
    ),

    # ETAP 20 — Persistent sertifikatlar
    path(
        'student/certificates/',
        me_views.my_certificates, name='my-certificates',
    ),
    path(
        'student/certificates/<int:certificate_id>/download/',
        me_views.my_certificate_download, name='my-certificate-download',
    ),
    path(
        'verify/<str:verification_code>/',
        me_views.verify_certificate, name='verify-certificate',
    ),
    path(
        'mock/join/<str:access_code>/',
        student_views.join_view,
        name='mock-join',
    ),
    path(
        'mock/state/<str:browser_session_id>/',
        student_views.state_view,
        name='mock-state',
    ),
    path(
        'mock/section/<str:browser_session_id>/',
        student_views.section_data_view,
        name='mock-section',
    ),
    path(
        'mock/submit/listening/<str:browser_session_id>/',
        student_views.submit_listening,
        name='mock-submit-listening',
    ),
    path(
        'mock/submit/reading/<str:browser_session_id>/',
        student_views.submit_reading,
        name='mock-submit-reading',
    ),
    path(
        'mock/submit/writing/<str:browser_session_id>/',
        student_views.submit_writing,
        name='mock-submit-writing',
    ),
    path(
        'mock/submit/speaking/<str:browser_session_id>/',
        student_views.submit_speaking,
        name='mock-submit-speaking',
    ),
    path(
        'mock/result/<str:browser_session_id>/',
        student_views.my_result,
        name='mock-result',
    ),
]
