import re

from django.contrib.auth import get_user_model, password_validation
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import B2CProfile

User = get_user_model()

# Username slot: emaildan derive qilamiz — local part + suffix, faqat
# [a-z0-9_]; collision bo'lsa raqam qo'shamiz.
_USERNAME_CLEAN_RE = re.compile(r'[^a-z0-9_]')


def _username_from_email(email: str) -> str:
    local = email.split('@', 1)[0].lower()
    base = _USERNAME_CLEAN_RE.sub('_', local) or 'user'
    base = base[:40]  # username field 50 char limit, suffix uchun joy qoldiramiz
    candidate = base
    suffix = 1
    while User.objects.filter(username=candidate).exists():
        suffix += 1
        candidate = f'{base}_{suffix}'
    return candidate


class B2CSignupSerializer(serializers.Serializer):
    # Ism va familiya ixtiyoriy — keyin profilda to'ldirsa bo'ladi.
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=6)
    password_confirm = serializers.CharField(
        write_only=True, min_length=6, required=False, allow_blank=True,
    )

    def validate_email(self, value: str) -> str:
        normalized = value.lower().strip()
        if User.objects.filter(email__iexact=normalized).exists():
            raise serializers.ValidationError(
                "Bu email allaqachon ro'yxatdan o'tgan.",
            )
        return normalized

    def validate(self, attrs):
        p1 = attrs.get('password')
        p2 = attrs.get('password_confirm')
        # password_confirm taqdim etilgan bo'lsa, mos kelishi shart.
        if p2 and p1 != p2:
            raise serializers.ValidationError(
                {'password_confirm': 'Parollar mos kelmadi.'},
            )
        try:
            password_validation.validate_password(p1)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({'password': list(exc.messages)})
        return attrs

    def create(self, validated_data):
        email = validated_data['email']
        user = User(
            username=_username_from_email(email),
            email=email,
            first_name=(validated_data.get('first_name') or '').strip(),
            last_name=(validated_data.get('last_name') or '').strip(),
            role='b2c_user',
        )
        user.set_password(validated_data['password'])
        user.save()
        B2CProfile.objects.create(user=user, signup_source='email')
        return user


class B2CLoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        email = (attrs.get('email') or '').lower().strip()
        password = attrs.get('password') or ''
        # Iexact bilan qidiramiz (Django default exact case-sensitive).
        user = User.objects.filter(email__iexact=email).first()
        if not user or not user.check_password(password):
            raise serializers.ValidationError(
                {'detail': "Email yoki parol noto'g'ri."},
            )
        if not user.is_active:
            raise serializers.ValidationError(
                {'detail': 'Akkaunt deaktivlashtirilgan.'},
            )
        if user.role != 'b2c_user':
            # B2B foydalanuvchi B2C login orqali kira olmaydi.
            raise serializers.ValidationError(
                {'detail': "Bu kirish faqat individual foydalanuvchilar uchun. "
                           "O'quv markaz logini orqali kiring."},
            )
        attrs['user'] = user
        return attrs


class B2CGoogleAuthSerializer(serializers.Serializer):
    """Google Identity Services'dan kelgan ID tokenni qabul qiladi.

    Frontend Google "Sign in with Google" tugmasini bossadi → Google brauzer'da
    ID token qaytaradi (JWT) → frontend uni shu endpoint'ga POST qiladi.
    Bekend `google.oauth2.id_token.verify_oauth2_token` orqali tokenni
    Google'ning umumiy kalitlari bilan tekshiradi va email/sub/name'ni oladi.
    """
    id_token = serializers.CharField()

    def validate_id_token(self, value):
        from django.conf import settings
        client_id = settings.GOOGLE_OAUTH_CLIENT_ID
        if not client_id:
            raise serializers.ValidationError(
                'Google OAuth sozlanmagan (GOOGLE_OAUTH_CLIENT_ID).',
            )
        try:
            from google.auth.transport import requests as google_requests
            from google.oauth2 import id_token as google_id_token
        except ImportError as exc:  # pragma: no cover
            raise serializers.ValidationError(
                f'google-auth library mavjud emas: {exc}',
            )
        try:
            payload = google_id_token.verify_oauth2_token(
                value, google_requests.Request(), client_id,
            )
        except ValueError as exc:
            raise serializers.ValidationError(
                f"Google ID token noto'g'ri: {exc}",
            )
        if not payload.get('email_verified'):
            raise serializers.ValidationError(
                'Google email tasdiqlanmagan.',
            )
        return payload

    def save(self):
        payload = self.validated_data['id_token']  # parsed dict
        email = (payload.get('email') or '').lower().strip()
        if not email:
            raise serializers.ValidationError(
                'Google javobida email yo\'q.',
            )
        first_name = payload.get('given_name') or ''
        last_name = payload.get('family_name') or ''
        user = User.objects.filter(email__iexact=email).first()
        if user is None:
            user = User(
                username=_username_from_email(email),
                email=email,
                first_name=first_name,
                last_name=last_name,
                role='b2c_user',
            )
            user.set_unusable_password()
            user.save()
            B2CProfile.objects.create(user=user, signup_source='google')
        else:
            if user.role != 'b2c_user':
                raise serializers.ValidationError(
                    'Bu email allaqachon B2B akkaunt sifatida ro\'yxatda.',
                )
            # Profile bo'lmasa yaratamiz (data migration safety)
            B2CProfile.objects.get_or_create(
                user=user, defaults={'signup_source': 'google'},
            )
        return user


