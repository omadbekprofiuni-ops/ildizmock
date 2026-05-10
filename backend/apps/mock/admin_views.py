"""Center admini uchun mock sessiyalar API."""

from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from apps.organizations.models import Organization, OrganizationMembership
from apps.organizations.permissions import IsCenterAdmin
from apps.tests.models import PDFTest, Test

from .certificate import render_certificate_pdf
from .models import (
    Certificate,
    MockParticipant,
    MockSession,
    MockStateLog,
    generate_access_code,
)
from .serializers import (
    MockSessionCreateSerializer,
    MockSessionDetailSerializer,
    MockSessionListSerializer,
    TestPickSerializer,
)

User = get_user_model()

# Bo'limlar tartibi. `start()` va `advance()` shu tartibda yurib,
# faqat sessiyada biriktirilgan testlari bor bo'limlarga o'tadi —
# masalan, faqat Writing testi tanlangan sessiya to'g'ridan-to'g'ri
# 'writing' statusidan boshlanadi va keyin 'finished' ga o'tadi.
SECTION_ORDER = ('listening', 'reading', 'writing', 'speaking')


def _next_configured_section(session, after=None):
    """Sessiyada testi bor keyingi bo'limni qaytaradi.

    `after=None` bo'lsa — birinchi biriktirilgan bo'limni qaytaradi
    (start() uchun). `after='listening'` bo'lsa — listening'dan keyingi
    biriktirilgan bo'limni qaytaradi (advance() uchun). Hech qaysi bo'lim
    biriktirilmagan bo'lsa, None qaytaradi.
    """
    start_idx = 0
    if after is not None:
        try:
            start_idx = SECTION_ORDER.index(after) + 1
        except ValueError:
            return None
    for sec in SECTION_ORDER[start_idx:]:
        if getattr(session, f'{sec}_test_id', None):
            return sec
        # Listening/Reading uchun PDFTest ham biriktirilgan bo'lishi mumkin
        if sec in ('listening', 'reading') and getattr(
            session, f'{sec}_pdf_test_id', None,
        ):
            return sec
    return None


