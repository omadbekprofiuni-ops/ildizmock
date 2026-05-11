"""ETAP 15 — Attendance tizimi.

Center o'qituvchilari guruh talabalarining davomatini ish kunlari bo'yicha
qayd qiladi. Schedule asosida sessiyalar avtomatik yaratiladi (cron yoki
manual command), o'qituvchi har sessiyada talabalar holatini belgilaydi.

Asosiy modellar:
- ClassSchedule — guruh haftalik darslari (Mon/Wed/Fri 18:00–20:00)
- AttendanceSession — konkret kundagi dars (2026-05-05)
- AttendanceRecord — bitta talabaning shu sessiyadagi holati
"""

from datetime import datetime

from django.conf import settings
from django.db import models


class ClassSchedule(models.Model):
    """Guruhning haftalik dars jadvali."""

    DAYS_OF_WEEK = [
        (0, 'Dushanba'),
        (1, 'Seshanba'),
        (2, 'Chorshanba'),
        (3, 'Payshanba'),
        (4, 'Juma'),
        (5, 'Shanba'),
        (6, 'Yakshanba'),
    ]

    group = models.ForeignKey(
        'organizations.StudentGroup',
        on_delete=models.CASCADE,
        related_name='schedules',
    )
    day_of_week = models.IntegerField(choices=DAYS_OF_WEEK)
    start_time = models.TimeField(help_text='Format: 14:00')
    end_time = models.TimeField(help_text='Format: 16:00')
    room = models.CharField(
        max_length=50, blank=True, default='',
        help_text='e.g. Room 301, Online',
    )
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='created_schedules',
    )

    class Meta:
        db_table = 'class_schedules'
        ordering = ['day_of_week', 'start_time']
        unique_together = [('group', 'day_of_week', 'start_time')]
        verbose_name = 'Class schedule'
        verbose_name_plural = 'Class schedules'

    def __str__(self):
        day_name = dict(self.DAYS_OF_WEEK).get(self.day_of_week, '?')
        return (
            f'{self.group.name} — {day_name} '
            f'{self.start_time:%H:%M}-{self.end_time:%H:%M}'
        )

    @property
    def duration_minutes(self) -> int:
        start = datetime.combine(datetime.today(), self.start_time)
        end = datetime.combine(datetime.today(), self.end_time)
        return int((end - start).total_seconds() // 60)


class AttendanceSession(models.Model):
    """Bitta sana uchun konkret dars sessiyasi."""

    group = models.ForeignKey(
        'organizations.StudentGroup',
        on_delete=models.CASCADE,
        related_name='attendance_sessions',
    )
    schedule = models.ForeignKey(
        ClassSchedule,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='sessions',
        help_text='Which schedule it was generated from (during auto-generation)',
    )

    date = models.DateField(db_index=True)
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)

    is_finalized = models.BooleanField(
        default=False,
        help_text='Records cannot be modified after the session ends',
    )
    # ETAP 28 — 72-soatlik avtomatik lock. Manual yopish uchun ham ishlatiladi.
    locked_at = models.DateTimeField(
        null=True, blank=True,
        help_text='Set manually or 72h after session — marks become read-only',
    )
    notes = models.TextField(blank=True, default='')

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='created_attendance_sessions',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'attendance_sessions'
        ordering = ['-date', '-start_time']
        unique_together = [('group', 'date')]
        verbose_name = 'Attendance session'
        verbose_name_plural = 'Attendance sessions'

    def __str__(self):
        return f'{self.group.name} — {self.date:%d.%m.%Y}'

    # ===== Aggregations =====

    def get_attendance_rate(self) -> float:
        # ETAP 20 — faqat belgilangan (markirovkalangan) yozuvlardan foiz.
        marked = self.records.filter(status__isnull=False).count()
        if marked == 0:
            return 0.0
        present = self.records.filter(status__in=['present', 'late']).count()
        return round(present / marked * 100, 1)

    def get_count(self, status: str) -> int:
        return self.records.filter(status=status).count()

    def is_locked(self) -> bool:
        """ETAP 28 — Records faqat 72 soat ichida tahrirlanadi."""
        from django.utils import timezone

        if self.locked_at:
            return True
        if self.is_finalized:
            return True
        # Auto-lock: 72 soat o'tgach yozuvlar read-only
        if self.created_at and (
            timezone.now() - self.created_at
        ).total_seconds() > 72 * 3600:
            return True
        return False


