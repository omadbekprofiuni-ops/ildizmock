import random
import string

from django.conf import settings
from django.db import models


def generate_access_code() -> str:
    """`ILDIZ` + 3 ta tasodifiy raqam, model save vaqtida unique tekshiriladi."""
    return 'ILDIZ' + ''.join(random.choices(string.digits, k=3))


def generate_browser_session_id() -> str:
    return ''.join(random.choices(string.ascii_letters + string.digits, k=32))


class MockSession(models.Model):
    """Markaz admini yaratadigan sinxron mock sessiya."""

    STATUS_CHOICES = [
        ('waiting', 'Kutilmoqda'),
        ('listening', 'Listening'),
        ('reading', 'Reading'),
        ('writing', 'Writing'),
        ('finished', 'Tugagan'),
    ]

    organization = models.ForeignKey(
        'organizations.Organization',
        on_delete=models.CASCADE,
        related_name='mock_sessions',
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='created_mock_sessions',
    )

    name = models.CharField(max_length=200)
    date = models.DateField()

    listening_test = models.ForeignKey(
        'tests.Test',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='+',
        limit_choices_to={'module': 'listening'},
    )
    reading_test = models.ForeignKey(
        'tests.Test',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='+',
        limit_choices_to={'module': 'reading'},
    )
    writing_test = models.ForeignKey(
        'tests.Test',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='+',
        limit_choices_to={'module': 'writing'},
    )

    listening_duration = models.PositiveIntegerField(default=30)
    reading_duration = models.PositiveIntegerField(default=60)
    writing_duration = models.PositiveIntegerField(default=60)

    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='waiting',
    )
    section_started_at = models.DateTimeField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    access_code = models.CharField(
        max_length=16, unique=True, default=generate_access_code,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'mock_sessions'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.name} ({self.access_code}) — {self.get_status_display()}'

    @property
    def current_test(self):
        if self.status == 'listening':
            return self.listening_test
        if self.status == 'reading':
            return self.reading_test
        if self.status == 'writing':
            return self.writing_test
        return None

    @property
    def current_duration_minutes(self) -> int:
        if self.status == 'listening':
            return self.listening_duration
        if self.status == 'reading':
            return self.reading_duration
        if self.status == 'writing':
            return self.writing_duration
        return 0


class MockParticipant(models.Model):
    """Sessiyaga qo'shilgan talaba (cookie/browser bilan identifikatsiya)."""

    session = models.ForeignKey(
        MockSession, on_delete=models.CASCADE, related_name='participants',
    )
    full_name = models.CharField(max_length=200)
    browser_session_id = models.CharField(
        max_length=64, unique=True, default=generate_browser_session_id,
    )

    listening_answers = models.JSONField(default=dict, blank=True)
    reading_answers = models.JSONField(default=dict, blank=True)
    writing_task1_text = models.TextField(blank=True, default='')
    writing_task2_text = models.TextField(blank=True, default='')

    listening_score = models.DecimalField(
        max_digits=3, decimal_places=1, null=True, blank=True,
    )
    listening_correct = models.PositiveIntegerField(null=True, blank=True)
    listening_total = models.PositiveIntegerField(null=True, blank=True)
    reading_score = models.DecimalField(
        max_digits=3, decimal_places=1, null=True, blank=True,
    )
    reading_correct = models.PositiveIntegerField(null=True, blank=True)
    reading_total = models.PositiveIntegerField(null=True, blank=True)
    writing_score = models.DecimalField(
        max_digits=3, decimal_places=1, null=True, blank=True,
    )
    speaking_score = models.DecimalField(
        max_digits=3, decimal_places=1, null=True, blank=True,
    )

    listening_submitted_at = models.DateTimeField(null=True, blank=True)
    reading_submitted_at = models.DateTimeField(null=True, blank=True)
    writing_submitted_at = models.DateTimeField(null=True, blank=True)

    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'mock_participants'
        unique_together = [('session', 'full_name')]
        ordering = ['joined_at']

    def __str__(self):
        return f'{self.full_name} @ {self.session.access_code}'


class MockStateLog(models.Model):
    """Admin qachon START/NEXT bosganini audit log."""

    session = models.ForeignKey(
        MockSession, on_delete=models.CASCADE, related_name='state_logs',
    )
    action = models.CharField(max_length=40)
    triggered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
    )
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'mock_state_logs'
        ordering = ['-timestamp']

    def __str__(self):
        return f'{self.session_id}:{self.action}@{self.timestamp:%H:%M:%S}'
