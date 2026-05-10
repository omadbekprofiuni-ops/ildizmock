"""Student-facing serializers for mock test data — without correct answers."""

from django.conf import settings
from rest_framework import serializers

from apps.tests.models import ListeningPart, Passage, Question, WritingTask


def _absolute_media_url(file_field, request):
    """Build a full media URL, with a production safety-net that upgrades
    http:// to https:// when DEBUG is off (in case nginx forgot to send
    X-Forwarded-Proto and Django thinks it's serving plain HTTP).
    """
    if not file_field:
        return None
    try:
        url = file_field.url
    except (ValueError, AttributeError):
        return None
    if request is None:
        return url
    absolute = request.build_absolute_uri(url)
    if not settings.DEBUG and absolute.startswith('http://'):
        absolute = 'https://' + absolute[len('http://'):]
    return absolute


class StudentQuestionSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = Question
        fields = [
            'id', 'question_number', 'question_type',
            'prompt', 'text', 'options', 'instruction', 'points', 'order',
            'image_url',
            # ETAP 22 — group-form payload (e.g. matching_headings).
            # Note: answer_key is intentionally NOT exposed (would leak answers).
            'payload',
        ]

    def get_image_url(self, obj):
        return _absolute_media_url(obj.image, self.context.get('request'))


class StudentListeningPartSerializer(serializers.ModelSerializer):
    questions = StudentQuestionSerializer(many=True, read_only=True)
    audio_url = serializers.SerializerMethodField()
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = ListeningPart
        fields = [
            'id', 'part_number', 'audio_url', 'image_url',
            'audio_duration_seconds', 'instructions', 'questions',
        ]

    def get_audio_url(self, obj):
        return _absolute_media_url(obj.audio_file, self.context.get('request'))

    def get_image_url(self, obj):
        return _absolute_media_url(obj.image, self.context.get('request'))


class StudentPassageSerializer(serializers.ModelSerializer):
    questions = StudentQuestionSerializer(many=True, read_only=True)
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = Passage
        fields = [
            'id', 'part_number', 'title', 'subtitle',
            'content', 'instructions', 'order', 'image_url', 'questions',
        ]

    def get_image_url(self, obj):
        return _absolute_media_url(obj.image, self.context.get('request'))


class StudentWritingTaskSerializer(serializers.ModelSerializer):
    chart_image_url = serializers.SerializerMethodField()

    class Meta:
        model = WritingTask
        fields = [
            'id', 'task_number', 'prompt', 'chart_image_url',
            'min_words', 'suggested_minutes', 'requirements',
        ]

    def get_chart_image_url(self, obj):
        return _absolute_media_url(obj.chart_image, self.context.get('request'))
