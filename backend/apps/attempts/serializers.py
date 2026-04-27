from rest_framework import serializers

from apps.tests.serializers import TestDetailSerializer

from .models import Answer, Attempt


class AttemptStartSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attempt
        fields = ['id', 'status', 'started_at', 'test']


class _AnswerInputSerializer(serializers.Serializer):
    question_id = serializers.IntegerField()
    answer = serializers.JSONField(allow_null=True)


class AnswersBulkSerializer(serializers.Serializer):
    answers = _AnswerInputSerializer(many=True)


class AttemptListSerializer(serializers.ModelSerializer):
    test_name = serializers.CharField(source='test.name', read_only=True)
    module = serializers.CharField(source='test.module', read_only=True)

    class Meta:
        model = Attempt
        fields = ['id', 'test', 'test_name', 'module', 'status', 'started_at',
                  'submitted_at', 'raw_score', 'total_questions', 'band_score']


class AttemptDetailSerializer(serializers.ModelSerializer):
    test = TestDetailSerializer(read_only=True)
    answers_saved = serializers.SerializerMethodField()

    class Meta:
        model = Attempt
        fields = ['id', 'status', 'started_at', 'submitted_at', 'time_spent_seconds',
                  'test', 'answers_saved', 'essay_text', 'word_count']

    def get_answers_saved(self, obj):
        return {str(a.question_id): a.user_answer for a in obj.answers.all()}


class _AnswerResultSerializer(serializers.ModelSerializer):
    correct_answer = serializers.SerializerMethodField()
    question_text = serializers.CharField(source='question.text', read_only=True)
    question_prompt = serializers.CharField(source='question.prompt', read_only=True)
    question_type = serializers.CharField(source='question.question_type', read_only=True)
    question_order = serializers.IntegerField(source='question.order', read_only=True)
    question_number = serializers.IntegerField(source='question.question_number', read_only=True)

    class Meta:
        model = Answer
        fields = [
            'question', 'question_order', 'question_number', 'question_text',
            'question_prompt', 'question_type',
            'user_answer', 'is_correct', 'points_earned', 'correct_answer',
        ]

    def get_correct_answer(self, obj):
        return obj.question.correct_answer


class AttemptResultSerializer(serializers.ModelSerializer):
    test = TestDetailSerializer(read_only=True)
    answers = _AnswerResultSerializer(many=True, read_only=True)
    test_name = serializers.CharField(source='test.name', read_only=True)
    module = serializers.CharField(source='test.module', read_only=True)
    graded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Attempt
        fields = ['id', 'test', 'test_name', 'module', 'status', 'started_at',
                  'submitted_at', 'raw_score', 'total_questions', 'band_score',
                  'essay_text', 'word_count', 'teacher_feedback',
                  'graded_by_name', 'graded_at', 'answers']

    def get_graded_by_name(self, obj):
        if not obj.graded_by:
            return None
        u = obj.graded_by
        return f'{u.first_name} {u.last_name}'.strip() or u.phone
