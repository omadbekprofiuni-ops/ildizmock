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
            'listening_test', 'reading_test', 'writing_test',
        ]


class MockSessionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = MockSession
        fields = [
            'name', 'date',
            'listening_test', 'reading_test', 'writing_test',
            'listening_duration', 'reading_duration', 'writing_duration',
        ]

    def validate(self, attrs):
        org = self.context['organization']
        for field in ('listening_test', 'reading_test', 'writing_test'):
            test = attrs.get(field)
            if test and test.organization_id != org.id:
                raise serializers.ValidationError({
                    field: 'Bu test sizning markazingizga tegishli emas.',
                })
        return attrs


class MockParticipantListSerializer(serializers.ModelSerializer):
    class Meta:
        model = MockParticipant
        fields = [
            'id', 'full_name', 'joined_at',
            'listening_score', 'reading_score', 'writing_score',
            'speaking_score', 'overall_band_score',
            'writing_status', 'speaking_status',
            'listening_submitted_at', 'reading_submitted_at', 'writing_submitted_at',
        ]


class MockSessionDetailSerializer(serializers.ModelSerializer):
    participants = MockParticipantListSerializer(many=True, read_only=True)
    listening_test = TestPickSerializer(read_only=True)
    reading_test = TestPickSerializer(read_only=True)
    writing_test = TestPickSerializer(read_only=True)

    class Meta:
        model = MockSession
        fields = [
            'id', 'name', 'date', 'status', 'access_code',
            'created_at', 'started_at', 'finished_at', 'section_started_at',
            'listening_test', 'reading_test', 'writing_test',
            'listening_duration', 'reading_duration', 'writing_duration',
            'participants',
        ]


# --- Student-facing serializers ----------------------------------------------

class PublicSessionSerializer(serializers.ModelSerializer):
    """Talaba `/join/<code>/` ga kirganda ko'radigan minimal info."""

    participants_count = serializers.IntegerField(
        source='participants.count', read_only=True,
    )

    class Meta:
        model = MockSession
        fields = [
            'id', 'name', 'date', 'status', 'access_code',
            'participants_count',
        ]


class PublicParticipantSerializer(serializers.ModelSerializer):
    class Meta:
        model = MockParticipant
        fields = ['id', 'full_name', 'joined_at']
