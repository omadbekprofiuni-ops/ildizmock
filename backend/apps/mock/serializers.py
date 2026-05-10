from rest_framework import serializers

from apps.tests.models import PDFTest, Test

from .models import MockParticipant, MockSession


class TestPickSerializer(serializers.ModelSerializer):
    class Meta:
        model = Test
        fields = ['id', 'name', 'module', 'difficulty', 'category']


class PDFTestPickSerializer(serializers.ModelSerializer):
    """MockSession detail/list payloadlari uchun — id sifatida `pdf:<public_id>`."""

    id = serializers.SerializerMethodField()
    category = serializers.SerializerMethodField()

    class Meta:
        model = PDFTest
        fields = ['id', 'name', 'module', 'difficulty', 'category']

    def get_id(self, obj):
        return f'pdf:{obj.public_id}'

    def get_category(self, obj):
        return ''


class MockSessionListSerializer(serializers.ModelSerializer):
    participants_count = serializers.IntegerField(
        source='participants.count', read_only=True,
    )

    class Meta:
        model = MockSession
        fields = [
            'id', 'name', 'date', 'status', 'access_code',
            'created_at', 'participants_count',
            'listening_test', 'reading_test', 'writing_test', 'speaking_test',
            'allow_late_join', 'allow_guests', 'link_expires_at',
            'is_archived', 'archived_at',
        ]


class MockSessionCreateSerializer(serializers.ModelSerializer):
    active_skills = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = MockSession
        fields = [
            'name', 'date',
            'listening_test', 'reading_test', 'writing_test', 'speaking_test',
            'listening_duration', 'reading_duration', 'writing_duration',
            'speaking_duration',
            'allow_late_join', 'allow_guests', 'link_expires_at',
            'active_skills',
        ]
        read_only_fields = ['active_skills']

    def get_active_skills(self, obj):
        return obj.get_active_skills() if hasattr(obj, 'get_active_skills') else []

    def validate(self, attrs):
        # HOTFIX — kamida 1 ta skill biriktirilgan bo'lishi shart.
        any_skill = any([
            attrs.get('listening_test'),
            attrs.get('reading_test'),
            attrs.get('writing_test'),
            attrs.get('speaking_test'),
        ])
        if not any_skill:
            raise serializers.ValidationError(
                'At least one skill must have a test assigned '
                '(Listening, Reading, Writing, or Speaking).',
            )

        # Modul mosligi va organizatsiya egaligi
        org = self.context['organization']
        type_pairs = [
            ('listening_test', 'listening'),
            ('reading_test', 'reading'),
            ('writing_test', 'writing'),
            ('speaking_test', 'speaking'),
        ]
        for field, expected_module in type_pairs:
            test = attrs.get(field)
            if not test:
                continue
            if test.module != expected_module:
                raise serializers.ValidationError({
                    field: (
                        f'This test is module "{test.module}", '
                        f'expected "{expected_module}".'
                    ),
                })
            is_own = test.organization_id == org.id
            is_global = test.organization_id is None or test.is_global
            if not (is_own or is_global):
                raise serializers.ValidationError({
                    field: 'This test does not belong to your center.',
                })
        return attrs


class MockParticipantListSerializer(serializers.ModelSerializer):
    is_guest = serializers.BooleanField(read_only=True)
    user_id = serializers.IntegerField(source='user.id', read_only=True, allow_null=True)
    certificate = serializers.SerializerMethodField()

    class Meta:
        model = MockParticipant
        fields = [
            'id', 'full_name', 'joined_at',
            'has_joined', 'claimed_at', 'is_guest', 'user_id',
            'listening_score', 'reading_score', 'writing_score',
            'speaking_score', 'overall_band_score',
            'writing_status', 'speaking_status',
            'listening_submitted_at', 'reading_submitted_at', 'writing_submitted_at',
            'certificate',
        ]

    def get_certificate(self, obj):
        cert = getattr(obj, 'certificate', None)
        if cert is None:
            return None
        return {
            'id': cert.id,
            'certificate_number': cert.certificate_number,
            'is_revoked': cert.is_revoked,
            'issue_date': cert.issue_date.isoformat(),
            'verification_code': cert.verification_code,
        }


class MockSessionDetailSerializer(serializers.ModelSerializer):
    participants = MockParticipantListSerializer(many=True, read_only=True)
    listening_test = TestPickSerializer(read_only=True)
    reading_test = TestPickSerializer(read_only=True)
    writing_test = TestPickSerializer(read_only=True)
    speaking_test = TestPickSerializer(read_only=True)
    active_skills = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = MockSession
        fields = [
            'id', 'name', 'date', 'status', 'access_code',
            'created_at', 'started_at', 'finished_at', 'section_started_at',
            'listening_test', 'reading_test', 'writing_test', 'speaking_test',
            'listening_duration', 'reading_duration', 'writing_duration',
            'speaking_duration',
            'allow_late_join', 'allow_guests', 'link_expires_at',
            'participants', 'active_skills',
        ]

    def get_active_skills(self, obj):
        return obj.get_active_skills()


# --- Student-facing serializers ----------------------------------------------

class PublicSessionSerializer(serializers.ModelSerializer):
    """Student `/join/<code>/` ga kirganda ko'radigan minimal info."""

    participants_count = serializers.IntegerField(
        source='participants.count', read_only=True,
    )
    join_allowed = serializers.SerializerMethodField()

    class Meta:
        model = MockSession
        fields = [
            'id', 'name', 'date', 'status', 'access_code',
            'participants_count',
            'allow_late_join', 'allow_guests', 'link_expires_at',
            'join_allowed',
        ]

    def get_join_allowed(self, obj):
        return obj.is_join_allowed()


class PublicParticipantSerializer(serializers.ModelSerializer):
    """ETAP 19 — Public participant ro'yxati (ism tanlash uchun)."""

    is_guest = serializers.BooleanField(read_only=True)

    class Meta:
        model = MockParticipant
        fields = ['id', 'full_name', 'joined_at', 'has_joined', 'is_guest']