class AttendanceRecord(models.Model):
    """Bitta talabaning shu sessiyadagi holati."""

    STATUS_CHOICES = [
        ('present', 'Keldi'),
        ('absent', 'Kelmadi'),
        ('late', 'Kechikdi'),
        ('excused', 'Sababli'),
        ('sick', 'Kasal'),
    ]

    session = models.ForeignKey(
        AttendanceSession,
        on_delete=models.CASCADE,
        related_name='records',
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='attendance_records',
        limit_choices_to={'role': 'student'},
    )

    # ETAP 20 — status nullable: yangi yaratilgan record o'qituvchi belgilamaguncha
    # "unmarked" holatda turadi (Tab 1 ko'rinishida bo'sh hujayra).
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, null=True, blank=True,
        db_index=True,
    )
    notes = models.TextField(
        blank=True, default='',
        help_text='Reason for tardiness/absence, etc.',
    )

    marked_at = models.DateTimeField(auto_now=True)
    marked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='marked_attendance_records',
    )

    # ETAP 28 — qo'shimcha audit / Telegram trackingi
    edited_count = models.PositiveSmallIntegerField(
        default=0,
        help_text="Bu yozuv necha marta o'zgartirilgan",
    )
    parent_notified = models.BooleanField(
        default=False,
        help_text='Telegram bot orqali ota-onaga xabar yuborilganmi',
    )
    parent_notified_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'attendance_records'
        ordering = ['student__first_name', 'student__last_name']
        unique_together = [('session', 'student')]
        verbose_name = 'Attendance yozuvi'
        verbose_name_plural = 'Attendance yozuvlari'

    def __str__(self):
        name = (
            f'{self.student.first_name} {self.student.last_name}'.strip()
            or self.student.username
        )
        return f'{name} — {self.session.date:%d.%m.%Y} — {self.get_status_display()}'

    @property
    def credit_percent(self) -> float:
        """ETAP 28 — Davomat foiziga shu yozuvning hissasi.

        Late = 80% (kechikdi, lekin keldi). Excused/Sick = 100% (sababli
        yo'q, jazolanmaydi). Absent = 0%.
        """
        return {
            'present': 100.0,
            'late': 80.0,
            'excused': 100.0,
            'sick': 100.0,
            'absent': 0.0,
        }.get(self.status, 0.0)


class AttendanceEscalation(models.Model):
    """ETAP 28 — Talaba 3/5/10 ta sababsiz qoldirsa avtomatik ogohlantirish.

    Tier'lar:
        warning   — 3 ta absent (markaz adminga xabar)
        reprimand — 5 ta absent (jiddiy ogohlantirish)
        removal   — 10 ta absent (guruhdan chiqarish tavsiyasi)
    """

    TIER_CHOICES = [
        ('warning', 'Warning (3 absences)'),
        ('reprimand', 'Reprimand (5 absences)'),
        ('removal', 'Removal recommended (10 absences)'),
    ]

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='attendance_escalations',
        limit_choices_to={'role': 'student'},
    )
    group = models.ForeignKey(
        'organizations.StudentGroup',
        on_delete=models.CASCADE,
        related_name='attendance_escalations',
    )
    tier = models.CharField(max_length=16, choices=TIER_CHOICES)
    absence_count = models.PositiveSmallIntegerField(
        help_text='Triggered count (3, 5 yoki 10)',
    )
    triggered_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='attendance_escalations_resolved',
    )
    resolution_note = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'attendance_escalations'
        ordering = ['-triggered_at']
        indexes = [
            models.Index(fields=['student', 'tier', 'resolved_at']),
        ]
        verbose_name = 'Attendance escalation'
        verbose_name_plural = 'Attendance escalations'

    def __str__(self):
        return f'{self.student_id} — {self.tier} ({self.absence_count} absences)'


class TelegramBinding(models.Model):
    """ETAP 28 — Ota-onaning Telegram chat_id'sini talabaga bog'laydi.

    Bir talabaga bir nechta ota-ona (chat_id) bog'lanishi mumkin.
    Bot keyingi etapda integratsiya qilinadi, lekin schema tayyor bo'lsin.
    """

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='telegram_bindings',
        limit_choices_to={'role': 'student'},
    )
    chat_id = models.CharField(
        max_length=32,
        help_text='Telegram chat ID (bot orqali olinadi)',
    )
    parent_name = models.CharField(max_length=100, blank=True, default='')
    is_active = models.BooleanField(default=True)
    bound_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'attendance_telegram_bindings'
        unique_together = [('student', 'chat_id')]
        indexes = [models.Index(fields=['chat_id'])]
        verbose_name = 'Telegram binding'
        verbose_name_plural = 'Telegram bindings'

    def __str__(self):
        return f'{self.student_id} ↔ {self.chat_id}'
