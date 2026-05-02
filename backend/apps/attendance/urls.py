"""ETAP 15 URL routing.

Mounted at /api/v1/center/<slug>/ in apps/center/urls.py:
- attendance/sessions/      — session list/CRUD
- groups/<id>/schedules/    — guruh haftalik jadvali
- attendance/students/<id>/report/  — talaba report
- attendance/groups/<id>/report/    — guruh report
- attendance/today/                 — bugungi sessiyalar
"""

from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    AttendanceTodayView,
    CenterAttendanceSessionViewSet,
    CenterScheduleViewSet,
    GroupAttendanceReportView,
    StudentAttendanceReportView,
)

session_router = DefaultRouter()
session_router.register(
    r'attendance/sessions', CenterAttendanceSessionViewSet,
    basename='attendance-sessions',
)


# Schedules — nested under groups: /groups/<group_pk>/schedules/
schedule_list = CenterScheduleViewSet.as_view({'get': 'list', 'post': 'create'})
schedule_detail = CenterScheduleViewSet.as_view({
    'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy',
})

urlpatterns = session_router.urls + [
    path(
        'groups/<int:group_pk>/schedules/',
        schedule_list, name='group-schedule-list',
    ),
    path(
        'groups/<int:group_pk>/schedules/<int:pk>/',
        schedule_detail, name='group-schedule-detail',
    ),
    path(
        'attendance/today/',
        AttendanceTodayView.as_view(), name='attendance-today',
    ),
    path(
        'attendance/students/<int:student_id>/report/',
        StudentAttendanceReportView.as_view(), name='student-attendance-report',
    ),
    path(
        'attendance/groups/<int:group_id>/report/',
        GroupAttendanceReportView.as_view(), name='group-attendance-report',
    ),
]
