"""Markaz testlari API — Mening testlarim + Global katalog + Klon."""

from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from apps.organizations.models import Organization, OrganizationMembership
from apps.organizations.permissions import IsCenterAdmin
from apps.tests.models import (
    ListeningPart,
    Passage,
    Question,
    Test,
    TestClone,
    WritingTask,
)
from apps.tests.super_serializers import (
    SuperTestDetailSerializer,
    SuperTestListSerializer,
)


class CenterTestViewSet(viewsets.ModelViewSet):
    """Markaz testlari (Mening testlarim + Global katalog + Klon)."""

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
        return Test.objects.filter(organization=org).order_by('-created_at')

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return SuperTestDetailSerializer
        return SuperTestListSerializer

    @action(detail=False, methods=['get'], url_path='global-catalog')
    def global_catalog(self, request, org_slug=None):
        """SuperAdmin yaratgan published global testlar (filtrlash bilan)."""
        qs = Test.objects.filter(is_global=True, status='published')

        module = request.query_params.get('module')
        if module:
            qs = qs.filter(module=module)
        difficulty = request.query_params.get('difficulty')
        if difficulty:
            qs = qs.filter(difficulty=difficulty)
        category = request.query_params.get('category')
        if category:
            qs = qs.filter(category__icontains=category)

        # Annotate cloned info
        org = self.get_organization()
        cloned_ids = set(
            Test.objects.filter(organization=org, cloned_from__isnull=False)
            .values_list('cloned_from_id', flat=True)
        )

        data = SuperTestListSerializer(qs, many=True).data
        for item in data:
            item['already_cloned'] = item['id'] in {str(x) for x in cloned_ids} or item['id'] in cloned_ids
        return Response(data)

    @action(detail=True, methods=['get'])
    def preview(self, request, pk=None, org_slug=None):
        """Admin uchun to'liq preview — correct_answer'lar bilan."""
        test = self.get_object()
        ser = SuperTestDetailSerializer(test, context={'request': request})
        return Response(ser.data)

    @action(detail=True, methods=['post'])
    def clone(self, request, pk=None, org_slug=None):
        """Markazning o'z testidan nusxa olish."""
        org = self.get_organization()
        source = self.get_object()
        new_name = (request.data.get('name') or '').strip() or f'Copy of {source.name}'

        with transaction.atomic():
            clone = Test.objects.create(
                name=new_name,
                module=source.module,
                difficulty=source.difficulty,
                test_type=source.test_type,
                description=source.description,
                category=source.category,
                duration_minutes=source.duration_minutes,
                organization=org,
                is_global=False,
                cloned_from=source.cloned_from,
                created_by=request.user,
                status='draft',
                is_published=False,
            )

            for src_part in source.listening_parts.all():
                new_part = ListeningPart.objects.create(
                    test=clone,
                    part_number=src_part.part_number,
                    audio_file=src_part.audio_file,
                    audio_duration_seconds=src_part.audio_duration_seconds,
                    audio_bitrate_kbps=src_part.audio_bitrate_kbps,
                    audio_size_bytes=src_part.audio_size_bytes,
                    image=src_part.image,
                    transcript=src_part.transcript,
                    instructions=src_part.instructions,
                )
                for src_q in src_part.questions.all():
                    Question.objects.create(
                        listening_part=new_part,
                        order=src_q.order,
                        question_number=src_q.question_number,
                        question_type=src_q.question_type,
                        text=src_q.text,
                        prompt=src_q.prompt,
                        options=src_q.options,
                        correct_answer=src_q.correct_answer,
                        acceptable_answers=src_q.acceptable_answers,
                        alt_answers=src_q.alt_answers,
                        group_id=src_q.group_id,
                        instruction=src_q.instruction,
                        points=src_q.points,
                        image=src_q.image,
                    )

            for src_p in source.passages.all():
                new_p = Passage.objects.create(
                    test=clone,
                    part_number=src_p.part_number,
                    title=src_p.title,
                    subtitle=src_p.subtitle,
                    content=src_p.content,
                    instructions=src_p.instructions,
                    audio_file=src_p.audio_file,
                    audio_duration_seconds=src_p.audio_duration_seconds,
                    image=src_p.image,
                    min_words=src_p.min_words,
                    order=src_p.order,
                )
                for src_q in src_p.questions.all():
                    Question.objects.create(
                        passage=new_p,
                        order=src_q.order,
                        question_number=src_q.question_number,
                        question_type=src_q.question_type,
                        text=src_q.text,
                        prompt=src_q.prompt,
                        options=src_q.options,
                        correct_answer=src_q.correct_answer,
                        acceptable_answers=src_q.acceptable_answers,
                        alt_answers=src_q.alt_answers,
                        group_id=src_q.group_id,
                        instruction=src_q.instruction,
                        points=src_q.points,
                        image=src_q.image,
                    )

            for src_t in source.writing_tasks.all():
                WritingTask.objects.create(
                    test=clone,
                    task_number=src_t.task_number,
                    prompt=src_t.prompt,
                    chart_image=src_t.chart_image,
                    min_words=src_t.min_words,
                    suggested_minutes=src_t.suggested_minutes,
                    requirements=src_t.requirements,
                )

        return Response(
            SuperTestDetailSerializer(clone, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=False, methods=['post'],
        url_path=r'clone-from-global/(?P<global_id>[^/.]+)',
    )
    def clone_from_global(self, request, org_slug=None, global_id=None):
        org = self.get_organization()
        source = get_object_or_404(
            Test, id=global_id, is_global=True, status='published',
        )

        with transaction.atomic():
            existing = Test.objects.filter(
                organization=org, cloned_from=source,
            ).first()
            if existing:
                return Response(
                    {
                        'detail': 'Bu test allaqachon nusxalangan',
                        'test_id': str(existing.id),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            clone = Test.objects.create(
                name=source.name,
                module=source.module,
                difficulty=source.difficulty,
                test_type=source.test_type,
                description=source.description,
                category=source.category,
                duration_minutes=source.duration_minutes,
                organization=org,
                is_global=False,
                cloned_from=source,
                created_by=request.user,
                status='published',
                is_published=True,
                published_at=source.published_at,
            )

            # ListeningPart + savollar
            for src_part in source.listening_parts.all():
                new_part = ListeningPart.objects.create(
                    test=clone,
                    part_number=src_part.part_number,
                    audio_file=src_part.audio_file,
                    audio_duration_seconds=src_part.audio_duration_seconds,
                    audio_bitrate_kbps=src_part.audio_bitrate_kbps,
                    audio_size_bytes=src_part.audio_size_bytes,
                    transcript=src_part.transcript,
                    instructions=src_part.instructions,
                )
                for src_q in src_part.questions.all():
                    Question.objects.create(
                        listening_part=new_part,
                        order=src_q.order,
                        question_number=src_q.question_number,
                        question_type=src_q.question_type,
                        text=src_q.text,
                        prompt=src_q.prompt,
                        options=src_q.options,
                        correct_answer=src_q.correct_answer,
                        acceptable_answers=src_q.acceptable_answers,
                        alt_answers=src_q.alt_answers,
                        group_id=src_q.group_id,
                        instruction=src_q.instruction,
                        points=src_q.points,
                    )

            # Passages + savollar
            for src_p in source.passages.all():
                new_p = Passage.objects.create(
                    test=clone,
                    part_number=src_p.part_number,
                    title=src_p.title,
                    subtitle=src_p.subtitle,
                    content=src_p.content,
                    instructions=src_p.instructions,
                    audio_file=src_p.audio_file,
                    audio_duration_seconds=src_p.audio_duration_seconds,
                    min_words=src_p.min_words,
                    order=src_p.order,
                )
                for src_q in src_p.questions.all():
                    Question.objects.create(
                        passage=new_p,
                        order=src_q.order,
                        question_number=src_q.question_number,
                        question_type=src_q.question_type,
                        text=src_q.text,
                        prompt=src_q.prompt,
                        options=src_q.options,
                        correct_answer=src_q.correct_answer,
                        acceptable_answers=src_q.acceptable_answers,
                        alt_answers=src_q.alt_answers,
                        group_id=src_q.group_id,
                        instruction=src_q.instruction,
                        points=src_q.points,
                    )

            # Writing tasks
            for src_t in source.writing_tasks.all():
                WritingTask.objects.create(
                    test=clone,
                    task_number=src_t.task_number,
                    prompt=src_t.prompt,
                    chart_image=src_t.chart_image,
                    min_words=src_t.min_words,
                    suggested_minutes=src_t.suggested_minutes,
                    requirements=src_t.requirements,
                )

            TestClone.objects.create(
                organization=org,
                source_test=source,
                cloned_test=clone,
                cloned_by=request.user,
            )

        return Response(
            SuperTestDetailSerializer(clone).data,
            status=status.HTTP_201_CREATED,
        )
