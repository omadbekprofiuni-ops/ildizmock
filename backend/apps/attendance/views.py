"""ETAP 15 — Attendance API.

Center admin va o'qituvchi guruh davomatini boshqarishi uchun endpoints.
URL pattern: /api/v1/center/<slug>/attendance/...
"""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db.models import Avg, Count, Q
from django.db.models.functions import TruncMonth
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.organizations.models import (
    Organization,
    OrganizationMembership,
    StudentGroup,
)

from .models import AttendanceRecord, AttendanceSession, ClassSchedule
from .serializers import (
    AttendanceSessionCreateSerializer,
    AttendanceSessionDetailSerializer,
    AttendanceSessionListSerializer,
    BulkMarkSerializer,
    ClassScheduleSerializer,
)

User = get_user_model()


# ===== Helpers =====


def _get_org_or_403(user, slug: str) -> Organization:
    org = get_object_or_404(Organization, slug=slug)
    if org.status != 'active':
        raise PermissionDenied('Center is not active.')
    if user.role == 'superadmin':
        return org
    is_admin = OrganizationMembership.objects.filter(
        user=user, organization=org, role__in=['admin', 'owner'],
    ).exists()
    if is_admin:
        return org
    if user.role == 'teacher' and user.organization_id == org.id:
        return org
    raise PermissionDenied('Siz bu markaz a\'zosi emassiz.')


def _is_admin(user, org: Organization) -> bool:
    if user.role == 'superadmin':
        return True
    return OrganizationMembership.objects.filter(
        user=user, organization=org, role__in=['admin', 'owner'],
    ).exists()


def _scope_groups_for_user(user, org: Organization):
    """Admin — barcha guruhlar, teacher — faqat o'zining."""
    qs = StudentGroup.objects.filter(organization=org, is_active=True)
    if not _is_admin(user, org):
        qs = qs.filter(teacher=user)
    return qs


# ===== Schedules =====


class CenterScheduleViewSet(viewsets.ModelViewSet):
    """`/api/v1/center/<slug>/groups/<group_id>/schedules/` — guruh jadvali."""

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ClassScheduleSerializer

    def get_organization(self) -> Organization:
        return _get_org_or_403(self.request.user, self.kwargs['org_slug'])

    def get_group(self) -> StudentGroup:
        org = self.get_organization()
        group = get_object_or_404(
            StudentGroup, pk=self.kwargs['group_pk'], organization=org,
        )
        if not _is_admin(self.request.user, org) and group.teacher_id != self.request.user.id:
            raise PermissionDenied('Only the group teacher or admin.')
        return group

    def get_queryset(self):
        return ClassSchedule.objects.filter(group=self.get_group())

    def perform_create(self, serializer):
        group = self.get_group()
        if not _is_admin(self.request.user, self.get_organization()):
            raise PermissionDenied('Only an admin can create a schedule.')
        serializer.save(group=group, created_by=self.request.user)

    def perform_update(self, serializer):
        if not _is_admin(self.request.user, self.get_organization()):
            raise PermissionDenied('Only an admin can edit.')
        serializer.save()

    def perform_destroy(self, instance):
        if not _is_admin(self.request.user, self.get_organization()):
            raise PermissionDenied('Only an admin can delete.')
        instance.delete()


# ===== Sessions =====


