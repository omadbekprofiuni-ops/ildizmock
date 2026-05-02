from rest_framework import serializers

from .models import AttendanceRecord, AttendanceSession, ClassSchedule


# ───────────── Schedule ─────────────


class ClassScheduleSerializer(serializers.ModelSerializer):
    day_name = serializers.CharField(source='get_day_of_week_display', read_only=True)
    duration_minutes = serializers.IntegerField(read_only=True)

    class Meta:
        model = ClassSchedule
        fields = [
            'id', 'group', 'day_of_week', 'day_name',
            'start_time', 'end_time', 'duration_minutes',
            'room', 'is_active', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def validate(self, attrs):
        start = attrs.get('start_time') or getattr(self.instance, 'start_time', None)
        end = attrs.get('end_time') or getattr(self.instance, 'end_time', None)
        if start and end and end <= start:
            raise serializers.ValidationError(
                'Tugash vaqti boshlanish vaqtidan kech bo\'lishi kerak.',
            )
        return attrs


# ───────────── Records ─────────────


class AttendanceRecordReadSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    student_username = serializers.CharField(source='student.username', read_only=True)
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    marked_by_name = serializers.SerializerMethodField()

    class Meta:
        model = AttendanceRecord
        fields = [
            'id', 'student', 'student_name', 'student_username',
            'status', 'status_label', 'notes',
            'marked_at', 'marked_by_name',
        ]

    def get_student_name(self, obj):
        return (
            f'{obj.student.first_name} {obj.student.last_name}'.strip()
            or obj.student.username
        )

    def get_marked_by_name(self, obj):
        if not obj.marked_by_id:
            return None
        u = obj.marked_by
        return f'{u.first_name} {u.last_name}'.strip() or u.username


class _RecordPatchItemSerializer(serializers.Serializer):
    record_id = serializers.IntegerField()
    status = serializers.ChoiceField(choices=AttendanceRecord.STATUS_CHOICES)
    notes = serializers.CharField(allow_blank=True, required=False, default='')


class BulkMarkSerializer(serializers.Serializer):
    """POST body: {records: [{record_id, status, notes?}, ...]}"""

    records = _RecordPatchItemSerializer(many=True)


# ───────────── Sessions ─────────────


class AttendanceSessionListSerializer(serializers.ModelSerializer):
    group_name = serializers.CharField(source='group.name', read_only=True)
    attendance_rate = serializers.SerializerMethodField()
    present_count = serializers.SerializerMethodField()
    absent_count = serializers.SerializerMethodField()
    total_count = serializers.SerializerMethodField()

    class Meta:
        model = AttendanceSession
        fields = [
            'id', 'group', 'group_name', 'date',
            'start_time', 'end_time', 'is_finalized',
            'attendance_rate', 'present_count', 'absent_count', 'total_count',
        ]

    def get_attendance_rate(self, obj):
        return obj.get_attendance_rate()

    def get_present_count(self, obj):
        return obj.get_count('present') + obj.get_count('late')

    def get_absent_count(self, obj):
        return obj.get_count('absent')

    def get_total_count(self, obj):
        return obj.records.count()


class AttendanceSessionDetailSerializer(AttendanceSessionListSerializer):
    records = AttendanceRecordReadSerializer(many=True, read_only=True)
    notes = serializers.CharField(read_only=True)
    schedule = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta(AttendanceSessionListSerializer.Meta):
        fields = AttendanceSessionListSerializer.Meta.fields + [
            'notes', 'schedule', 'records',
        ]


class AttendanceSessionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = AttendanceSession
        fields = ['group', 'date', 'start_time', 'end_time', 'notes']
