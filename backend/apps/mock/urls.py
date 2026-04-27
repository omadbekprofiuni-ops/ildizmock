"""Mock app — student-facing public URLs.

Centre-admin URLs `apps/center/urls.py` ga qo'shilgan.
"""

from django.urls import path

from . import student_views

urlpatterns = [
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
        'mock/result/<str:browser_session_id>/',
        student_views.my_result,
        name='mock-result',
    ),
]
