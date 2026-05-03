"""SuperAdmin/Wizard serializers (ETAP 2).

ETAP 2 yangi nomlash konventsiyasi (prompt bo'yicha):
  - Question.prompt, alt_answers, question_number
  - Passage.section_number, body_text, subtitle, instructions
  - ListeningPart, WritingTask
"""

from rest_framework import serializers

from .models import ListeningPart, Passage, Question, Test, WritingTask


class WizardQuestionSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = Question
        fields = [
            'id', 'question_number', 'question_type',
            'prompt', 'options', 'correct_answer', 'alt_answers', 'points',
            'image', 'image_url',
        ]
        extra_kwargs = {'image': {'write_only': True, 'required': False}}

    def get_image_url(self, obj):
        if obj.image:
            request = self.context.get('request')
            url = obj.image.url
            return request.build_absolute_uri(url) if request else url
        return None

    def validate(self, attrs):
        # prompt bo'sh bo'lsa, eski text dan to'ldiramiz (saqlash uchun)
        if not attrs.get('prompt') and self.instance is None:
            raise serializers.ValidationError({'prompt': 'Savol matni majburiy'})
        return attrs

    def create(self, validated_data):
        # eski 'text' fieldini ham to'ldiramiz (backwards compat)
        validated_data.setdefault('text', validated_data.get('prompt', ''))
        validated_data.setdefault('order', validated_data.get('question_number', 0))
        if 'acceptable_answers' not in validated_data:
            validated_data['acceptable_answers'] = validated_data.get('alt_answers', [])
        return super().create(validated_data)


class ListeningPartSerializer(serializers.ModelSerializer):
    questions = WizardQuestionSerializer(many=True, read_only=True)
    audio_url = serializers.SerializerMethodField()
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = ListeningPart
        fields = [
            'id', 'part_number',
            'audio_url', 'audio_duration_seconds', 'audio_bitrate_kbps',
            'audio_size_bytes',
            'image_url', 'transcript', 'instructions', 'questions',
        ]
        read_only_fields = [
            'audio_url', 'audio_duration_seconds',
            'audio_bitrate_kbps', 'audio_size_bytes', 'image_url',
        ]

    def get_audio_url(self, obj):
        if obj.audio_file:
            request = self.context.get('request')
            url = obj.audio_file.url
            return request.build_absolute_uri(url) if request else url
        return None

    def get_image_url(self, obj):
        if obj.image:
            request = self.context.get('request')
            url = obj.image.url
            return request.build_absolute_uri(url) if request else url
        return None


class WizardPassageSerializer(serializers.ModelSerializer):
    """ETAP 2 nomlash: section_number ↔ part_number, body_text ↔ content."""

    section_number = serializers.IntegerField(source='part_number')
    body_text = serializers.CharField(source='content')
    questions = WizardQuestionSerializer(many=True, read_only=True)
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = Passage
        fields = [
            'id', 'section_number', 'title', 'subtitle',
            'body_text', 'instructions', 'image_url', 'questions',
        ]

    def get_image_url(self, obj):
        if obj.image:
            request = self.context.get('request')
            url = obj.image.url
            return request.build_absolute_uri(url) if request else url
        return None


class WritingTaskSerializer(serializers.ModelSerializer):
    chart_image_url = serializers.SerializerMethodField()

    class Meta:
        model = WritingTask
        fields = [
            'id', 'task_number', 'prompt', 'chart_image_url',
            'min_words', 'suggested_minutes', 'requirements',
        ]
        read_only_fields = ['chart_image_url']

    def get_chart_image_url(self, obj):
        return obj.chart_image.url if obj.chart_image else None


class SuperTestListSerializer(serializers.ModelSerializer):
    questions_count = serializers.SerializerMethodField()
    is_cloned = serializers.SerializerMethodField()

    class Meta:
        model = Test
        fields = [
            'id', 'name', 'module', 'difficulty', 'test_type', 'status',
            'description', 'category', 'duration_minutes',
            'is_global', 'organization', 'cloned_from',
            'questions_count', 'is_cloned',
            'is_practice_enabled', 'practice_time_limit',
            'created_at', 'published_at',
        ]

    def get_questions_count(self, obj):
        if obj.module == 'listening':
            return Question.objects.filter(listening_part__test=obj).count()
        if obj.module == 'reading':
            return Question.objects.filter(passage__test=obj).count()
        if obj.module == 'full_mock':
            return (
                Question.objects.filter(listening_part__test=obj).count()
                + Question.objects.filter(passage__test=obj).count()
            )
        return 0

    def get_is_cloned(self, obj):
        return obj.cloned_from_id is not None


class SuperTestDetailSerializer(serializers.ModelSerializer):
    listening_parts = ListeningPartSerializer(many=True, read_only=True)
    passages = WizardPassageSerializer(many=True, read_only=True)
    writing_tasks = WritingTaskSerializer(many=True, read_only=True)
    questions_count = serializers.SerializerMethodField()

    class Meta:
        model = Test
        fields = [
            'id', 'name', 'module', 'difficulty', 'test_type', 'status',
            'description', 'category', 'duration_minutes',
            'is_global', 'organization', 'cloned_from',
            'created_at', 'updated_at', 'published_at',
            'listening_parts', 'passages', 'writing_tasks',
            'questions_count',
        ]

    def get_questions_count(self, obj):
        if obj.module == 'listening':
            return Question.objects.filter(listening_part__test=obj).count()
        if obj.module == 'reading':
            return Question.objects.filter(passage__test=obj).count()
        if obj.module == 'full_mock':
            return (
                Question.objects.filter(listening_part__test=obj).count()
                + Question.objects.filter(passage__test=obj).count()
            )
        return 0


class SuperTestCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Test
        fields = [
            'id', 'name', 'module', 'difficulty', 'test_type',
            'description', 'category', 'duration_minutes',
            'status', 'is_global', 'created_at',
        ]
        read_only_fields = ['id', 'status', 'is_global', 'created_at']
