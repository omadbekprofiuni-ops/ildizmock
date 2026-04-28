"""ETAP 11 — Talabalar guruhlari API.

CenterAdmin markazning barcha guruhlarini ko'radi va boshqaradi.
O'qituvchi faqat o'zining (teaching_groups) guruhlarini ko'radi
(read-only — talabani guruhdan o'chirish faqat admin huquqida).
"""

from datetime import date

from django.contrib.auth import get_user_model
from django.db.models import Avg, Count
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from apps.mock.models import MockParticipant, MockSession
from apps.organizations.models import (
    Organization,
    OrganizationMembership,
    StudentGroup,
)

from .groups_serializers import (
    GroupMemberSerializer,
    StudentGroupDetailSerializer,
    StudentGroupListSerializer,
    StudentGroupWriteSerializer,
)

User = get_user_model()


# ---------- Aggregation helpers ----------


def _group_avg(group: StudentGroup):
    """Guruhning butun davr bo'yicha o'rtacha overall band balli."""
    val = (
        MockParticipant.objects.filter(
            user__group=group,
            overall_band_score__isnull=False,
        )
        .aggregate(avg=Avg('overall_band_score'))['avg']
    )
    return float(val) if val is not None else None


def _group_latest_session(group: StudentGroup):
    return (
        MockSession.objects.filter(
            organization=group.organization,
            participants__user__group=group,
            participants__overall_band_score__isnull=False,
        )
        .distinct()
        .order_by('-date')
        .first()
    )


def _group_session_avg(group: StudentGroup, session: MockSession):
    val = (
        MockParticipant.objects.filter(
            session=session,
            user__group=group,
            overall_band_score__isnull=False,
        )
        .aggregate(avg=Avg('overall_band_score'))['avg']
    )
    return float(val) if val is not None else None


def _group_latest_avg(group: StudentGroup):
    s = _group_latest_session(group)
    return _group_session_avg(group, s) if s else None


def _group_trend(group: StudentGroup):
    """`improving` / `declining` / `stable` / `insufficient_data`."""
    sessions = list(
        MockSession.objects.filter(
            organization=group.organization,
            participants__user__group=group,
            participants__overall_band_score__isnull=False,
            status='finished',
        )
        .distinct()
        .order_by('-date')[:2]
    )
    if len(sessions) < 2:
        return 'insufficient_data'
    recent = _group_session_avg(group, sessions[0])
    previous = _group_session_avg(group, sessions[1])
    if recent is None or previous is None:
        return 'insufficient_data'
    diff = recent - previous
    if diff > 0.2:
        return 'improving'
    if diff < -0.2:
        return 'declining'
    return 'stable'


def _group_progress_chart(group: StudentGroup, last_n: int = 5):
    sessions = list(
        MockSession.objects.filter(
            organization=group.organization,
            participants__user__group=group,
            participants__overall_band_score__isnull=False,
        )
        .distinct()
        .order_by('-date')[:last_n]
    )
    out = []
    for s in reversed(sessions):
        avg = _group_session_avg(group, s)
        out.append({
            'session_id': s.id,
            'name': s.name,
            'date': s.date.isoformat() if s.date else None,
            'avg': round(avg, 1) if avg is not None else None,
        })
    return out


def _enrich_group_for_list(group: StudentGroup):
    group.student_count = group.members.count()
    group.avg_score = _group_avg(group)
    group.latest_avg = _group_latest_avg(group)
    group.trend = _group_trend(group)
    return group


def _enrich_member(student: User):
    qs = MockParticipant.objects.filter(
        user=student, overall_band_score__isnull=False,
    )
    student.test_count = qs.count()
    student.avg_band = (
        float(qs.aggregate(a=Avg('overall_band_score'))['a'])
        if student.test_count else None
    )
    latest = qs.order_by('-session__date').first()
    student.latest_band = float(latest.overall_band_score) if latest else None
    return student


# ---------- Viewset ----------