class CenterMockSessionViewSet(viewsets.ModelViewSet):
    """`/api/v1/center/<slug>/mock/` — markaz admini boshqaradi."""

    permission_classes = [permissions.IsAuthenticated, IsCenterAdmin]

    def get_organization(self) -> Organization:
        slug = self.kwargs['org_slug']
        org = get_object_or_404(Organization, slug=slug)
        if org.status != 'active':
            raise PermissionDenied('This center is not active.')
        if self.request.user.role != 'superadmin':
            if not OrganizationMembership.objects.filter(
                user=self.request.user, organization=org,
                role__in=['admin', 'owner'],
            ).exists():
                raise PermissionDenied('You are not an admin of this center.')
        return org

    def get_queryset(self):
        org = self.get_organization()
        qs = MockSession.objects.filter(organization=org).order_by('-created_at')
        archived = self.request.query_params.get('archived', '').lower()
        # Detail / write actions need to find archived sessions too, otherwise
        # the user can't perform a permanent-delete from the archive tab.
        if self.action in ('list',):
            if archived in ('1', 'true', 'yes'):
                qs = qs.filter(is_archived=True)
            else:
                qs = qs.filter(is_archived=False)
        return qs

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
        import logging
        import traceback

        from django.db import OperationalError, ProgrammingError

        log = logging.getLogger(__name__)

        org = self.get_organization()
        ser = MockSessionCreateSerializer(
            data=request.data, context={'organization': org, 'request': request},
        )
        ser.is_valid(raise_exception=True)

        # Unique access_code yaratish (5 marta urinish)
        for _ in range(5):
            code = generate_access_code()
            if not MockSession.objects.filter(access_code=code).exists():
                break
        else:
            raise ValidationError("Couldn't create access code, please try again.")

        try:
            session = MockSession.objects.create(
                organization=org,
                created_by=request.user,
                access_code=code,
                **ser.validated_data,
            )
            data = MockSessionDetailSerializer(session).data
            return Response(data, status=status.HTTP_201_CREATED)
        except (OperationalError, ProgrammingError) as exc:
            # DB schema'da ustun yetishmaydi. Migrate va heal_schema'ni
            # ishga tushiramiz. heal_schema django_migrations 'applied' desa-da
            # real ustunlar yo'q bo'lsa ham yordam beradi.
            log.warning('mock create DB error, attempting migrate+heal: %s', exc)
            try:
                from django.core.management import call_command
                call_command('migrate', '--noinput', verbosity=0)
                call_command('heal_schema', '--apply', verbosity=0)
            except Exception as migrate_exc:  # noqa: BLE001
                log.error('migrate/heal failed: %s', migrate_exc)
                return Response(
                    {'detail': (
                        f'DB schema error: {exc}. '
                        f'Migrate/heal also failed: {migrate_exc}. '
                        'Show this message to the server admin.'
                    )},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )
            # Migrate o'tdi — qaytadan urinamiz
            try:
                session = MockSession.objects.create(
                    organization=org,
                    created_by=request.user,
                    access_code=code,
                    **ser.validated_data,
                )
                data = MockSessionDetailSerializer(session).data
                return Response(data, status=status.HTTP_201_CREATED)
            except Exception as retry_exc:  # noqa: BLE001
                log.error('mock create retry failed: %s\n%s',
                          retry_exc, traceback.format_exc())
                return Response(
                    {'detail': (
                        f'Migrate succeeded but retry still failed: '
                        f'{type(retry_exc).__name__}: {retry_exc}'
                    )},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )
        except Exception as exc:  # noqa: BLE001
            log.error('mock create unexpected error: %s\n%s',
                      exc, traceback.format_exc())
            return Response(
                {'detail': f'{type(exc).__name__}: {exc}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=False, methods=['get'], url_path='available-tests')
    def available_tests(self, request, org_slug=None):
        """Session yaratish uchun: markazning + published global testlar.

        Reguliar `Test` va `PDFTest`'larni bitta listga birlashtiradi —
        PDF testning ID'si `pdf:<public_id>` shaklida prefiksli string
        bo'lib qaytariladi, va `kind` maydoni 'regular' yoki 'pdf'
        qiymatini oladi. Frontend dropdown shu prefix bilan id'ni qaytarib
        yuboradi, backend create-session vaqtida tegishli FK'ga yozadi.
        """
        from django.db.models import Q

        org = self.get_organization()
        regular = Test.objects.filter(
            Q(organization=org) | Q(is_global=True, organization__isnull=True),
            status='published',
        ).order_by('name')
        # PDF testlar global emas — faqat shu markazga tegishli, published.
        pdfs = PDFTest.objects.filter(
            organization=org, status='published',
        ).order_by('name')

        def _regular(t):
            return {
                'id': str(t.id),
                'name': t.name,
                'module': t.module,
                'difficulty': t.difficulty,
                'category': getattr(t, 'category', '') or '',
                'kind': 'regular',
            }

        def _pdf(t):
            return {
                'id': f'pdf:{t.public_id}',
                'name': t.name,
                'module': t.module,
                'difficulty': t.difficulty,
                'category': '',
                'kind': 'pdf',
            }

        result = {'listening': [], 'reading': [], 'writing': [], 'speaking': []}
        for t in regular:
            if t.module in result:
                result[t.module].append(_regular(t))
        for t in pdfs:
            if t.module in result:
                result[t.module].append(_pdf(t))
        return Response(result)

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None, org_slug=None):
        """Sessiyani boshlash — qaysi bo'limning testi biriktirilgan bo'lsa,
        o'sha bo'limdan boshlaydi. Masalan, faqat Writing test biriktirilgan
        sessiya to'g'ridan-to'g'ri 'writing' statusidan boshlanadi.
        """
        session = self.get_object()
        if session.status != 'waiting':
            return Response(
                {'detail': 'Session has already started or finished.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        first = _next_configured_section(session)
        if first is None:
            return Response(
                {'detail': 'No test attached. '
                           'Edit the session and pick at least one test.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        now = timezone.now()
        session.status = first
        session.started_at = now
        session.section_started_at = now
        session.save(update_fields=['status', 'started_at', 'section_started_at'])

        MockStateLog.objects.create(
            session=session, action=f'start_{first}', triggered_by=request.user,
        )
        return Response(MockSessionDetailSerializer(session).data)

    @action(detail=True, methods=['post'])
    def advance(self, request, pk=None, org_slug=None):
        """Keyingi biriktirilgan bo'limga o'tish. Boshqa biriktirilgan bo'lim
        qolmagan bo'lsa — sessiyani 'finished' qilib yakunlaydi.
        """
        session = self.get_object()
        if session.status not in SECTION_ORDER:
            return Response(
                {'detail': 'Cannot continue this session.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        nxt = _next_configured_section(session, after=session.status)
        if nxt is None:
            nxt = 'finished'

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

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None, org_slug=None):
        """Sessiyani bekor qilish — natijalar saqlanmaydi.

        ETAP 12: tugatishdan farqli, revoked sessiya statistikaga
        kiritilmaydi.
        """
        session = self.get_object()
        if session.status == 'finished':
            return Response(
                {'detail': 'Cannot cancel a finished session.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if session.status == 'cancelled':
            return Response(MockSessionDetailSerializer(session).data)
        session.status = 'cancelled'
        session.finished_at = timezone.now()
        session.save(update_fields=['status', 'finished_at'])
        MockStateLog.objects.create(
            session=session, action='cancelled', triggered_by=request.user,
        )
        return Response(MockSessionDetailSerializer(session).data)

    def destroy(self, request, *args, **kwargs):
        """Two-step delete:
        1. First DELETE on a non-archived session → mark archived (soft delete).
        2. DELETE on an already archived session → permanent cascade delete.
        Active sessions must be cancelled first.
        """
        session = self.get_object()
        if session.status not in ('finished', 'cancelled', 'waiting'):
            return Response(
                {'detail': "Cancel the active session first, then you can delete it."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not session.is_archived:
            session.is_archived = True
            session.archived_at = timezone.now()
            session.save(update_fields=['is_archived', 'archived_at'])
            return Response(
                {'detail': 'archived', 'archived': True, 'id': session.id},
                status=status.HTTP_200_OK,
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    def restore(self, request, pk=None, org_slug=None):
        """Bring an archived session back to the active list."""
        session = self.get_object()
        if not session.is_archived:
            return Response(
                {'detail': 'Session is not archived.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        session.is_archived = False
        session.archived_at = None
        session.save(update_fields=['is_archived', 'archived_at'])
        return Response(MockSessionDetailSerializer(session).data)

    @action(detail=True, methods=['post'])
    def reopen(self, request, pk=None, org_slug=None):
        """Tugagan / revoked sessiyani 24 soat ichida qayta ochish."""
        from datetime import timedelta

        session = self.get_object()
        if session.status not in ('finished', 'cancelled'):
            return Response(
                {'detail': 'Only finished or cancelled sessions can be reopened.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if session.finished_at and (timezone.now() - session.finished_at) > timedelta(hours=24):
            return Response(
                {'detail': 'This session can no longer be reopened (more than 24 hours have passed).'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Sessiyani avvalgi bosqichga qaytaramiz: agar listening boshlanmagan bo'lsa
        # 'waiting'ga, aks holda oxirgi faol bosqichga 'writing'ga qaytaramiz.
        prev_status = 'writing' if session.started_at else 'waiting'
        session.status = prev_status
        session.finished_at = None
        session.save(update_fields=['status', 'finished_at'])
        MockStateLog.objects.create(
            session=session, action='reopen', triggered_by=request.user,
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
        """Center admini Writing baholini qo'lda qo'yadi (0.0–9.0)."""
        session = self.get_object()
        try:
            score = float(request.data.get('score'))
        except (TypeError, ValueError):
            return Response({'detail': 'Score must be a number.'},
                            status=status.HTTP_400_BAD_REQUEST)
        if not (0 <= score <= 9):
            return Response({'detail': 'Score must be between 0 and 9.'},
                            status=status.HTTP_400_BAD_REQUEST)
        participant = get_object_or_404(
            MockParticipant, id=participant_id, session=session,
        )
        participant.writing_score = round(score, 1)
        participant.writing_status = 'graded'
        participant.writing_graded_by = request.user
        participant.writing_graded_at = timezone.now()
        participant.calculate_overall_band_score()
        participant.save()
        return Response({
            'writing_score': str(participant.writing_score),
            'overall_band_score': (
                str(participant.overall_band_score)
                if participant.overall_band_score is not None else None
            ),
        })

    @action(
        detail=True, methods=['post'],
        url_path=r'participants/(?P<participant_id>\d+)/score-speaking',
    )
    def score_speaking(self, request, pk=None, org_slug=None, participant_id=None):
        session = self.get_object()
        try:
            score = float(request.data.get('score'))
        except (TypeError, ValueError):
            return Response({'detail': 'Score must be a number.'},
                            status=status.HTTP_400_BAD_REQUEST)
        if not (0 <= score <= 9):
            return Response({'detail': 'Score must be between 0 and 9.'},
                            status=status.HTTP_400_BAD_REQUEST)
        participant = get_object_or_404(
            MockParticipant, id=participant_id, session=session,
        )
        participant.speaking_score = round(score, 1)
        participant.speaking_status = 'graded'
        participant.speaking_graded_by = request.user
        participant.speaking_graded_at = timezone.now()
        participant.calculate_overall_band_score()
        participant.save()
        return Response({
            'speaking_score': str(participant.speaking_score),
            'overall_band_score': (
                str(participant.overall_band_score)
                if participant.overall_band_score is not None else None
            ),
        })

    # ===== ETAP 19 — Pre-registered participants =====

    @action(detail=True, methods=['get'], url_path='eligible-students')
    def eligible_students(self, request, pk=None, org_slug=None):
        """Markazdagi talabalar ro'yxati (pre-registration uchun).

        Sessiyaga allaqachon qo'shilganlar `is_added=True` bilan shown.
        """
        session = self.get_object()
        org = self.get_organization()

        students = User.objects.filter(
            org_memberships__organization=org,
            org_memberships__role='student',
            is_active=True,
        ).distinct().order_by('first_name', 'last_name', 'username')

        registered_ids = set(
            session.participants.filter(user__isnull=False)
            .values_list('user_id', flat=True)
        )

        rows = []
        for s in students:
            full = f'{s.first_name or ""} {s.last_name or ""}'.strip() or s.username
            rows.append({
                'id': s.id,
                'full_name': full,
                'username': s.username,
                'phone': s.phone or '',
                'is_added': s.id in registered_ids,
            })
        return Response(rows)

    @action(detail=True, methods=['post'], url_path='add-participants')
    def add_participants(self, request, pk=None, org_slug=None):
        """Talabalarni sessiyaga oldindan qo'shish (pre-registration).

        Body: `{user_ids: [1, 2, 3]}` — markazga tegishli student userlari.
        """
        session = self.get_object()
        org = self.get_organization()

        if session.status not in ('waiting',):
            return Response(
                {'detail': 'Students can only be added to sessions that have not started.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user_ids = request.data.get('user_ids') or []
        if not isinstance(user_ids, list) or not user_ids:
            return Response(
                {'detail': 'user_ids list is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        valid_users = User.objects.filter(
            id__in=user_ids,
            org_memberships__organization=org,
            org_memberships__role='student',
        ).distinct()

        existing_user_ids = set(
            session.participants.filter(user__isnull=False)
            .values_list('user_id', flat=True)
        )

        added = []
        skipped = []
        for u in valid_users:
            if u.id in existing_user_ids:
                skipped.append(u.id)
                continue
            full = f'{u.first_name or ""} {u.last_name or ""}'.strip() or u.username
            # full_name unique_together(session, full_name) ga qarshi tekshiruv
            if session.participants.filter(full_name=full).exists():
                # Bir xil ismli boshqa guest bor — username bilan farqlash
                full = f'{full} ({u.username})'
            try:
                participant = MockParticipant.objects.create(
                    session=session,
                    user=u,
                    full_name=full,
                    has_joined=False,
                )
                added.append({
                    'id': participant.id,
                    'user_id': u.id,
                    'full_name': full,
                })
            except Exception:
                skipped.append(u.id)

        return Response({
            'added': added,
            'skipped_user_ids': skipped,
            'total': session.participants.count(),
        }, status=status.HTTP_201_CREATED)

    @action(
        detail=True, methods=['delete'],
        url_path=r'participants/(?P<participant_id>\d+)/remove',
    )
    def remove_participant(self, request, pk=None, org_slug=None, participant_id=None):
        """Pre-registered participantni ro'yxatdan olib tashlash.

        Faqat hali kirmagan (has_joined=False) participantlar uchun ruxsat.
        """
        session = self.get_object()
        participant = get_object_or_404(
            MockParticipant, id=participant_id, session=session,
        )
        if participant.has_joined:
            return Response(
                {'detail': 'The student has already joined the session and cannot be removed.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        participant.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ===== ETAP 20 — Certificate berish / bekor qilish =====

    @action(
        detail=True, methods=['post'],
        url_path=r'participants/(?P<participant_id>\d+)/issue-certificate',
    )
    def issue_certificate(self, request, pk=None, org_slug=None, participant_id=None):
        """Teacher participantga rasmiy sertifikat beradi (PDF + DB record).

        Student barcha 4 modulni topshirgan va overall_band_score hisoblangan
        bo'lishi shart.
        """
        from django.core.files.base import ContentFile

        session = self.get_object()
        org = self.get_organization()
        participant = get_object_or_404(
            MockParticipant, id=participant_id, session=session,
        )

        if hasattr(participant, 'certificate') and not participant.certificate.is_revoked:
            return Response(
                {'detail': 'This student has already been issued a certificate.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Barcha 4 modul ham bo'lishi kerak
        missing = []
        if participant.listening_score is None:
            missing.append('Listening')
        if participant.reading_score is None:
            missing.append('Reading')
        if participant.writing_score is None:
            missing.append('Writing')
        if participant.speaking_score is None:
            missing.append('Speaking')
        if missing:
            return Response(
                {'detail': f'The following modules have not been graded yet: {", ".join(missing)}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if participant.overall_band_score is None:
            participant.calculate_overall_band_score()
            participant.save(update_fields=['overall_band_score'])

        # Eski revoked sertifikat bo'lsa, uni qayta ishlatamiz (overwrite)
        certificate = getattr(participant, 'certificate', None)
        if certificate and certificate.is_revoked:
            certificate.delete()
            certificate = None

        cert_number = Certificate.generate_certificate_number(org, session.date)
        certificate = Certificate.objects.create(
            participant=participant,
            certificate_number=cert_number,
            listening_score=participant.listening_score,
            reading_score=participant.reading_score,
            writing_score=participant.writing_score,
            speaking_score=participant.speaking_score,
            overall_band_score=participant.overall_band_score,
            full_name=participant.get_display_name(),
            test_date=session.date,
            organization_name=org.name,
            issued_by=request.user,
        )

        # PDF yaratib FileField ga saqlaymiz
        pdf_buffer = render_certificate_pdf(certificate)
        filename = f'certificate_{certificate.certificate_number}.pdf'
        certificate.pdf_file.save(filename, ContentFile(pdf_buffer.read()), save=True)

        return Response({
            'id': certificate.id,
            'certificate_number': certificate.certificate_number,
            'verification_code': certificate.verification_code,
            'pdf_url': (
                request.build_absolute_uri(certificate.pdf_file.url)
                if certificate.pdf_file else None
            ),
            'issue_date': certificate.issue_date.isoformat(),
        }, status=status.HTTP_201_CREATED)

    @action(
        detail=True, methods=['post'],
        url_path=r'participants/(?P<participant_id>\d+)/revoke-certificate',
    )
    def revoke_certificate(self, request, pk=None, org_slug=None, participant_id=None):
        """Berilgan sertifikatni bekor qilish (audit qoldirilib)."""
        session = self.get_object()
        participant = get_object_or_404(
            MockParticipant, id=participant_id, session=session,
        )
        certificate = getattr(participant, 'certificate', None)
        if certificate is None:
            return Response(
                {'detail': 'This student does not have a certificate.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        if certificate.is_revoked:
            return Response(
                {'detail': 'Certificate allaqachon revoked.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        certificate.is_revoked = True
        certificate.revoked_at = timezone.now()
        certificate.revoked_reason = (request.data.get('reason') or '').strip()
        certificate.revoked_by = request.user
        certificate.save(update_fields=[
            'is_revoked', 'revoked_at', 'revoked_reason', 'revoked_by',
        ])
        return Response({
            'id': certificate.id,
            'is_revoked': True,
        })
