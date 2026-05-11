"""B2C Catalog uchun serializerlar (list/detail)."""

from rest_framework import serializers

from apps.tests.models import Question, Test


def _count_questions(obj: Test) -> int:
    if obj.module == 'listening':
        return Question.objects.filter(listening_part__test=obj).count()
    if obj.module in ('reading', 'writing'):
        return Question.objects.filter(passage__test=obj).count()
    if obj.module == 'full_mock':
        return (
            Question.objects.filter(listening_part__test=obj).count()
            + Question.objects.filter(passage__test=obj).count()
        )
    return 0


class B2CCatalogTestListSerializer(serializers.ModelSerializer):
    """Catalog kartochkasi uchun yengil shape."""
    name = serializers.SerializerMethodField()
    questions_count = serializers.SerializerMethodField()
    module_label = serializers.SerializerMethodField()
    difficulty_label = serializers.SerializerMethodField()
    source_display = serializers.CharField(read_only=True)

    class Meta:
        model = Test
        fields = [
            'id', 'name', 'module', 'module_label',
            'difficulty', 'difficulty_label', 'duration_minutes',
            'b2c_description', 'b2c_published_at', 'questions_count',
            'source', 'source_display',
        ]

    def get_name(self, obj):
        return obj.b2c_name

    def get_questions_count(self, obj):
        return _count_questions(obj)

    def get_module_label(self, obj):
        return obj.get_module_display()

    def get_difficulty_label(self, obj):
        return obj.get_difficulty_display()


class B2CCatalogTestDetailSerializer(serializers.ModelSerializer):
    """Catalog detail sahifa uchun — preview va meta ma'lumotlar."""
    name = serializers.SerializerMethodField()
    questions_count = serializers.SerializerMethodField()
    module_label = serializers.SerializerMethodField()
    difficulty_label = serializers.SerializerMethodField()
    source_display = serializers.CharField(read_only=True)

    class Meta:
        model = Test
        fields = [
            'id', 'name', 'module', 'module_label',
            'difficulty', 'difficulty_label', 'duration_minutes',
            'description', 'b2c_description', 'b2c_published_at',
            'category', 'questions_count',
            'source', 'source_display',
        ]

    def get_name(self, obj):
        return obj.b2c_name

    def get_questions_count(self, obj):
        return _count_questions(obj)

    def get_module_label(self, obj):
        return obj.get_module_display()

    def get_difficulty_label(self, obj):
        return obj.get_difficulty_display()
