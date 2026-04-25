from django.db import transaction
from rest_framework import serializers

from .models import Passage, Question, Test


class AdminQuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        fields = [
            'id', 'passage', 'order', 'question_type', 'text', 'options',
            'correct_answer', 'acceptable_answers', 'group_id', 'instruction',
            'points',
        ]


class AdminPassageSerializer(serializers.ModelSerializer):
    questions = AdminQuestionSerializer(many=True, read_only=True)

    class Meta:
        model = Passage
        fields = [
            'id', 'test', 'part_number', 'title', 'content', 'audio_file',
            'audio_duration_seconds', 'min_words', 'order', 'questions',
        ]


class _NestedQuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        fields = [
            'order', 'question_type', 'text', 'options', 'correct_answer',
            'acceptable_answers', 'group_id', 'instruction', 'points',
        ]
        extra_kwargs = {
            'options': {'required': False, 'default': list},
            'acceptable_answers': {'required': False, 'default': list},
            'group_id': {'required': False, 'default': 0},
            'instruction': {'required': False, 'default': ''},
            'points': {'required': False, 'default': 1},
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
        return Question.objects.filter(passage__test=obj).count()

    def get_attempt_count(self, obj):
        return obj.attempts.count()

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
            instance.passages.all().delete()
            self._rebuild_passages(instance, passages_data)
        return instance

    def _rebuild_passages(self, test, passages_data):
        for p_data in passages_data:
            questions_data = p_data.pop('questions', [])
            audio_path = p_data.pop('audio_file_path', None)
            passage = Passage.objects.create(test=test, **p_data)
            if audio_path:
                passage.audio_file.name = audio_path
                passage.save(update_fields=['audio_file'])
            for q_data in questions_data:
                Question.objects.create(passage=passage, **q_data)