class B2CUserSerializer(serializers.ModelSerializer):
    """B2C user uchun /me javobi — profil ma'lumotlari bilan birga."""
    phone_number = serializers.CharField(
        source='b2c_profile.phone_number', read_only=True,
    )
    preferred_language = serializers.CharField(
        source='b2c_profile.preferred_language', read_only=True,
    )
    target_exam = serializers.CharField(
        source='b2c_profile.target_exam', read_only=True,
    )
    target_band = serializers.DecimalField(
        source='b2c_profile.target_band', max_digits=3, decimal_places=1,
        read_only=True,
    )
    exam_date = serializers.DateField(
        source='b2c_profile.exam_date', read_only=True,
    )
    weekly_goal_sessions = serializers.IntegerField(
        source='b2c_profile.weekly_goal_sessions', read_only=True,
    )
    has_completed_onboarding = serializers.BooleanField(
        source='b2c_profile.has_completed_onboarding', read_only=True,
    )
    signup_source = serializers.CharField(
        source='b2c_profile.signup_source', read_only=True,
    )

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name', 'role',
            'phone_number', 'preferred_language',
            'target_exam', 'target_band', 'exam_date', 'weekly_goal_sessions',
            'has_completed_onboarding', 'signup_source', 'created_at',
        ]
        read_only_fields = fields


class B2CProfileUpdateSerializer(serializers.Serializer):
    """Profilni tahrirlash — User va B2CProfile fieldlari aralash."""
    first_name = serializers.CharField(max_length=150, required=False)
    last_name = serializers.CharField(max_length=150, required=False)
    phone_number = serializers.CharField(
        max_length=20, allow_blank=True, required=False,
    )
    preferred_language = serializers.ChoiceField(
        choices=B2CProfile.LANGUAGE_CHOICES, required=False,
    )
    target_exam = serializers.CharField(
        max_length=50, allow_blank=True, required=False,
    )
    target_band = serializers.DecimalField(
        max_digits=3, decimal_places=1, required=False, allow_null=True,
    )
    exam_date = serializers.DateField(required=False, allow_null=True)
    weekly_goal_sessions = serializers.IntegerField(
        required=False, min_value=1, max_value=14,
    )
    has_completed_onboarding = serializers.BooleanField(required=False)

    def update(self, instance: 'User', validated_data):  # type: ignore[name-defined]
        # `instance` — User. Yangilashda User va B2CProfile alohida saqlanadi.
        user_fields = ('first_name', 'last_name')
        profile_fields = (
            'phone_number', 'preferred_language', 'target_exam',
            'target_band', 'exam_date', 'weekly_goal_sessions',
            'has_completed_onboarding',
        )
        user_dirty = []
        for f in user_fields:
            if f in validated_data:
                setattr(instance, f, validated_data[f].strip()
                        if isinstance(validated_data[f], str) else validated_data[f])
                user_dirty.append(f)
        if user_dirty:
            instance.save(update_fields=user_dirty)

        profile = instance.b2c_profile
        profile_dirty = []
        for f in profile_fields:
            if f in validated_data:
                setattr(profile, f, validated_data[f])
                profile_dirty.append(f)
        if profile_dirty:
            profile_dirty.append('updated_at')
            profile.save(update_fields=profile_dirty)
        return instance
