from rest_framework import serializers

from .models import Organization, Payment, Plan


class PlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plan
        fields = [
            'id', 'code', 'name', 'max_students', 'max_teachers',
            'duration_days', 'price_usd', 'features',
        ]


RESERVED_SLUGS = {
    'super', 'admin', 'login', 'register', 'logout', 'api',
    'static', 'media', 'tests', 'auth', 'public', 'home',
    'dashboard', 'profile', 'history', 'teacher',
}


def _validate_slug(value: str) -> str:
    value = (value or '').lower().strip()
    if value in RESERVED_SLUGS:
        raise serializers.ValidationError(f"'{value}' is reserved")
    return value


class OrganizationListSerializer(serializers.ModelSerializer):
    plan_code = serializers.CharField(source='plan.code', read_only=True)
    plan_name = serializers.CharField(source='plan.name', read_only=True)
    students_count = serializers.IntegerField(read_only=True)
    teachers_count = serializers.IntegerField(read_only=True)
    admins_count = serializers.IntegerField(read_only=True)
    days_remaining = serializers.IntegerField(read_only=True)
    max_students = serializers.IntegerField(source='plan.max_students', read_only=True)
    operational_status = serializers.CharField(read_only=True)
    is_deleted = serializers.BooleanField(read_only=True)

    class Meta:
        model = Organization
        fields = [
            'id', 'name', 'slug', 'primary_color', 'logo',
            'plan', 'plan_code', 'plan_name', 'status',
            'plan_starts_at', 'plan_expires_at',
            'students_count', 'teachers_count', 'admins_count', 'max_students',
            'days_remaining', 'created_at',
            # ETAP 19
            'is_suspended', 'is_deleted', 'operational_status',
            'suspended_at', 'suspended_reason',
        ]


class OrganizationDetailSerializer(OrganizationListSerializer):
    class Meta(OrganizationListSerializer.Meta):
        fields = OrganizationListSerializer.Meta.fields + [
            'contact_phone', 'contact_email', 'address', 'notes',
        ]


class OrganizationCreateSerializer(serializers.ModelSerializer):
    """Creates the center together with its admin user."""

    admin_username = serializers.CharField(write_only=True)
    admin_first_name = serializers.CharField(write_only=True)
    admin_last_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    admin_password = serializers.CharField(write_only=True, min_length=4)
    plan = serializers.PrimaryKeyRelatedField(
        queryset=Plan.objects.all(), required=False, allow_null=True,
    )

    class Meta:
        model = Organization
        fields = [
            'name', 'slug', 'primary_color',
            'contact_phone', 'contact_email', 'address', 'notes',
            'plan',
            'admin_username', 'admin_first_name', 'admin_last_name', 'admin_password',
        ]

    def validate_slug(self, value):
        value = _validate_slug(value)
        if Organization.objects.filter(slug=value).exists():
            raise serializers.ValidationError('Slug already exists')
        return value


class CenterAdminCreateSerializer(serializers.Serializer):
    """SuperAdmin adds an additional admin to an existing center."""

    username = serializers.CharField()
    password = serializers.CharField(min_length=4)
    first_name = serializers.CharField()
    last_name = serializers.CharField(required=False, allow_blank=True)


class PaymentSerializer(serializers.ModelSerializer):
    organization_name = serializers.CharField(source='organization.name', read_only=True)
    plan_name = serializers.CharField(source='plan.name', read_only=True)
    plan_code = serializers.CharField(source='plan.code', read_only=True)

    class Meta:
        model = Payment
        fields = [
            'id', 'organization', 'organization_name', 'plan', 'plan_code', 'plan_name',
            'amount_usd', 'status', 'notes', 'created_at', 'paid_at',
        ]


class PublicOrgSerializer(serializers.ModelSerializer):
    """Student markaz sahifasiga kirsa — brand info."""

    class Meta:
        model = Organization
        fields = ['name', 'slug', 'primary_color', 'logo']
