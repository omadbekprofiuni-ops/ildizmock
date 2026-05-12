from django.db import transaction
from rest_framework import serializers

from .models import ListeningPart, Passage, Question, Test


class AdminQuestionSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()
    image_path = serializers.SerializerMethodField()

    class Meta:
        model = Question
        fields = [
            'id', 'passage', 'order', 'question_type', 'text', 'options',
            'correct_answer', 'acceptable_answers', 'group_id', 'instruction',
            'points', 'image', 'image_path',
            'payload', 'answer_key',
        ]

    def get_image(self, obj):
        if not obj.image:
            return None
        try:
            url = obj.image.url
        except (ValueError, AttributeError):
            return None
        request = self.context.get('request')
        if request is not None:
            return request.build_absolute_uri(url)
        return url if url.startswith('http') else f'http://localhost:8000{url}'

    def get_image_path(self, obj):
        return obj.image.name if obj.image else None


class AdminPassageSerializer(serializers.ModelSerializer):
    questions = AdminQuestionSerializer(many=True, read_only=True)
    audio_file = serializers.SerializerMethodField()
    audio_file_path = serializers.SerializerMethodField()

    class Meta:
        model = Passage
        fields = [
            'id', 'test', 'part_number', 'title', 'content', 'audio_file',
            'audio_file_path',
            'audio_duration_seconds', 'min_words', 'order', 'questions',
        ]

    def get_audio_file(self, obj):
        if not obj.audio_file:
            return None
        try:
            url = obj.audio_file.url
        except (ValueError, AttributeError):
            return None
        request = self.context.get('request')
        if request is not None:
            return request.build_absolute_uri(url)
        return url if url.startswith('http') else f'http://localhost:8000{url}'

    def get_audio_file_path(self, obj):
        return obj.audio_file.name if obj.audio_file else None


class _NestedQuestionSerializer(serializers.ModelSerializer):
    image_path = serializers.CharField(
        required=False, allow_blank=True, allow_null=True, write_only=True,
    )

    class Meta:
        model = Question
        fields = [
            'order', 'question_type', 'text', 'options', 'correct_answer',
            'acceptable_answers', 'group_id', 'instruction', 'points',
            'image_path',
            'payload', 'answer_key',
        ]
        extra_kwargs = {
            'options': {'required': False, 'default': list},
            'acceptable_answers': {'required': False, 'default': list},
            'group_id': {'required': False, 'default': 0},
            'instruction': {'required': False, 'default': ''},
            'points': {'required': False, 'default': 1},
            'payload': {'required': False, 'default': dict},
            'answer_key': {'required': False, 'default': dict},
            # For group-form matching_headings the real data lives in
            # payload/answer_key — accept empty correct_answer.
            'correct_answer': {'required': False, 'default': ''},
        }


class _NestedPassageSerializer(serializers.ModelSerializer):
    questions = _NestedQuestionSerializer(many=True, required=False)
    audio_file_path = serializers.CharField(
        required=False, allow_blank=True, allow_null=True, write_only=True,
    )

    class Meta:
        model = Passage
        fields = ['part_number', 'title', 'content', 'order', 'questions',
                  'min_words', 'audio_file_path']
        extra_kwargs = {
            'min_words': {'required': False, 'allow_null': True},
        }


