from rest_framework import serializers

from .models import Organization, Payment, Plan


class PlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plan
        fields = [
            'id', 'code', 'name', 'max_students', 'max_teachers',
            'duration_days', 'price_usd', 'features',
        ]


class OrganizationListSerializer(serializers.ModelSerializer):
    plan_code = serializers.CharField(source='plan.code', read_only=True)
    plan_name = serializers.CharField(source='plan.name', read_only=True)
    students_count = serializers.IntegerField(read_only=True)
    teachers_count = serializers.IntegerField(read_only=True)
    days_remaining = serializers.IntegerField(read_only=True)
    max_students = serializers.IntegerField(source='plan.max_students', read_only=True)

    class Meta:
        model = Organization
        fields = [
            'id', 'name', 'slug', 'primary_color', 'logo',
            'plan', 'plan_code', 'plan_name', 'status',
            'plan_starts_at', 'plan_expires_at',
            'students_count', 'teachers_count', 'max_students',
            'days_remaining', 'created_at',
        ]


class OrganizationDetailSerializer(OrganizationListSerializer):
    class Meta(OrganizationListSerializer.Meta):
        fields = OrganizationListSerializer.Meta.fields + [
            'contact_phone', 'contact_email', 'address',
        ]


class OrganizationCreateSerializer(serializers.ModelSerializer):
    """Markaz yaratishda admin user'ni ham yaratadi."""

    admin_phone = serializers.CharField(write_only=True)
    admin_first_name = serializers.CharField(write_only=True)
    admin_last_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    admin_password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = Organization
        fields = [
            'name', 'slug', 'primary_color',
            'contact_phone', 'contact_email', 'address',
            'plan',
            'admin_phone', 'admin_first_name', 'admin_last_name', 'admin_password',
        ]


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
    """Talaba markaz sahifasiga kirsa — brand info."""

    class Meta:
        model = Organization
        fields = ['name', 'slug', 'primary_color', 'logo']
