import re

from rest_framework import serializers

from .models import User

USERNAME_RE = re.compile(r'^[a-z0-9_]{2,50}$')
PHONE_RE = re.compile(r'^\+998\d{9}$')


def _validate_username_format(value: str) -> str:
    """Lowercase letters, digits, underscore. 2–50 chars."""
    if not USERNAME_RE.match((value or '').lower()):
        raise serializers.ValidationError(
            'Username must be 2–50 lowercase letters, digits, or underscore.'
        )
    return value.lower()


def _validate_phone_format(value: str) -> str:
    """Optional phone field validator."""
    if not PHONE_RE.match(value or ''):
        raise serializers.ValidationError(
            'Phone must start with +998 and contain 9 digits (13 total).'
        )
    return value


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        username = (attrs.get('username') or '').lower().strip()
        password = attrs.get('password') or ''

        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            raise serializers.ValidationError(
                {'detail': "Login yoki parol noto'g'ri"},
            )

        if not user.check_password(password):
            raise serializers.ValidationError(
                {'detail': "Login yoki parol noto'g'ri"},
            )

        # Parol to'g'ri, lekin akkaunt o'chirilgan/bloklangan
        if not user.is_active:
            raise serializers.ValidationError(
                {
                    'detail': (
                        "Akkauntingiz markaz administratori tomonidan "
                        "vaqtincha o'chirib qo'yilgan. Markazga murojaat qiling."
                    ),
                },
            )

        attrs['user'] = user
        return attrs


class UserSerializer(serializers.ModelSerializer):
    org_slug = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'phone', 'first_name', 'last_name', 'role',
                  'target_band', 'language', 'must_change_password', 'created_at',
                  'org_slug']
        read_only_fields = ['id', 'username', 'role', 'created_at',
                            'must_change_password', 'org_slug']

    def get_org_slug(self, obj):
        return obj.organization.slug if obj.organization_id else None
