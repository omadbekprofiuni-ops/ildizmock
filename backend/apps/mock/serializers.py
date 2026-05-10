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
            'listening_pdf_test', 'reading_pdf_test',
            'allow_late_join', 'allow_guests', 'link_expires_at',
            'is_archived', 'archived_at',
        ]


class MockSessionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = MockSession
        fields = [
            'name', 'date',
            'listening_test', 'reading_test', 'writing_test', 'speaking_test',
            'listening_pdf_test', 'reading_pdf_test',
            'listening_duration', 'reading_duration', 'writing_duration',
            'speaking_duration',
            'allow_late_join', 'allow_guests', 'link_expires_at',
        ]

    def to_internal_value(self, data):
        """Frontend `listening_test`/`reading_test`'ga oddiy UUID yoki
        `pdf:<public_id>` shaklidagi prefiksli stringni yuborishi mumkin.
        Prefiksli bo'lsa — uni `<sec>_pdf_test` maydoniga ko'chiramiz va
        oddiy `<sec>_test`'ni nullify qilamiz (mutual exclusion).
        """
        # QueryDict immutable bo'lishi mumkin — copy qilib mutate qilamiz
        if hasattr(data, 'copy'):
            data = data.copy()
        else:
            data = dict(data)

        for sec in ('listening', 'reading'):
            val = data.get(f'{sec}_test')
            if not isinstance(val, str) or not val.startswith('pdf:'):
                continue
            public_id = val[len('pdf:'):]
            try:
                pdf_test = PDFTest.objects.get(public_id=public_id)
            except (PDFTest.DoesNotExist, ValueError):
                raise serializers.ValidationError({
                    f'{sec}_test': 'PDF test topilmadi yoki noto‘g‘ri ID.',
                })
            if pdf_test.module != sec:
                raise serializers.ValidationError({
                    f'{sec}_test': f'Bu PDF test {sec} moduliga tegishli emas.',
                })
            data[f'{sec}_pdf_test'] = pdf_test.pk
            data[f'{sec}_test'] = None
        return super().to_internal_value(data)

    def validate(self, attrs):
        org = self.context['organization']
        for field in ('listening_test', 'reading_test', 'writing_test', 'speaking_test'):
            test = attrs.get(field)
            if not test:
                continue
            # Markazning o'z testi yoki published global test bo'lishi kerak
            is_own = test.organization_id == org.id
            is_global = test.organization_id is None and test.is_global
            if not (is_own or is_global):
                raise serializers.ValidationError({
                    field: 'Bu test sizning markazingizga tegishli emas.',
                })
        for field in ('listening_pdf_test', 'reading_pdf_test'):
            pdf_test = attrs.get(field)
            if not pdf_test:
                continue
            if pdf_test.organization_id != org.id:
                raise serializers.ValidationError({
                    field: 'Bu PDF test sizning markazingizga tegishli emas.',
                })
        # Bir modulga ham regular ham PDF biriktirish — taqiqlangan
        for sec in ('listening', 'reading'):
            if attrs.get(f'{sec}_test') and attrs.get(f'{sec}_pdf_test'):
                raise serializers.ValidationError({
                    f'{sec}_test': (
                        f'{sec.capitalize()} uchun bir vaqtning o‘zida ham '
                        'oddiy test, ham PDF test biriktirib bo‘lmaydi.'
                    ),
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
    listening_pdf_test = PDFTestPickSerializer(read_only=True)
    reading_pdf_test = PDFTestPickSerializer(read_only=True)

    class Meta:
        model = MockSession
        fields = [
            'id', 'name', 'date', 'status', 'access_code',
            'created_at', 'started_at', 'finished_at', 'section_started_at',
            'listening_test', 'reading_test', 'writing_test', 'speaking_test',
            'listening_pdf_test', 'reading_pdf_test',
            'listening_duration', 'reading_duration', 'writing_duration',
            'speaking_duration',
            'allow_late_join', 'allow_guests', 'link_expires_at',
            'participants',
        ]


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
