from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from apps.organizations.models import Organization, OrganizationMembership
from apps.organizations.permissions import IsCenterAdmin

from .serializers import (
    StudentCreateSerializer,
    StudentReadSerializer,
    StudentUpdateSerializer,
    TeacherCreateSerializer,
    TeacherReadSerializer,
    TeacherUpdateSerializer,
    generate_password,
)

User = get_user_model()


class _OrgScopedViewSetMixin:
    """Helper: URL dagi <slug:org_slug> ni Organization ga aylantirish."""

    def get_organization(self) -> Organization:
        slug = self.kwargs['org_slug']
        org = get_object_or_404(Organization, slug=slug)
        if org.status != 'active':
            raise PermissionDenied('Markaz faol holatda emas.')

        if self.request.user.role != 'superadmin':
            is_admin = OrganizationMembership.objects.filter(
                user=self.request.user, organization=org,
                role__in=['admin', 'owner'],
            ).exists()
            if not is_admin:
                raise PermissionDenied('Siz bu markaz admini emassiz.')
        return org


class CenterStudentViewSet(_OrgScopedViewSetMixin, viewsets.ModelViewSet):
    """Markaz talabalari CRUD."""

    permission_classes = [permissions.IsAuthenticated, IsCenterAdmin]
    lookup_field = 'pk'

    def get_queryset(self):
        org = self.get_organization()
        return User.objects.filter(
            org_memberships__organization=org,
            org_memberships__role='student',
        ).distinct().order_by('first_name', 'last_name')

    def get_serializer_class(self):
        if self.action == 'create':
            return StudentCreateSerializer
        if self.action in ('update', 'partial_update'):
            return StudentUpdateSerializer
        return StudentReadSerializer

    def create(self, request, *args, **kwargs):
        org = self.get_organization()
        ser = StudentCreateSerializer(
            data=request.data, context={'organization': org, 'request': request},
        )
        ser.is_valid(raise_exception=True)
        student = ser.save()

        return Response({
            'student': StudentReadSerializer(student).data,
            'credentials': {
                'username': student.username,
                'password': student._generated_password,
                'login_url': f'/{org.slug}/login',
            },
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='reset-password')
    def reset_password(self, request, pk=None, **kwargs):
        student = self.get_object()
        new_pass = generate_password()
        student.set_password(new_pass)
        student.save(update_fields=['password'])
        return Response({
            'username': student.username,
            'new_password': new_pass,
        })

    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None, **kwargs):
        student = self.get_object()
        student.is_active = False
        student.save(update_fields=['is_active'])
        return Response({'detail': 'Talaba o‘chirildi (deactivated).'})

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None, **kwargs):
        student = self.get_object()
        student.is_active = True
        student.save(update_fields=['is_active'])
        return Response({'detail': 'Talaba qayta faollashtirildi.'})

    @action(detail=True, methods=['get'])
    def stats(self, request, pk=None, **kwargs):
        """Markaz admini talabasining barcha urinishlari va statistikasini ko'radi."""
        from django.db.models import Avg, Max
        from apps.attempts.models import Attempt
        from apps.mock.models import MockParticipant

        student = self.get_object()

        # Practice / individual attempts
        attempts = (
            Attempt.objects
            .filter(user=student, status__in=['submitted', 'graded'])
            .select_related('test')
            .order_by('-submitted_at')
        )

        per_module = {}
        for module in ('listening', 'reading', 'writing'):
            qs = attempts.filter(test__module=module)
            agg = qs.aggregate(best=Max('band_score'), avg=Avg('band_score'))
            per_module[module] = {
                'count': qs.count(),
                'best': float(agg['best']) if agg['best'] else None,
                'avg': round(float(agg['avg']), 1) if agg['avg'] else None,
            }

        attempt_list = [
            {
                'id': str(a.id),
                'test_id': str(a.test_id),
                'test_name': a.test.name,
                'module': a.test.module,
                'band_score': float(a.band_score) if a.band_score else None,
                'raw_score': a.raw_score,
                'total_questions': a.total_questions,
                'submitted_at': a.submitted_at.isoformat() if a.submitted_at else None,
                'status': a.status,
            }
            for a in attempts[:50]
        ]

        # Mock participations
        mocks = (
            MockParticipant.objects
            .filter(user=student)
            .select_related('session')
            .order_by('-joined_at')[:20]
        )
        mock_list = [
            {
                'id': m.id,
                'session_id': m.session_id,
                'session_name': m.session.name,
                'date': m.session.date.isoformat() if m.session.date else None,
                'overall_band': (
                    float(m.overall_band_score) if m.overall_band_score else None
                ),
                'listening': float(m.listening_score) if m.listening_score else None,
                'reading': float(m.reading_score) if m.reading_score else None,
                'writing': float(m.writing_score) if m.writing_score else None,
            }
            for m in mocks
        ]

        return Response({
            'student': StudentReadSerializer(student).data,
            'per_module': per_module,
            'attempts': attempt_list,
            'mocks': mock_list,
        })


class CenterTeacherViewSet(_OrgScopedViewSetMixin, viewsets.ModelViewSet):
    """Markaz ustozlari CRUD."""

    permission_classes = [permissions.IsAuthenticated, IsCenterAdmin]
    lookup_field = 'pk'

    def get_queryset(self):
        org = self.get_organization()
        return User.objects.filter(
            org_memberships__organization=org,
            org_memberships__role='teacher',
        ).distinct().order_by('first_name', 'last_name')

    def get_serializer_class(self):
        if self.action == 'create':
            return TeacherCreateSerializer
        if self.action in ('update', 'partial_update'):
            return TeacherUpdateSerializer
        return TeacherReadSerializer

    def create(self, request, *args, **kwargs):
        org = self.get_organization()
        ser = TeacherCreateSerializer(
            data=request.data, context={'organization': org, 'request': request},
        )
        ser.is_valid(raise_exception=True)
        teacher = ser.save()

        return Response({
            'teacher': TeacherReadSerializer(teacher).data,
            'credentials': {
                'username': teacher.username,
                'password': teacher._generated_password,
                'login_url': f'/{org.slug}/login',
            },
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='reset-password')
    def reset_password(self, request, pk=None, **kwargs):
        teacher = self.get_object()
        new_pass = generate_password()
        teacher.set_password(new_pass)
        teacher.save(update_fields=['password'])
        return Response({
            'username': teacher.username,
            'new_password': new_pass,
        })

    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None, **kwargs):
        teacher = self.get_object()
        teacher.is_active = False
        teacher.save(update_fields=['is_active'])
        return Response({'detail': 'Ustoz o‘chirildi (deactivated).'})
