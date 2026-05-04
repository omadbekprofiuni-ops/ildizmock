"""SuperAdmin / Wizard ViewSets (ETAP 2).

New `/api/v1/super/...` endpointlari — global test yaratish, audio yuklash,
savol qo'shish.
"""

from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from apps.organizations.permissions import IsSuperAdmin

from .models import ListeningPart, Passage, Question, Test, WritingTask
from .super_serializers import (
    ListeningPartSerializer,
    SuperTestCreateSerializer,
    SuperTestDetailSerializer,
    SuperTestListSerializer,
    WizardPassageSerializer,
    WizardQuestionSerializer,
    WritingTaskSerializer,
)


class SuperTestViewSet(viewsets.ModelViewSet):
    """SuperAdmin global test bazasini boshqarish."""

    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]
    queryset = Test.objects.filter(is_global=True).order_by('-created_at')

    def get_serializer_class(self):
        if self.action == 'create':
            return SuperTestCreateSerializer
        if self.action == 'retrieve':
            return SuperTestDetailSerializer
        return SuperTestListSerializer

    def perform_create(self, serializer):
        serializer.save(
            is_global=True,
            organization=None,
            created_by=self.request.user,
            status='draft',
        )

    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        test = self.get_object()
        test.status = 'published'
        test.is_published = True
        test.published_at = timezone.now()
        test.save(update_fields=['status', 'is_published', 'published_at', 'updated_at'])
        return Response({'detail': 'Test e\'lon qilindi', 'status': 'published'})

    @action(detail=True, methods=['post'])
    def unpublish(self, request, pk=None):
        test = self.get_object()
        test.status = 'draft'
        test.is_published = False
        test.save(update_fields=['status', 'is_published', 'updated_at'])
        return Response({'detail': 'Test draft qilindi', 'status': 'draft'})

    @action(detail=True, methods=['patch'], url_path='toggle-practice')
    def toggle_practice(self, request, pk=None):
        """ETAP 14 BUG #9 — Practice mode'ni yoqish/o'chirish."""
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

    @action(detail=True, methods=['post'], url_path='add-listening-part')
    def add_listening_part(self, request, pk=None):
        test = self.get_object()
        if test.module not in ('listening', 'full_mock'):
            raise ValidationError('Parts can only be added to Listening tests')

        part_number = request.data.get('part_number')
        if not part_number:
            raise ValidationError({'part_number': 'Majburiy'})

        part, _ = ListeningPart.objects.update_or_create(
            test=test, part_number=part_number,
            defaults={
                'transcript': request.data.get('transcript', ''),
                'instructions': request.data.get('instructions', ''),
            },
        )
        return Response(
            ListeningPartSerializer(part).data, status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'], url_path='add-passage')
    def add_passage(self, request, pk=None):
        test = self.get_object()
        if test.module not in ('reading', 'full_mock'):
            raise ValidationError('Passages can only be added to Reading tests')

        section_number = request.data.get('section_number')
        if not section_number:
            raise ValidationError({'section_number': 'Majburiy'})

        passage, _ = Passage.objects.update_or_create(
            test=test, part_number=section_number,
            defaults={
                'title': request.data.get('title', ''),
                'subtitle': request.data.get('subtitle', ''),
                'content': request.data.get('body_text', ''),
                'instructions': request.data.get('instructions', ''),
                'order': section_number,
            },
        )
        return Response(
            WizardPassageSerializer(passage).data, status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'], url_path='add-writing-task')
    def add_writing_task(self, request, pk=None):
        test = self.get_object()
        if test.module not in ('writing', 'full_mock'):
            raise ValidationError('Tasks can only be added to Writing tests')

        task_number = request.data.get('task_number')
        if not task_number:
            raise ValidationError({'task_number': 'Majburiy'})
        try:
            task_number = int(task_number)
        except (TypeError, ValueError):
            raise ValidationError({'task_number': 'Butun son'})

        task, _ = WritingTask.objects.update_or_create(
            test=test, task_number=task_number,
            defaults={
                'prompt': request.data.get('prompt', ''),
                'min_words': request.data.get(
                    'min_words', 150 if task_number == 1 else 250,
                ),
                'suggested_minutes': request.data.get(
                    'suggested_minutes', 20 if task_number == 1 else 40,
                ),
                'requirements': request.data.get('requirements', ''),
            },
        )
        return Response(
            WritingTaskSerializer(task).data, status=status.HTTP_201_CREATED,
        )


class SuperListeningPartViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]
    queryset = ListeningPart.objects.all()
    serializer_class = ListeningPartSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    @action(detail=True, methods=['post'], url_path='upload-audio')
    def upload_audio(self, request, pk=None):
        from mutagen import File as MutagenFile  # noqa: WPS433

        part = self.get_object()
        audio = request.FILES.get('audio')
        if not audio:
            raise ValidationError({'audio': 'Upload an audio file'})

        part.audio_file = audio
        part.audio_size_bytes = audio.size
        part.save()

        try:
            audio_meta = MutagenFile(part.audio_file.path)
            if audio_meta and audio_meta.info:
                part.audio_duration_seconds = int(getattr(audio_meta.info, 'length', 0) or 0)
                bitrate = getattr(audio_meta.info, 'bitrate', None)
                if bitrate:
                    part.audio_bitrate_kbps = int(bitrate / 1000)
                part.save(update_fields=[
                    'audio_duration_seconds', 'audio_bitrate_kbps',
                ])
        except Exception:  # noqa: BLE001
            pass

        return Response(ListeningPartSerializer(part).data)

    @action(detail=True, methods=['post'], url_path='add-question')
    def add_question(self, request, pk=None):
        part = self.get_object()
        ser = WizardQuestionSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        question = ser.save(listening_part=part)
        return Response(
            WizardQuestionSerializer(question).data,
            status=status.HTTP_201_CREATED,
        )


class SuperPassageViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]
    queryset = Passage.objects.all()
    serializer_class = WizardPassageSerializer

    @action(detail=True, methods=['post'], url_path='add-question')
    def add_question(self, request, pk=None):
        passage = self.get_object()
        ser = WizardQuestionSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        question = ser.save(passage=passage)
        return Response(
            WizardQuestionSerializer(question).data,
            status=status.HTTP_201_CREATED,
        )


class SuperWritingTaskViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]
    queryset = WritingTask.objects.all()
    serializer_class = WritingTaskSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    @action(detail=True, methods=['post'], url_path='upload-chart')
    def upload_chart(self, request, pk=None):
        task = self.get_object()
        if task.task_number != 1:
            raise ValidationError('Chart image is for Task 1 only')

        image = request.FILES.get('image')
        if not image:
            raise ValidationError({'image': 'Upload an image'})

        task.chart_image = image
        task.save(update_fields=['chart_image'])
        return Response(WritingTaskSerializer(task).data)


class SuperQuestionViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]
    queryset = Question.objects.all()
    serializer_class = WizardQuestionSerializer
