"""ETAP 27 PART 5.2 — Test Library views.

Library = superadmin tomonidan yaratilgan global testlar (`is_global=True`).
Markaz adminlari ularni o'z markaziga klon qilishi mumkin.

Endpoint'lar:
  GET  /api/v1/library/tests/                     — barcha published library
  GET  /api/v1/library/tests/<uuid>/              — bitta test detail
  POST /api/v1/library/tests/<uuid>/clone-to-org/ — joriy markazga clone
"""
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ListeningPart, Passage, Question, Test, WritingTask
from .serializers import TestDetailSerializer, TestListSerializer


class LibraryTestListView(generics.ListAPIView):
    """Library testlar ro'yxati — hamma autentifikatsiyalangan foydalanuvchi
    ko'radi (markaz adminlari clone qilish uchun, talabalar bo'lsa kelajakda
    o'zlari o'qish uchun).
    """

    permission_classes = [IsAuthenticated]
    serializer_class = TestListSerializer

    def get_queryset(self):
        qs = Test.objects.filter(
            is_global=True,
            is_published=True,
            is_deleted=False,
        ).order_by('-created_at')
        module = self.request.query_params.get('module')
        if module:
            qs = qs.filter(module=module)
        return qs


class LibraryTestDetailView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = TestDetailSerializer
    lookup_field = 'pk'

    def get_queryset(self):
        return Test.objects.filter(is_global=True, is_deleted=False)


class LibraryCloneToOrgView(APIView):
    """Library test'ini foydalanuvchining markaziga draft sifatida klon qiladi.

    Mavjud Passage / ListeningPart / WritingTask / Question yozuvlarini
    nusxalaydi. Audio va passage matni nusxa olinadi (file referansi shu
    fayl ustiga ishora qiladi — yangi upload qilmaydi).
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        original = get_object_or_404(
            Test, pk=pk, is_global=True, is_deleted=False,
        )
        org = getattr(request.user, 'organization', None)
        if org is None:
            return Response(
                {'detail': 'Cloning requires a center membership.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        new_test = Test.objects.create(
            organization=org,
            is_global=False,
            name=f'{original.name} (Copy)',
            module=original.module,
            test_type=original.test_type,
            difficulty=original.difficulty,
            duration_minutes=original.duration_minutes,
            description=original.description,
            is_published=False,
            access_level=original.access_level,
            created_by=request.user,
            status='draft',
            category=original.category,
            cloned_from=original,
        )

        # Passage nusxalash + savollarni o'zlashtirish
        for p in original.passages.all():
            new_p = Passage.objects.create(
                test=new_test,
                part_number=p.part_number,
                title=p.title,
                subtitle=p.subtitle if hasattr(p, 'subtitle') else '',
                content=p.content,
                instructions=getattr(p, 'instructions', ''),
                audio_file=p.audio_file,
                audio_duration_seconds=getattr(p, 'audio_duration_seconds', None),
                min_words=getattr(p, 'min_words', None),
                order=p.order,
            )
            for q in p.questions.all():
                Question.objects.create(
                    passage=new_p,
                    order=q.order,
                    question_number=q.question_number,
                    question_type=q.question_type,
                    text=q.text,
                    prompt=q.prompt,
                    options=q.options,
                    correct_answer=q.correct_answer,
                    acceptable_answers=q.acceptable_answers,
                    alt_answers=q.alt_answers,
                    group_id=q.group_id,
                    instruction=q.instruction,
                    points=q.points,
                    payload=q.payload,
                    answer_key=q.answer_key,
                )

        # Listening part nusxalash
        for lp in original.listening_parts.all():
            new_lp = ListeningPart.objects.create(
                test=new_test,
                part_number=lp.part_number,
                audio_file=lp.audio_file,
                image=lp.image if hasattr(lp, 'image') else None,
                audio_duration_seconds=getattr(lp, 'audio_duration_seconds', None),
                instructions=getattr(lp, 'instructions', ''),
                transcript=getattr(lp, 'transcript', ''),
            )
            for q in lp.questions.all():
                Question.objects.create(
                    listening_part=new_lp,
                    order=q.order,
                    question_number=q.question_number,
                    question_type=q.question_type,
                    text=q.text,
                    prompt=q.prompt,
                    options=q.options,
                    correct_answer=q.correct_answer,
                    acceptable_answers=q.acceptable_answers,
                    alt_answers=q.alt_answers,
                    group_id=q.group_id,
                    instruction=q.instruction,
                    points=q.points,
                    payload=q.payload,
                    answer_key=q.answer_key,
                )

        # Writing task nusxalash
        for wt in original.writing_tasks.all():
            WritingTask.objects.create(
                test=new_test,
                task_number=wt.task_number,
                prompt=wt.prompt,
                chart_image=wt.chart_image,
                min_words=wt.min_words,
                suggested_minutes=wt.suggested_minutes,
                requirements=wt.requirements,
            )

        return Response({
            'test_id': str(new_test.id),
            'edit_url': f'/admin/tests/{new_test.id}/edit',
            'name': new_test.name,
        }, status=status.HTTP_201_CREATED)