class AdminTestSerializer(serializers.ModelSerializer):
    passages = AdminPassageSerializer(many=True, read_only=True)
    passages_input = _NestedPassageSerializer(
        many=True, write_only=True, required=False,
    )
    question_count = serializers.SerializerMethodField()
    attempt_count = serializers.SerializerMethodField()

    class Meta:
        model = Test
        fields = [
            'id', 'name', 'module', 'test_type', 'difficulty',
            'duration_minutes', 'description', 'is_published', 'access_level',
            'created_at', 'question_count', 'attempt_count',
            'passages', 'passages_input',
        ]
        read_only_fields = ['id', 'created_at']

    def get_question_count(self, obj):
        # ETAP 19 — wizard yaratgan listening_parts/writing_tasks ham hisobga olinadi
        from django.db.models import Q
        return Question.objects.filter(
            Q(passage__test=obj) | Q(listening_part__test=obj),
        ).count()

    def get_attempt_count(self, obj):
        return obj.attempts.count()

    def to_representation(self, instance):
        # ETAP 19 — Listening testlar uchun listening_parts'larni passages sifatida
        # ko'rsatamiz. Simple editor (AdminTestEditPage) ushbu ma'lumotni
        # ko'rsatadi va PATCH orqali to'g'ri yangilanadi.
        data = super().to_representation(instance)
        if instance.module == 'listening':
            data['passages'] = self._serialize_listening_parts(instance)
        return data

    def _serialize_listening_parts(self, test):
        parts = []
        request = self.context.get('request')
        for lp in test.listening_parts.order_by('part_number').prefetch_related('questions'):
            audio_url = None
            audio_path = None
            if lp.audio_file:
                try:
                    audio_url = lp.audio_file.url
                    if request is not None:
                        audio_url = request.build_absolute_uri(audio_url)
                    audio_path = lp.audio_file.name
                except (ValueError, AttributeError):
                    pass
            questions = []
            for q in lp.questions.all().order_by('order'):
                q_image_url = None
                q_image_path = None
                if q.image:
                    try:
                        q_image_url = q.image.url
                        if request is not None:
                            q_image_url = request.build_absolute_uri(q_image_url)
                        q_image_path = q.image.name
                    except (ValueError, AttributeError):
                        pass
                questions.append({
                    'id': q.id,
                    'listening_part': lp.id,
                    'order': q.order,
                    'question_type': q.question_type,
                    'text': q.text,
                    'options': q.options or [],
                    'correct_answer': q.correct_answer,
                    'acceptable_answers': q.acceptable_answers or [],
                    'group_id': q.group_id,
                    'instruction': q.instruction,
                    'points': q.points,
                    'image': q_image_url,
                    'image_path': q_image_path,
                    'payload': q.payload or {},
                    'answer_key': q.answer_key or {},
                })
            parts.append({
                'id': lp.id,
                'test': test.id,
                'part_number': lp.part_number,
                # ListeningPart'da title yo'q — instructions ishlatamiz; bo'sh
                # bo'lsa standart "Part N" formatida.
                'title': lp.instructions[:120] if lp.instructions else f'Part {lp.part_number}',
                'content': lp.transcript or lp.instructions or '',
                'audio_file': audio_url,
                'audio_file_path': audio_path,
                'audio_duration_seconds': lp.audio_duration_seconds,
                'min_words': None,
                'order': lp.part_number,
                'questions': questions,
                '_is_listening_part': True,
            })
        return parts

    @transaction.atomic
    def create(self, validated_data):
        passages_data = validated_data.pop('passages_input', [])
        test = Test.objects.create(**validated_data)
        self._rebuild_passages(test, passages_data)
        return test

    @transaction.atomic
    def update(self, instance, validated_data):
        passages_data = validated_data.pop('passages_input', None)
        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.save()
        if passages_data is not None:
            if instance.module == 'listening':
                # ETAP 19 — Listening testlarda passages_input'ni listening_parts'ga
                # yo'naltiramiz; Question'lar passage o'rniga listening_part bilan
                # bog'lanadi.
                self._upsert_listening_parts(instance, passages_data)
            else:
                self._upsert_passages(instance, passages_data)
        return instance

    def _upsert_listening_parts(self, test, parts_data):
        """ETAP 19 — Listening uchun: passages_input → ListeningPart yangilanishi."""
        existing = {lp.part_number: lp for lp in test.listening_parts.all()}
        seen_ids: set[int] = set()

        for p_data in parts_data:
            data = dict(p_data)
            questions_data = data.pop('questions', [])
            audio_path = data.pop('audio_file_path', None)
            part_number = data.get('part_number')

            lp = existing.get(part_number)
            content = data.get('content') or ''
            instructions = data.get('title') or ''
            if lp is None:
                lp = ListeningPart.objects.create(
                    test=test,
                    part_number=part_number,
                    instructions=instructions,
                    transcript=content,
                )
            else:
                # title -> instructions, content -> transcript
                lp.instructions = instructions
                lp.transcript = content
                lp.save(update_fields=['instructions', 'transcript'])
            seen_ids.add(lp.id)

            if audio_path is not None:
                normalised = _normalize_audio_path(audio_path) if audio_path else ''
                if (lp.audio_file.name or '') != normalised:
                    lp.audio_file.name = normalised
                    lp.save(update_fields=['audio_file'])

            self._upsert_listening_questions(lp, questions_data)

        # Eski listening_parts'ni o'chiramiz (Question'lar cascade orqali ketadi)
        test.listening_parts.exclude(id__in=seen_ids).delete()

    def _upsert_listening_questions(self, listening_part, questions_data):
        existing = {q.order: q for q in listening_part.questions.all()}
        seen_q_ids: set[int] = set()

        for q_data in questions_data:
            data = dict(q_data)
            image_path = data.pop('image_path', None)
            order = data.get('order')
            q = existing.get(order)

            if q is None:
                q = Question.objects.create(listening_part=listening_part, **data)
            else:
                for k, v in data.items():
                    setattr(q, k, v)
                q.save()
            seen_q_ids.add(q.id)

            if image_path is not None:
                normalised = _normalize_media_path(image_path) if image_path else ''
                if (q.image.name or '') != normalised:
                    q.image.name = normalised
                    q.save(update_fields=['image'])

        listening_part.questions.exclude(id__in=seen_q_ids).delete()

    def _rebuild_passages(self, test, passages_data):
        """Used on create — no existing rows to preserve."""
        for p_data in passages_data:
            questions_data = p_data.pop('questions', [])
            audio_path = p_data.pop('audio_file_path', None)
            passage = Passage.objects.create(test=test, **p_data)
            if audio_path:
                passage.audio_file.name = _normalize_audio_path(audio_path)
                passage.save(update_fields=['audio_file'])
            for q_data in questions_data:
                image_path = q_data.pop('image_path', None)
                question = Question.objects.create(passage=passage, **q_data)
                if image_path:
                    question.image.name = _normalize_media_path(image_path)
                    question.save(update_fields=['image'])

    def _upsert_passages(self, test, passages_data):
        """ETAP 22 — idempotent passage/question sync.

        Matches existing rows by (test, part_number) so that autosave PATCHes
        don't churn IDs (which would orphan student attempts) and don't
        cascade-delete on every keystroke. Anything not in the incoming
        payload is removed.
        """
        existing_passages = {p.part_number: p for p in test.passages.all()}
        seen_passage_ids: set[int] = set()

        for p_data in passages_data:
            data = dict(p_data)
            questions_data = data.pop('questions', [])
            audio_path = data.pop('audio_file_path', None)
            part_number = data.get('part_number')
            passage = existing_passages.get(part_number)

            if passage is None:
                passage = Passage.objects.create(test=test, **data)
            else:
                for k, v in data.items():
                    setattr(passage, k, v)
                passage.save()
            seen_passage_ids.add(passage.id)

            if audio_path is not None:
                normalised = _normalize_audio_path(audio_path) if audio_path else ''
                if (passage.audio_file.name or '') != normalised:
                    passage.audio_file.name = normalised
                    passage.save(update_fields=['audio_file'])

            self._upsert_questions(passage, questions_data)

        # Drop passages no longer in the payload.
        test.passages.exclude(id__in=seen_passage_ids).delete()

    def _upsert_questions(self, passage, questions_data):
        existing = {q.order: q for q in passage.questions.all()}
        seen_q_ids: set[int] = set()

        for q_data in questions_data:
            data = dict(q_data)
            image_path = data.pop('image_path', None)
            order = data.get('order')
            q = existing.get(order)

            if q is None:
                q = Question.objects.create(passage=passage, **data)
            else:
                for k, v in data.items():
                    setattr(q, k, v)
                q.save()
            seen_q_ids.add(q.id)

            if image_path is not None:
                normalised = _normalize_media_path(image_path) if image_path else ''
                if (q.image.name or '') != normalised:
                    q.image.name = normalised
                    q.save(update_fields=['image'])

        passage.questions.exclude(id__in=seen_q_ids).delete()


def _normalize_audio_path(value: str) -> str:
    """Always store the relative storage path (e.g. ``audio/abc.mp3``).

    Frontend ba'zan to'liq URL yuborib qo'yadi (eski data, draft, edit). Bu
    ``MEDIA_URL`` bilan birikmaydigan keraksiz prefiksni olib tashlaydi.
    """
    return _normalize_media_path(value)


def _normalize_media_path(value: str) -> str:
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
