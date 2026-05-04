import secrets
import string

from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers

from apps.organizations.models import Organization, OrganizationMembership

User = get_user_model()


def generate_password(length: int = 10) -> str:
    """Tasodifiy parol — oson eslab qoladigan, lekin xavfsiz."""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))


# ────────────────────────────────────────────────────────────────────
# Students
# ────────────────────────────────────────────────────────────────────


class StudentReadSerializer(serializers.ModelSerializer):
    org_slug = serializers.SerializerMethodField()
    target_band = serializers.DecimalField(
        max_digits=3, decimal_places=1, allow_null=True, required=False,
    )
    teacher_name = serializers.SerializerMethodField()
    tests_taken = serializers.SerializerMethodField()
    last_band = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'first_name', 'last_name',
            'is_active', 'created_at',
            'org_slug', 'target_band', 'teacher_id', 'teacher_name',
            'tests_taken', 'last_band',
        ]

    def get_org_slug(self, obj):
        m = obj.org_memberships.filter(role='student').first()
        return m.organization.slug if m else (obj.organization.slug if obj.organization_id else None)

    def get_teacher_name(self, obj):
        if not obj.teacher_id:
            return None
        t = obj.teacher
        return f'{t.first_name} {t.last_name}'.strip() or t.username

    def get_tests_taken(self, obj):
        try:
            from apps.attempts.models import Attempt
            return Attempt.objects.filter(user=obj).count()
        except Exception:
            return 0

    def get_last_band(self, obj):
        return None  # ETAP 5 da to'ldiramiz


class StudentUpdateSerializer(serializers.ModelSerializer):
    """Center admini talaba ma'lumotlarini tahrirlash."""

    teacher_id = serializers.IntegerField(required=False, allow_null=True)

    class Meta:
        model = User
        fields = [
            'first_name', 'last_name', 'phone',
            'target_band', 'teacher_id',
        ]

    def validate_teacher_id(self, value):
        if value in (None, '', 0):
            return None
        try:
            t = User.objects.get(id=value, role='teacher')
        except User.DoesNotExist:
            raise serializers.ValidationError("Teacher not found.")
        # Bir xil markazga tegishli bo'lishi shart
        student = self.instance
        if student and t.organization_id != student.organization_id:
            raise serializers.ValidationError("Teacher boshqa markazdan.")
        return value

    def update(self, instance, validated_data):
        if 'teacher_id' in validated_data:
            instance.teacher_id = validated_data.pop('teacher_id')
        for k, v in validated_data.items():
            setattr(instance, k, v)
        instance.save()
        return instance


class StudentCreateSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    username = serializers.CharField(max_length=50)
    target_band = serializers.DecimalField(
        max_digits=3, decimal_places=1, required=False, allow_null=True,
    )
    teacher_id = serializers.IntegerField(required=False, allow_null=True)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    def validate_username(self, value):
        value = value.strip().lower()
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError(f"Username '{value}' allaqachon mavjud")
        return value

    def validate_teacher_id(self, value):
        if value is None:
            return value
        org = self.context['organization']
        if not User.objects.filter(
            pk=value, role='teacher', organization=org,
        ).exists():
            raise serializers.ValidationError('Teacher not found or not in this center')
        return value

    @transaction.atomic
    def create(self, validated_data):
        org = self.context['organization']
        password = validated_data.pop('password', None) or generate_password()
        teacher_id = validated_data.pop('teacher_id', None)
        target_band = validated_data.pop('target_band', None)

        user = User(
            username=validated_data['username'],
            first_name=validated_data['first_name'],
            last_name=validated_data['last_name'],
            role='student',
            is_active=True,
            organization=org,
            target_band=target_band,
            teacher_id=teacher_id,
        )
        user.set_password(password)
        user.save()

        OrganizationMembership.objects.get_or_create(
            user=user, organization=org, role='student',
        )

        user._generated_password = password
        return user


# ────────────────────────────────────────────────────────────────────
# Teachers
# ────────────────────────────────────────────────────────────────────


class TeacherReadSerializer(serializers.ModelSerializer):
    students_count = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'first_name', 'last_name',
            'is_active', 'created_at', 'students_count',
        ]

    def get_students_count(self, obj):
        return obj.students.filter(role='student').count()


class TeacherUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'phone']


class TeacherCreateSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    username = serializers.CharField(max_length=50)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    def validate_username(self, value):
        value = value.strip().lower()
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError(f"Username '{value}' allaqachon mavjud")
        return value

    @transaction.atomic
    def create(self, validated_data):
        org = self.context['organization']
        password = validated_data.pop('password', None) or generate_password()

        user = User(
            username=validated_data['username'],
            first_name=validated_data['first_name'],
            last_name=validated_data['last_name'],
            role='teacher',
            is_active=True,
            organization=org,
        )
        user.set_password(password)
        user.save()

        OrganizationMembership.objects.get_or_create(
            user=user, organization=org, role='teacher',
        )

        user._generated_password = password
        return user
