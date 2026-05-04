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
        total = self.records.count()
        if total == 0:
            return 0.0
        present = self.records.filter(status__in=['present', 'late']).count()
        return round(present / total * 100, 1)

    def get_count(self, status: str) -> int:
        return self.records.filter(status=status).count()


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

    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='present',
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
