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


def _normalize_path(value: str) -> str:
    """`http://host/media/audio/abc.mp3` ham, `/media/audio/abc.mp3` ham,
    `audio/abc.mp3` ham qabul qilinadi va storage path'ga keltiriladi."""
    if not value:
        return value
    s = str(value).strip()
    if '://' in s:
        s = s.split('://', 1)[1]
        s = s.split('/', 1)[1] if '/' in s else ''
        s = '/' + s
    if s.startswith('/media/'):
        s = s[len('/media/'):]
    elif s.startswith('media/'):
        s = s[len('media/'):]
    return s.lstrip('/')


def _validate_test_structure(test: Test) -> None:
    """ETAP 18 — Published testlar uchun struktura validatsiyasi.

    Reading: 3 passage, jami 40 savol
    Listening: 4 part, jami 40 savol
    Writing: 2 task

    Draft testlarda enforcement yo'q — teacher to'liq tugatmaguncha
    saqlay oladi. Faqat publishga o'tganda strict tekshiramiz.
    Xatolik bo'lsa rest_framework ValidationError ko'tariladi va
    chaqiruvchi `easy_create` transaction'i rollback qiladi.
    """
    from rest_framework.exceptions import ValidationError

    if not test.is_published:
        return

    module = test.module
    if module == 'reading':
        passages = list(test.passages.all())
        if len(passages) != 3:
            raise ValidationError({
                'passages': (
                    f'Reading test uchun aynan 3 ta passage kerak. '
                    f'Hozir: {len(passages)}'
                ),
            })
        total_qs = sum(p.questions.count() for p in passages)
        if total_qs != 40:
            raise ValidationError({
                'questions': (
                    f'Reading test uchun jami 40 ta savol kerak. '
                    f'Hozir: {total_qs}'
                ),
            })
    elif module == 'listening':
        parts = list(test.listening_parts.all())
        if len(parts) != 4:
            raise ValidationError({
                'listening_parts': (
                    f'Listening test uchun aynan 4 ta part kerak. '
                    f'Hozir: {len(parts)}'
                ),
            })
        total_qs = sum(p.questions.count() for p in parts)
        if total_qs != 40:
            raise ValidationError({
                'questions': (
                    f'Listening test uchun jami 40 ta savol kerak. '
                    f'Hozir: {total_qs}'
                ),
            })
        # Har bir partda audio bo'lishi shart
        for p in parts:
            if not p.audio_file:
                raise ValidationError({
                    'audio': f'Part {p.part_number} uchun audio fayl yuklang.',
                })
    elif module == 'writing':
        tasks = list(test.writing_tasks.all())
        if len(tasks) != 2:
            raise ValidationError({
                'writing_tasks': (
                    f'Writing test uchun aynan 2 ta task kerak. '
                    f'Hozir: {len(tasks)}'
                ),
            })


