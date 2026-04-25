import re

from django.contrib.auth import authenticate
from rest_framework import serializers

from .models import User

PHONE_RE = re.compile(r'^\+998\d{9}$')


def _validate_phone_format(value: str) -> str:
    if not PHONE_RE.match(value or ''):
        raise serializers.ValidationError(
            'Telefon raqam +998 bilan boshlanib, 9 ta raqam bo‘lishi kerak '
            '(jami 13 ta belgi).'
        )
    return value


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = ['phone', 'password', 'first_name', 'last_name']
        # Disable DRF's default UniqueValidator (English message); we run
        # our own duplicate check in validate_phone with an Uzbek message.
        extra_kwargs = {'phone': {'validators': []}}

    def validate_phone(self, value):
        _validate_phone_format(value)
        if User.objects.filter(phone=value).exists():
            raise serializers.ValidationError(
                'Bu telefon raqam allaqachon ro‘yxatdan o‘tgan.'
            )
        return value

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class LoginSerializer(serializers.Serializer):
    phone = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate_phone(self, value):
        return _validate_phone_format(value)

    def validate(self, attrs):
        user = authenticate(phone=attrs['phone'], password=attrs['password'])
        if not user:
            raise serializers.ValidationError({'detail': 'Telefon yoki parol noto‘g‘ri'})
        if not user.is_active:
            raise serializers.ValidationError({'detail': 'Foydalanuvchi faol emas'})
        attrs['user'] = user
        return attrs


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'phone', 'first_name', 'last_name', 'role',
                  'target_band', 'language', 'created_at']
        read_only_fields = ['id', 'role', 'created_at']
