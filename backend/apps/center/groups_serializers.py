"""ETAP 11 — Talabalar guruhi serializerlari."""

from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.organizations.models import StudentGroup

User = get_user_model()


class GroupTeacherMiniSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'full_name']

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username


class GroupMemberSerializer(serializers.ModelSerializer):
    """Guruhdagi har talabaning kichik kartasi (statistika bilan)."""

    full_name = serializers.SerializerMethodField()
    avg_band = serializers.FloatField(read_only=True, default=None)
    latest_band = serializers.FloatField(read_only=True, default=None)
    test_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'first_name', 'last_name', 'full_name',
            'phone', 'is_active', 'enrolled_at',
            'avg_band', 'latest_band', 'test_count',
        ]

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username


class StudentGroupListSerializer(serializers.ModelSerializer):
    """Guruh ro'yxati uchun (kartalarda ko'rinadigan)."""

    teacher = GroupTeacherMiniSerializer(read_only=True)
    student_count = serializers.IntegerField(read_only=True, default=0)
    avg_score = serializers.FloatField(read_only=True, default=None)
    latest_avg = serializers.FloatField(read_only=True, default=None)
    trend = serializers.CharField(read_only=True, default='insufficient_data')

    class Meta:
        model = StudentGroup
        fields = [
            'id', 'name', 'description', 'teacher',
            'target_band_score', 'class_schedule',
            'start_date', 'end_date', 'is_active',
            'student_count', 'avg_score', 'latest_avg', 'trend',
            'created_at',
        ]


class StudentGroupDetailSerializer(serializers.ModelSerializer):
    teacher = GroupTeacherMiniSerializer(read_only=True)
    student_count = serializers.IntegerField(read_only=True, default=0)
    avg_score = serializers.FloatField(read_only=True, default=None)
    latest_avg = serializers.FloatField(read_only=True, default=None)
    trend = serializers.CharField(read_only=True, default='insufficient_data')
    progress_chart = serializers.ListField(
        child=serializers.DictField(), read_only=True, default=list,
    )
    members = GroupMemberSerializer(many=True, read_only=True)

    class Meta:
        model = StudentGroup
        fields = [
            'id', 'name', 'description',
            'teacher', 'target_band_score', 'class_schedule',
            'start_date', 'end_date', 'is_active',
            'student_count', 'avg_score', 'latest_avg', 'trend',
            'progress_chart', 'members',
            'created_at', 'updated_at',
        ]


class StudentGroupWriteSerializer(serializers.ModelSerializer):
    """Yaratish/yangilash uchun."""

    teacher_id = serializers.IntegerField(required=False, allow_null=True)

    class Meta:
        model = StudentGroup
        fields = [
            'name', 'description', 'teacher_id',
            'target_band_score', 'class_schedule',
            'start_date', 'end_date', 'is_active',
        ]

    def validate_teacher_id(self, value):
        if value in (None, '', 0):
            return None
        org = self.context.get('organization')
        try:
            user = User.objects.get(id=value)
        except User.DoesNotExist:
            raise serializers.ValidationError("O'qituvchi topilmadi.")
        if user.role != 'teacher':
            raise serializers.ValidationError("Tanlangan foydalanuvchi o'qituvchi emas.")
        if org and user.organization_id != org.id:
            raise serializers.ValidationError("O'qituvchi bu markazga tegishli emas.")
        return value

    def create(self, validated_data):
        teacher_id = validated_data.pop('teacher_id', None)
        org = self.context['organization']
        return StudentGroup.objects.create(
            organization=org,
            teacher_id=teacher_id,
            **validated_data,
        )

    def update(self, instance, validated_data):
        if 'teacher_id' in validated_data:
            instance.teacher_id = validated_data.pop('teacher_id')
        for k, v in validated_data.items():
            setattr(instance, k, v)
        instance.save()
        return instance
