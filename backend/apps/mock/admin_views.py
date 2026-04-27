"""Markaz admini uchun mock sessiyalar API."""

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from apps.organizations.models import Organization, OrganizationMembership
from apps.organizations.permissions import IsCenterAdmin
from apps.tests.models import Test

from .models import MockParticipant, MockSession, MockStateLog, generate_access_code
from .serializers import (
    MockSessionCreateSerializer,
    MockSessionDetailSerializer,
    MockSessionListSerializer,
    TestPickSerializer,
)

# Listening → Reading → Writing → Finished
NEXT_STATUS = {
    'listening': 'reading',
    'reading': 'writing',
    'writing': 'finished',
}


class CenterMockSessionViewSet(viewsets.ModelViewSet):
    """`/api/v1/center/<slug>/mock/` — markaz admini boshqaradi."""

    permission_classes = [permissions.IsAuthenticated, IsCenterAdmin]

    def get_organization(self) -> Organization:
        slug = self.kwargs['org_slug']
        org = get_object_or_404(Organization, slug=slug)
        if org.status != 'active':
            raise PermissionDenied('Markaz faol holatda emas.')
        if self.request.user.role != 'superadmin':
            if not OrganizationMembership.objects.filter(
                user=self.request.user, organization=org,
                role__in=['admin', 'owner'],
            ).exists():
                raise PermissionDenied('Siz bu markaz admini emassiz.')
        return org

    def get_queryset(self):
        org = self.get_organization()
        return MockSession.objects.filter(organization=org).order_by('-created_at')

    def get_serializer_class(self):
        if self.action == 'create':
            return MockSessionCreateSerializer
        if self.action in ('retrieve',):
            return MockSessionDetailSerializer
        return MockSessionListSerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        try:
            ctx['organization'] = self.get_organization()
        except Exception:
            pass
        return ctx

    def create(self, request, *args, **kwargs):
        org = self.get_organization()
        ser = MockSessionCreateSerializer(
            data=request.data, context={'organization': org, 'request': request},
        )
        ser.is_valid(raise_exception=True)

        # Unique access_code yaratish (3 marta urinish)
        for _ in range(5):
            code = generate_access_code()
            if not MockSession.objects.filter(access_code=code).exists():
                break
        else:
            raise ValidationError('Access code yaratib bo‘lmadi, qayta urinib ko‘ring.')

        session = MockSession.objects.create(
            organization=org,
            created_by=request.user,
            access_code=code,
            **ser.validated_data,
        )
        return Response(
            MockSessionDetailSerializer(session).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=['get'], url_path='available-tests')
    def available_tests(self, request, org_slug=None):
        """Sessiya yaratish uchun: markazning published testlari (modul bo'yicha)."""
        org = self.get_organization()
        qs = Test.objects.filter(organization=org, status='published').order_by('name')
        return Response({
            'listening': TestPickSerializer(qs.filter(module='listening'), many=True).data,
            'reading': TestPickSerializer(qs.filter(module='reading'), many=True).data,
            'writing': TestPickSerializer(qs.filter(module='writing'), many=True).data,
        })

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None, org_slug=None):
        """Birinchi bo'lim (Listening) ni boshlash."""
        session = self.get_object()
        if session.status != 'waiting':
            return Response(
                {'detail': 'Sessiya allaqachon boshlangan yoki tugagan.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not session.listening_test_id:
            return Response(
                {'detail': 'Listening test tanlanmagan.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        now = timezone.now()
        session.status = 'listening'
        session.started_at = now
        session.section_started_at = now
        session.save(update_fields=['status', 'started_at', 'section_started_at'])

        MockStateLog.objects.create(
            session=session, action='start_listening', triggered_by=request.user,
        )
        return Response(MockSessionDetailSerializer(session).data)

    @action(detail=True, methods=['post'])
    def advance(self, request, pk=None, org_slug=None):
        """Keyingi bo'limga o'tish (Listening → Reading → Writing → Finished)."""
        session = self.get_object()
        if session.status not in NEXT_STATUS:
            return Response(
                {'detail': 'Sessiyani davom ettirib bo‘lmaydi.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        nxt = NEXT_STATUS[session.status]
        now = timezone.now()
        session.status = nxt
        session.section_started_at = now
        if nxt == 'finished':
            session.finished_at = now
        session.save(update_fields=['status', 'section_started_at', 'finished_at'])

        MockStateLog.objects.create(
            session=session, action=f'advance_to_{nxt}', triggered_by=request.user,
        )
        return Response(MockSessionDetailSerializer(session).data)

    @action(detail=True, methods=['post'])
    def finish(self, request, pk=None, org_slug=None):
        """Sessiyani tezkor yakunlash."""
        session = self.get_object()
        if session.status == 'finished':
            return Response(MockSessionDetailSerializer(session).data)
        session.status = 'finished'
        session.finished_at = timezone.now()
        session.save(update_fields=['status', 'finished_at'])
        MockStateLog.objects.create(
            session=session, action='force_finish', triggered_by=request.user,
        )
        return Response(MockSessionDetailSerializer(session).data)

    @action(detail=True, methods=['get'])
    def results(self, request, pk=None, org_slug=None):
        session = self.get_object()
        return Response(MockSessionDetailSerializer(session).data)

    @action(
        detail=True, methods=['post'],
        url_path=r'participants/(?P<participant_id>\d+)/score-writing',
    )
    def score_writing(self, request, pk=None, org_slug=None, participant_id=None):
        """Markaz admini Writing baholini qo'lda qo'yadi (0.0–9.0)."""
        session = self.get_object()
        try:
            score = float(request.data.get('score'))
        except (TypeError, ValueError):
            return Response({'detail': 'Score raqam bo‘lishi kerak.'},
                            status=status.HTTP_400_BAD_REQUEST)
        if not (0 <= score <= 9):
            return Response({'detail': 'Score 0–9 oralig‘ida bo‘lishi kerak.'},
                            status=status.HTTP_400_BAD_REQUEST)
        participant = get_object_or_404(
            MockParticipant, id=participant_id, session=session,
        )
        participant.writing_score = round(score, 1)
        participant.save(update_fields=['writing_score'])
        return Response({'writing_score': str(participant.writing_score)})

    @action(
        detail=True, methods=['post'],
        url_path=r'participants/(?P<participant_id>\d+)/score-speaking',
    )
    def score_speaking(self, request, pk=None, org_slug=None, participant_id=None):
        session = self.get_object()
        try:
            score = float(request.data.get('score'))
        except (TypeError, ValueError):
            return Response({'detail': 'Score raqam bo‘lishi kerak.'},
                            status=status.HTTP_400_BAD_REQUEST)
        if not (0 <= score <= 9):
            return Response({'detail': 'Score 0–9 oralig‘ida bo‘lishi kerak.'},
                            status=status.HTTP_400_BAD_REQUEST)
        participant = get_object_or_404(
            MockParticipant, id=participant_id, session=session,
        )
        participant.speaking_score = round(score, 1)
        participant.save(update_fields=['speaking_score'])
        return Response({'speaking_score': str(participant.speaking_score)})
