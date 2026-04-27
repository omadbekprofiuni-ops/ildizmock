"""Talabaga test ma'lumotini yuborish uchun serializer'lar — to'g'ri javoblarsiz."""

from rest_framework import serializers

from apps.tests.models import ListeningPart, Passage, Question, WritingTask


class StudentQuestionSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = Question
        fields = [
            'id', 'question_number', 'question_type',
            'prompt', 'text', 'options', 'instruction', 'points', 'order',
            'image_url',
        ]

    def get_image_url(self, obj):
        if obj.image:
            request = self.context.get('request')
            url = obj.image.url
            return request.build_absolute_uri(url) if request else url
        return None


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
        if obj.image:
            request = self.context.get('request')
            url = obj.image.url
            return request.build_absolute_uri(url) if request else url
        return None


class StudentWritingTaskSerializer(serializers.ModelSerializer):
    chart_image_url = serializers.SerializerMethodField()

    class Meta:
        model = WritingTask
        fields = [
            'id', 'task_number', 'prompt', 'chart_image_url',
            'min_words', 'suggested_minutes', 'requirements',
        ]

    def get_chart_image_url(self, obj):
        if obj.chart_image:
            request = self.context.get('request')
            url = obj.chart_image.url
            return request.build_absolute_uri(url) if request else url
        return None