def _create_question(*, passage=None, listening_part=None, q):
    """Easy-create endpointi uchun savol yaratish helperi."""
    return Question.objects.create(
        passage=passage,
        listening_part=listening_part,
        order=int(q.get('order') or 1),
        question_number=int(q.get('question_number') or q.get('order') or 0),
        question_type=q.get('question_type') or 'mcq',
        text=q.get('text', '') or '',
        prompt=q.get('prompt') or q.get('text', '') or '',
        options=q.get('options') or [],
        correct_answer=q.get('correct_answer'),
        acceptable_answers=q.get('acceptable_answers') or [],
        alt_answers=q.get('alt_answers') or [],
        group_id=int(q.get('group_id') or 0),
        instruction=q.get('instruction', '') or '',
        points=int(q.get('points') or 1),
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
        qs = Test.objects.filter(organization=org).order_by('-created_at')
        # Default: o'chirilganlarni yashiramiz. ?archived=1 bo'lsa faqat
        # arxivni qaytaramiz (ETAP 13 soft-delete).
        archived = self.request.query_params.get('archived')
        if archived in ('1', 'true', 'yes'):
            qs = qs.filter(is_deleted=True)
        else:
            qs = qs.filter(is_deleted=False)
        return qs

    def destroy(self, request, *args, **kwargs):
        """Soft-delete: testni arxivga o'tkazadi (qayta tiklash mumkin)."""
        from django.utils import timezone

        test = self.get_object()
        test.is_deleted = True
        test.deleted_at = timezone.now()
        test.deleted_by = request.user
        test.save(update_fields=['is_deleted', 'deleted_at', 'deleted_by'])
        return Response(
            {'detail': "Test arxivga o'tkazildi."},
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=['patch'], url_path='toggle-practice')
    def toggle_practice(self, request, pk=None, org_slug=None):
        """ETAP 14 BUG #9 — Markaz testi practice mode toggle."""
        test = self.get_object()
        test.is_practice_enabled = not test.is_practice_enabled
        if 'practice_time_limit' in request.data:
            val = request.data.get('practice_time_limit')
            test.practice_time_limit = int(val) if val else None
        test.save(update_fields=[
            'is_practice_enabled', 'practice_time_limit', 'updated_at',
        ])
        return Response({
            'is_practice_enabled': test.is_practice_enabled,
            'practice_time_limit': test.practice_time_limit,
        })

    @action(detail=True, methods=['post'])
    def restore(self, request, pk=None, org_slug=None):
        """Arxivdan qaytarish (ETAP 13)."""
        test = self.get_object()
        if not test.is_deleted:
            return Response(
                {'detail': 'Bu test arxivda emas.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        test.is_deleted = False
        test.deleted_at = None
        test.deleted_by = None
        test.save(update_fields=['is_deleted', 'deleted_at', 'deleted_by'])
        return Response({'detail': 'Test qaytarildi.'})

    @action(detail=True, methods=['delete'], url_path='hard-delete')
    def hard_delete(self, request, pk=None, org_slug=None):
        """Doimiy o'chirish — faqat arxivdagi testlar uchun.

        Bu xavfli amal — barcha bog'liq passages/questions/attempts ham
        cascade qilib o'chiriladi.
        """
        test = self.get_object()
        if not test.is_deleted:
            return Response(
                {'detail': "Avval testni arxivga o'tkazing, keyin doimiy o'chirib bo'ladi."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        test.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

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

    @action(detail=False, methods=['post'], url_path='easy-create')
    def easy_create(self, request, org_slug=None):
        """ETAP 10 — Google Forms uslubidagi oson test yaratish.

        Bir POST'da to'liq test (passages/listening_parts/writing_tasks +
        questions) yaratiladi. Frontend'ga JSON quyidagi ko'rinishda:

        {
          "name": "My Reading Test",
          "module": "reading",  # listening | reading | writing
          "test_type": "academic",
          "difficulty": "intermediate",
          "duration_minutes": 60,
          "description": "...",
          "is_published": true,
          "passages": [
            {
              "part_number": 1, "title": "...", "content": "...",
              "instructions": "...",
              "questions": [
                {"order": 1, "question_type": "mcq", "text": "...",
                 "options": ["A","B","C","D"], "correct_answer": "B",
                 "instruction": "...", "points": 1}
              ]
            }
          ],
          "listening_parts": [
            {"part_number": 1, "audio_file_path": "audio/abc.mp3",
             "transcript": "...", "instructions": "...",
             "questions": [...]}
          ],
          "writing_tasks": [
            {"task_number": 1, "prompt": "...", "min_words": 150,
             "suggested_minutes": 20, "requirements": "..."}
          ]
        }
        """
        org = self.get_organization()
        d = request.data

        module = d.get('module')
        if module not in ('listening', 'reading', 'writing', 'speaking', 'full_mock'):
            return Response({'detail': 'Noto‘g‘ri module qiymati.'}, status=400)
        name = (d.get('name') or '').strip()
        if not name:
            return Response({'name': 'Test nomini kiriting.'}, status=400)

        is_published = bool(d.get('is_published', False))

        with transaction.atomic():
            test = Test.objects.create(
                organization=org,
                is_global=False,
                name=name,
                module=module,
                test_type=d.get('test_type', 'academic'),
                difficulty=d.get('difficulty', 'intermediate'),
                duration_minutes=int(d.get('duration_minutes') or 60),
                description=d.get('description', '') or '',
                category=d.get('category', '') or '',
                is_published=is_published,
                status='published' if is_published else 'draft',
                created_by=request.user,
            )

            # Passages (reading) + nested questions
            for p_data in (d.get('passages') or []):
                p = Passage.objects.create(
                    test=test,
                    part_number=int(p_data.get('part_number') or 1),
                    title=(p_data.get('title') or '').strip(),
                    subtitle=(p_data.get('subtitle') or '').strip(),
                    content=p_data.get('content', '') or '',
                    instructions=p_data.get('instructions', '') or '',
                    min_words=p_data.get('min_words') or None,
                    order=int(p_data.get('order') or p_data.get('part_number') or 1),
                )
                for q_data in (p_data.get('questions') or []):
                    _create_question(passage=p, q=q_data)

            # Listening parts + nested questions
            for lp_data in (d.get('listening_parts') or []):
                lp = ListeningPart.objects.create(
                    test=test,
                    part_number=int(lp_data.get('part_number') or 1),
                    transcript=lp_data.get('transcript', '') or '',
                    instructions=lp_data.get('instructions', '') or '',
                )
                audio_path = lp_data.get('audio_file_path')
                if audio_path:
                    lp.audio_file.name = _normalize_path(audio_path)
                    lp.save(update_fields=['audio_file'])
                # Listening parts ham rasm bo'lishi mumkin (map, diagram).
                image_path = lp_data.get('image_path')
                if image_path:
                    lp.image.name = _normalize_path(image_path)
                    lp.save(update_fields=['image'])
                for q_data in (lp_data.get('questions') or []):
                    _create_question(listening_part=lp, q=q_data)

            # Writing tasks
            for wt_data in (d.get('writing_tasks') or []):
                wt = WritingTask.objects.create(
                    test=test,
                    task_number=int(wt_data.get('task_number') or 1),
                    prompt=wt_data.get('prompt', '') or '',
                    min_words=int(wt_data.get('min_words') or 150),
                    suggested_minutes=int(wt_data.get('suggested_minutes') or 20),
                    requirements=wt_data.get('requirements', '') or '',
                )
                # Faqat Task 1 uchun chart rasmni saqlaymiz
                chart_path = wt_data.get('chart_image_path')
                if chart_path and wt.task_number == 1:
                    wt.chart_image.name = _normalize_path(chart_path)
                    wt.save(update_fields=['chart_image'])

            # ETAP 18 — published bo'lsa struktura validatsiyasi
            # (transaction.atomic ichida — invalid bo'lsa rollback)
            _validate_test_structure(test)

        return Response(
            SuperTestDetailSerializer(test, context={'request': request}).data,
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
