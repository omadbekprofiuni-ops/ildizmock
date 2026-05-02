from rest_framework import serializers

from apps.tests.models import Test

from .models import MockParticipant, MockSession


class TestPickSerializer(serializers.ModelSerializer):
    class Meta:
        model = Test
        fields = ['id', 'name', 'module', 'difficulty', 'category']


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
        ]


class MockSessionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = MockSession
        fields = [
            'name', 'date',
            'listening_test', 'reading_test', 'writing_test', 'speaking_test',
            'listening_duration', 'reading_duration', 'writing_duration',
            'speaking_duration',
            'allow_late_join', 'allow_guests', 'link_expires_at',
        ]

    def validate(self, attrs):
        org = self.context['organization']
        for field in ('listening_test', 'reading_test', 'writing_test', 'speaking_test'):
            test = attrs.get(field)
            if test and test.organization_id != org.id:
                raise serializers.ValidationError({
                    field: 'Bu test sizning markazingizga tegishli emas.',
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

    class Meta:
        model = MockSession
        fields = [
            'id', 'name', 'date', 'status', 'access_code',
            'created_at', 'started_at', 'finished_at', 'section_started_at',
            'listening_test', 'reading_test', 'writing_test', 'speaking_test',
            'listening_duration', 'reading_duration', 'writing_duration',
            'speaking_duration',
            'allow_late_join', 'allow_guests', 'link_expires_at',
            'participants',
        ]


# --- Student-facing serializers ----------------------------------------------

class PublicSessionSerializer(serializers.ModelSerializer):
    """Talaba `/join/<code>/` ga kirganda ko'radigan minimal info."""

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
