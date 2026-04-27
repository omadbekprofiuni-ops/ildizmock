from rest_framework import serializers

from .models import Passage, Question, Test


class QuestionPublicSerializer(serializers.ModelSerializer):
    """Student-facing: correct_answer and acceptable_answers are hidden."""

    class Meta:
        model = Question
        fields = ['id', 'order', 'question_type', 'text', 'options',
                  'group_id', 'instruction', 'points']


class PassagePublicSerializer(serializers.ModelSerializer):
    questions = QuestionPublicSerializer(many=True, read_only=True)

    class Meta:
        model = Passage
        fields = ['id', 'part_number', 'title', 'content', 'audio_file',
                  'audio_duration_seconds', 'min_words', 'order', 'questions']


class TestListSerializer(serializers.ModelSerializer):
    question_count = serializers.SerializerMethodField()

    class Meta:
        model = Test
        fields = ['id', 'name', 'module', 'test_type', 'difficulty',
                  'duration_minutes', 'description', 'access_level',
                  'question_count', 'is_practice_enabled', 'practice_time_limit']

    def get_question_count(self, obj):
        return Question.objects.filter(passage__test=obj).count()


class TestDetailSerializer(serializers.ModelSerializer):
    passages = PassagePublicSerializer(many=True, read_only=True)

    class Meta:
        model = Test
        fields = ['id', 'name', 'module', 'test_type', 'difficulty',
                  'duration_minutes', 'description', 'access_level', 'passages',
                  'is_practice_enabled', 'practice_time_limit']
