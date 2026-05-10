from rest_framework import serializers

from .models import ListeningPart, Passage, Question, Test, WritingTask


class QuestionPublicSerializer(serializers.ModelSerializer):
    """Student-facing: correct_answer and acceptable_answers are hidden."""

    image_url = serializers.SerializerMethodField()

    class Meta:
        model = Question
        fields = ['id', 'order', 'question_number', 'question_type',
                  'text', 'prompt', 'options',
                  'group_id', 'instruction', 'points', 'image_url',
                  'payload']

    def get_image_url(self, obj):
        if not obj.image:
            return None
        request = self.context.get('request')
        url = obj.image.url
        return request.build_absolute_uri(url) if request else url


def _absolute_url(file_field, context):
    if not file_field:
        return None
    try:
        url = file_field.url
    except (ValueError, AttributeError):
        return None
    request = context.get('request')
    if request is not None:
        absolute = request.build_absolute_uri(url)
        # Production safety net: if the page is HTTPS but Django didn't see
        # X-Forwarded-Proto (mis-configured nginx), build_absolute_uri() will
        # return http://, which the browser blocks as mixed content. Force
        # https when DEBUG is off — same domain, just upgrade the scheme.
        from django.conf import settings
        if not settings.DEBUG and absolute.startswith('http://'):
            absolute = 'https://' + absolute[len('http://'):]
        return absolute
    # Dev fallback: assume Django on localhost:8000 if no request context
    return url if url.startswith('http') else f'http://localhost:8000{url}'


class PassagePublicSerializer(serializers.ModelSerializer):
    questions = QuestionPublicSerializer(many=True, read_only=True)
    audio_file = serializers.SerializerMethodField()
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = Passage
        fields = ['id', 'part_number', 'title', 'subtitle', 'content',
                  'instructions', 'audio_file', 'audio_duration_seconds',
                  'min_words', 'order', 'image_url', 'questions']

    def get_audio_file(self, obj):
        return _absolute_url(obj.audio_file, self.context)

    def get_image_url(self, obj):
        return _absolute_url(obj.image, self.context)


class ListeningPartPublicSerializer(serializers.ModelSerializer):
    questions = QuestionPublicSerializer(many=True, read_only=True)
    audio_url = serializers.SerializerMethodField()
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = ListeningPart
        fields = ['id', 'part_number', 'audio_url', 'image_url',
                  'audio_duration_seconds', 'instructions', 'questions']

    def get_audio_url(self, obj):
        return _absolute_url(obj.audio_file, self.context)

    def get_image_url(self, obj):
        return _absolute_url(obj.image, self.context)


class WritingTaskPublicSerializer(serializers.ModelSerializer):
    chart_image_url = serializers.SerializerMethodField()

    class Meta:
        model = WritingTask
        fields = ['id', 'task_number', 'prompt', 'chart_image_url',
                  'min_words', 'suggested_minutes', 'requirements']

    def get_chart_image_url(self, obj):
        return _absolute_url(obj.chart_image, self.context)


class TestListSerializer(serializers.ModelSerializer):
    question_count = serializers.SerializerMethodField()

    class Meta:
        model = Test
        fields = ['id', 'name', 'module', 'test_type', 'difficulty',
                  'duration_minutes', 'description', 'access_level',
                  'question_count', 'is_practice_enabled', 'practice_time_limit']

    def get_question_count(self, obj):
        from django.db.models import Q
        return Question.objects.filter(
            Q(passage__test=obj) | Q(listening_part__test=obj),
        ).count()


class TestDetailSerializer(serializers.ModelSerializer):
    passages = PassagePublicSerializer(many=True, read_only=True)
    listening_parts = ListeningPartPublicSerializer(many=True, read_only=True)
    writing_tasks = WritingTaskPublicSerializer(many=True, read_only=True)

    class Meta:
        model = Test
        fields = ['id', 'name', 'module', 'test_type', 'difficulty',
                  'duration_minutes', 'description', 'access_level',
                  'passages', 'listening_parts', 'writing_tasks',
                  'is_practice_enabled', 'practice_time_limit']