class CenterGroupViewSet(viewsets.ModelViewSet):
    """`/api/center/<slug>/groups/` — markaz guruhlari CRUD + aggregatsiya."""

    permission_classes = [permissions.IsAuthenticated]
    lookup_field = 'pk'

    def get_organization(self) -> Organization:
        slug = self.kwargs['org_slug']
        org = get_object_or_404(Organization, slug=slug)
        if org.status != 'active':
            raise PermissionDenied('Markaz faol holatda emas.')

        user = self.request.user
        if user.role == 'superadmin':
            return org
        # Markaz admini bo'lsin
        is_admin = OrganizationMembership.objects.filter(
            user=user, organization=org, role__in=['admin', 'owner'],
        ).exists()
        if is_admin:
            return org
        # O'qituvchi — read-only access faqat o'z guruhlariga
        if user.role == 'teacher' and user.organization_id == org.id:
            return org
        raise PermissionDenied('Siz bu markazga ulanmagansiz.')

    def _is_admin(self) -> bool:
        user = self.request.user
        if user.role == 'superadmin':
            return True
        org = get_object_or_404(Organization, slug=self.kwargs['org_slug'])
        return OrganizationMembership.objects.filter(
            user=user, organization=org, role__in=['admin', 'owner'],
        ).exists()

    def get_queryset(self):
        org = self.get_organization()
        qs = StudentGroup.objects.filter(organization=org).select_related(
            'teacher', 'organization',
        )
        if self.request.user.role == 'teacher' and not self._is_admin():
            qs = qs.filter(teacher=self.request.user)
        return qs.order_by('-created_at')

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return StudentGroupWriteSerializer
        if self.action == 'retrieve':
            return StudentGroupDetailSerializer
        return StudentGroupListSerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['organization'] = self.get_organization()
        return ctx

    # ---------- write actions (admin only) ----------

    def create(self, request, *args, **kwargs):
        if not self._is_admin():
            raise PermissionDenied('Faqat markaz admini guruh yarata oladi.')
        ser = self.get_serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        group = ser.save()
        return Response(
            StudentGroupDetailSerializer(_enrich_group_for_list(group)).data,
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        if not self._is_admin():
            raise PermissionDenied('Faqat admin tahrirlay oladi.')
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        if not self._is_admin():
            raise PermissionDenied('Faqat admin tahrirlay oladi.')
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not self._is_admin():
            raise PermissionDenied('Faqat admin o‘chira oladi.')
        return super().destroy(request, *args, **kwargs)

    # ---------- list / detail ----------

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        groups = [_enrich_group_for_list(g) for g in qs]
        ser = StudentGroupListSerializer(groups, many=True)
        return Response(ser.data)

    def retrieve(self, request, *args, **kwargs):
        group = self.get_object()
        _enrich_group_for_list(group)
        members = list(group.members.filter(role='student').order_by(
            'first_name', 'last_name',
        ))
        for m in members:
            _enrich_member(m)
        # progress chart
        group.progress_chart = _group_progress_chart(group)
        # attach members for serializer
        group._prefetched_members = members
        ser = StudentGroupDetailSerializer(group)
        data = ser.data
        # serializer.members is from FK reverse — enrichment ignored.
        # Re-render members manually with stats:
        data['members'] = GroupMemberSerializer(members, many=True).data
        return Response(data)

    # ---------- members ----------

    @action(detail=True, methods=['get'], url_path='available-students')
    def available_students(self, request, *args, **kwargs):
        """Markazda mavjud, hech qaysi guruhga biriktirilmagan talabalar."""
        if not self._is_admin():
            raise PermissionDenied('Faqat admin')
        org = self.get_organization()
        qs = User.objects.filter(
            organization=org, role='student', is_active=True,
            group__isnull=True,
        ).order_by('first_name', 'last_name')
        ser = GroupMemberSerializer(qs, many=True)
        return Response(ser.data)

    @action(detail=True, methods=['post'], url_path='add-students')
    def add_students(self, request, *args, **kwargs):
        if not self._is_admin():
            raise PermissionDenied('Faqat admin talaba qo‘sha oladi.')
        group = self.get_object()
        ids = request.data.get('student_ids') or []
        if not isinstance(ids, list):
            raise ValidationError('student_ids array bo‘lishi kerak.')

        org = self.get_organization()
        added = 0
        for sid in ids:
            try:
                u = User.objects.get(id=sid, organization=org, role='student')
            except User.DoesNotExist:
                continue
            u.group = group
            if not u.enrolled_at:
                u.enrolled_at = date.today()
            u.save(update_fields=['group', 'enrolled_at'])
            added += 1
        return Response({'added': added})

    @action(
        detail=True, methods=['post', 'delete'],
        url_path=r'remove-student/(?P<student_id>[^/.]+)',
    )
    def remove_student(self, request, student_id=None, *args, **kwargs):
        if not self._is_admin():
            raise PermissionDenied('Faqat admin talabani guruhdan chiqara oladi.')
        group = self.get_object()
        try:
            u = User.objects.get(id=student_id, group=group)
        except User.DoesNotExist:
            raise ValidationError('Talaba bu guruhda emas.')
        u.group = None
        u.save(update_fields=['group'])
        return Response({'detail': 'O‘chirildi.'})

    # ---------- comparison ----------

    @action(detail=False, methods=['get'])
    def comparison(self, request, *args, **kwargs):
        """Barcha guruhlarni taqqoslash (admin uchun)."""
        if not self._is_admin():
            raise PermissionDenied('Faqat admin')
        org = self.get_organization()
        groups = list(
            StudentGroup.objects.filter(organization=org, is_active=True)
            .select_related('teacher')
            .annotate(_count=Count('members')),
        )
        rows = []
        for g in groups:
            avg = _group_avg(g)
            latest = _group_latest_avg(g)
            rows.append({
                'id': g.id,
                'name': g.name,
                'teacher': (
                    g.teacher.get_full_name() or g.teacher.username
                    if g.teacher else None
                ),
                'student_count': g._count,
                'avg_score': round(avg, 2) if avg is not None else None,
                'latest_avg': round(latest, 2) if latest is not None else None,
                'target_band_score': (
                    float(g.target_band_score) if g.target_band_score else None
                ),
                'trend': _group_trend(g),
            })
        rows.sort(
            key=lambda r: r['avg_score'] if r['avg_score'] is not None else -1,
            reverse=True,
        )
        return Response(rows)