class CenterAttendanceSessionViewSet(viewsets.ModelViewSet):
    """`/api/v1/center/<slug>/attendance/sessions/` — sessiya CRUD + mark."""

    permission_classes = [permissions.IsAuthenticated]

    def get_organization(self) -> Organization:
        return _get_org_or_403(self.request.user, self.kwargs['org_slug'])

    def get_serializer_class(self):
        if self.action == 'create':
            return AttendanceSessionCreateSerializer
        if self.action == 'retrieve':
            return AttendanceSessionDetailSerializer
        return AttendanceSessionListSerializer

    def get_queryset(self):
        org = self.get_organization()
        groups = _scope_groups_for_user(self.request.user, org)
        qs = AttendanceSession.objects.filter(group__in=groups).select_related('group')
        when = self.request.query_params.get('when', 'all')
        today = timezone.now().date()
        if when == 'today':
            qs = qs.filter(date=today)
        elif when == 'upcoming':
            qs = qs.filter(date__gt=today)
        elif when == 'past':
            qs = qs.filter(date__lt=today)
        group_id = self.request.query_params.get('group')
        if group_id:
            qs = qs.filter(group_id=group_id)
        return qs

    def create(self, request, *args, **kwargs):
        org = self.get_organization()
        ser = self.get_serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        group = ser.validated_data['group']

        # Permission: faqat admin yoki guruh o'qituvchisi
        if not (_is_admin(request.user, org) or group.teacher_id == request.user.id):
            raise PermissionDenied('Only the admin or group teacher.')
        if group.organization_id != org.id:
            raise ValidationError('Group boshqa markazdan.')

        # Session ham talaba yozuvlari ham bir tranzaksiyada
        from django.db import transaction
        with transaction.atomic():
            session = ser.save(created_by=request.user)
            for student in group.members.filter(role='student', is_active=True):
                AttendanceRecord.objects.create(
                    session=session,
                    student=student,
                    status='present',
                    marked_by=request.user,
                )
        return Response(
            AttendanceSessionDetailSerializer(session).data,
            status=status.HTTP_201_CREATED,
        )

    def destroy(self, request, *args, **kwargs):
        session = self.get_object()
        org = self.get_organization()
        if not _is_admin(request.user, org):
            raise PermissionDenied('Only an admin can delete.')
        if session.is_finalized:
            raise ValidationError('Cannot delete a finished session.')
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'], url_path='bulk-mark')
    def bulk_mark(self, request, pk=None, org_slug=None):
        """Bir nechta yozuvni birgalikda yangilash."""
        session = self.get_object()
        if session.is_finalized:
            return Response(
                {'detail': 'Session has ended.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ser = BulkMarkSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        updated = 0
        for item in ser.validated_data['records']:
            try:
                rec = AttendanceRecord.objects.get(
                    pk=item['record_id'], session=session,
                )
            except AttendanceRecord.DoesNotExist:
                continue
            rec.status = item['status']
            rec.notes = item.get('notes', '') or ''
            rec.marked_by = request.user
            rec.save(update_fields=['status', 'notes', 'marked_by', 'marked_at'])
            updated += 1

        return Response({
            'updated': updated,
            'attendance_rate': session.get_attendance_rate(),
        })

    @action(detail=True, methods=['post'])
    def finalize(self, request, pk=None, org_slug=None):
        """Sessiyani yopish — keyin o'zgartirib bo'lmaydi."""
        session = self.get_object()
        if session.is_finalized:
            return Response({'detail': 'Already ended.'})
        session.is_finalized = True
        session.save(update_fields=['is_finalized', 'updated_at'])
        return Response({'detail': 'Session ended.', 'is_finalized': True})

    @action(detail=True, methods=['post'])
    def reopen(self, request, pk=None, org_slug=None):
        """Yakunlangan sessiyani qayta ochish (faqat admin)."""
        org = self.get_organization()
        if not _is_admin(request.user, org):
            raise PermissionDenied('Faqat admin qayta ocha oladi.')
        session = self.get_object()
        session.is_finalized = False
        session.save(update_fields=['is_finalized', 'updated_at'])
        return Response({'detail': 'Session reopened.', 'is_finalized': False})


# ===== Reports =====


class StudentAttendanceReportView(APIView):
    """Bitta talaba davomati statistikasi."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, org_slug=None, student_id=None):
        org = _get_org_or_403(request.user, org_slug)
        student = get_object_or_404(
            User, pk=student_id, organization=org, role='student',
        )
        # Teacher faqat o'z guruhi talabasini ko'radi
        if not _is_admin(request.user, org):
            if request.user.role != 'teacher' or (
                student.group is None
                or student.group.teacher_id != request.user.id
            ):
                raise PermissionDenied('Only students in your own group.')

        records = AttendanceRecord.objects.filter(
            student=student, session__group__organization=org,
        ).select_related('session', 'session__group').order_by('-session__date')

        total = records.count()
        present = records.filter(status__in=['present', 'late']).count()
        absent = records.filter(status='absent').count()
        late = records.filter(status='late').count()
        excused = records.filter(status='excused').count()
        sick = records.filter(status='sick').count()
        rate = round(present / total * 100, 1) if total else 0.0

        # 6 oylik breakdown
        monthly = (
            records.annotate(month=TruncMonth('session__date'))
            .values('month')
            .annotate(
                total=Count('id'),
                present=Count('id', filter=Q(status__in=['present', 'late'])),
                absent=Count('id', filter=Q(status='absent')),
            )
            .order_by('-month')[:6]
        )

        recent = list(records[:30].values(
            'id', 'status', 'notes',
            'session__id', 'session__date',
            'session__group__name',
        ))
        for r in recent:
            r['session_id'] = r.pop('session__id')
            r['session_date'] = r.pop('session__date').isoformat()
            r['group_name'] = r.pop('session__group__name')
            r['status_label'] = dict(AttendanceRecord.STATUS_CHOICES).get(r['status'])

        return Response({
            'student': {
                'id': student.id,
                'username': student.username,
                'name': f'{student.first_name} {student.last_name}'.strip()
                or student.username,
                'group': student.group.name if student.group_id else None,
            },
            'stats': {
                'total': total,
                'present': present,
                'absent': absent,
                'late': late,
                'excused': excused,
                'sick': sick,
                'rate': rate,
            },
            'monthly': [
                {
                    'month': m['month'].strftime('%b %Y') if m['month'] else None,
                    'total': m['total'],
                    'present': m['present'],
                    'absent': m['absent'],
                }
                for m in monthly
            ],
            'recent': recent,
        })


class GroupAttendanceReportView(APIView):
    """Group davomati statistikasi (har talaba uchun rate)."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, org_slug=None, group_id=None):
        org = _get_org_or_403(request.user, org_slug)
        group = get_object_or_404(
            StudentGroup, pk=group_id, organization=org,
        )
        if not _is_admin(request.user, org) and group.teacher_id != request.user.id:
            raise PermissionDenied('Only the admin or group teacher.')

        sessions = list(
            group.attendance_sessions.order_by('-date')[:30]
            .values('id', 'date', 'is_finalized')
        )
        for s in sessions:
            s['date'] = s['date'].isoformat()

        students_data = []
        for student in group.members.filter(role='student').order_by(
            'first_name', 'last_name',
        ):
            recs = AttendanceRecord.objects.filter(
                student=student, session__group=group,
            )
            total = recs.count()
            present = recs.filter(status__in=['present', 'late']).count()
            rate = round(present / total * 100, 1) if total else 0.0
            students_data.append({
                'id': student.id,
                'name': f'{student.first_name} {student.last_name}'.strip()
                or student.username,
                'username': student.username,
                'total': total,
                'present': present,
                'absent': recs.filter(status='absent').count(),
                'rate': rate,
            })

        students_data.sort(key=lambda r: r['rate'], reverse=True)

        avg_rate = (
            round(sum(s['rate'] for s in students_data) / len(students_data), 1)
            if students_data else 0.0
        )

        return Response({
            'group': {
                'id': group.id, 'name': group.name,
                'student_count': len(students_data),
            },
            'avg_rate': avg_rate,
            'sessions_count': len(sessions),
            'students': students_data,
            'recent_sessions': sessions,
        })


# ===== Helper for dashboard =====


class AttendanceTodayView(APIView):
    """Today's sessiyalar (dashboard kartochkasi uchun)."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, org_slug=None):
        org = _get_org_or_403(request.user, org_slug)
        groups = _scope_groups_for_user(request.user, org)
        today = timezone.now().date()
        sessions = AttendanceSession.objects.filter(
            group__in=groups, date=today,
        ).select_related('group').order_by('start_time')
        data = [{
            'id': s.id,
            'group_id': s.group_id,
            'group_name': s.group.name,
            'start_time': s.start_time.strftime('%H:%M') if s.start_time else None,
            'end_time': s.end_time.strftime('%H:%M') if s.end_time else None,
            'is_finalized': s.is_finalized,
            'rate': s.get_attendance_rate(),
            'total': s.records.count(),
        } for s in sessions]
        return Response({'date': today.isoformat(), 'sessions': data})
