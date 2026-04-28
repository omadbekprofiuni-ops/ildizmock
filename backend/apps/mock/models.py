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
        ('cancelled', 'Bekor qilingan'),
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
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        related_name='mock_participations',
        on_delete=models.SET_NULL,
        help_text='Login qilingan talaba bo\'lsa unga link',
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

    # ETAP — Speaking kriteriyalari (4 ta IELTS criteria)
    speaking_fluency = models.DecimalField(
        max_digits=3, decimal_places=1, null=True, blank=True,
        help_text='Fluency and Coherence (0–9)',
    )
    speaking_lexical = models.DecimalField(
        max_digits=3, decimal_places=1, null=True, blank=True,
        help_text='Lexical Resource (0–9)',
    )
    speaking_grammar = models.DecimalField(
        max_digits=3, decimal_places=1, null=True, blank=True,
        help_text='Grammatical Range and Accuracy (0–9)',
    )
    speaking_pronunciation = models.DecimalField(
        max_digits=3, decimal_places=1, null=True, blank=True,
        help_text='Pronunciation (0–9)',
    )

    listening_submitted_at = models.DateTimeField(null=True, blank=True)
    reading_submitted_at = models.DateTimeField(null=True, blank=True)
    writing_submitted_at = models.DateTimeField(null=True, blank=True)

    joined_at = models.DateTimeField(auto_now_add=True)

    # ===== ETAP 4: Writing kriteriyalari =====
    SCORE_KW = dict(max_digits=3, decimal_places=1, null=True, blank=True)

    writing_task1_task_achievement = models.DecimalField(
        max_digits=3, decimal_places=1, null=True, blank=True,
        help_text='Task 1: Task Achievement (0–9)',
    )
    writing_task1_coherence = models.DecimalField(
        max_digits=3, decimal_places=1, null=True, blank=True,
        help_text='Task 1: Coherence and Cohesion (0–9)',
    )
    writing_task1_lexical = models.DecimalField(
        max_digits=3, decimal_places=1, null=True, blank=True,
        help_text='Task 1: Lexical Resource (0–9)',
    )
    writing_task1_grammar = models.DecimalField(
        max_digits=3, decimal_places=1, null=True, blank=True,
        help_text='Task 1: Grammatical Range and Accuracy (0–9)',
    )
    writing_task2_task_response = models.DecimalField(
        max_digits=3, decimal_places=1, null=True, blank=True,
        help_text='Task 2: Task Response (0–9)',
    )
    writing_task2_coherence = models.DecimalField(
        max_digits=3, decimal_places=1, null=True, blank=True,
        help_text='Task 2: Coherence and Cohesion (0–9)',
    )
    writing_task2_lexical = models.DecimalField(
        max_digits=3, decimal_places=1, null=True, blank=True,
        help_text='Task 2: Lexical Resource (0–9)',
    )
    writing_task2_grammar = models.DecimalField(
        max_digits=3, decimal_places=1, null=True, blank=True,
        help_text='Task 2: Grammatical Range and Accuracy (0–9)',
    )

    writing_feedback = models.TextField(blank=True, default='')
    speaking_feedback = models.TextField(blank=True, default='')

    WRITING_STATUS_CHOICES = [
        ('pending', 'Kutilmoqda'),
        ('grading', 'Baholanyapti'),
        ('graded', 'Baholangan'),
    ]
    SPEAKING_STATUS_CHOICES = [
        ('pending', 'Kutilmoqda'),
        ('graded', 'Baholangan'),
    ]
    writing_status = models.CharField(
        max_length=20, choices=WRITING_STATUS_CHOICES, default='pending',
    )
    speaking_status = models.CharField(
        max_length=20, choices=SPEAKING_STATUS_CHOICES, default='pending',
    )
    writing_graded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='mock_writing_gradings',
    )
    writing_graded_at = models.DateTimeField(null=True, blank=True)
    speaking_graded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='mock_speaking_gradings',
    )
    speaking_graded_at = models.DateTimeField(null=True, blank=True)

    overall_band_score = models.DecimalField(
        max_digits=3, decimal_places=1, null=True, blank=True,
        help_text='IELTS Overall: (L+R+W+S)/4, 0.5 stepda yaxlitlanadi',
    )

    class Meta:
        db_table = 'mock_participants'
        unique_together = [('session', 'full_name')]
        ordering = ['joined_at']

    def __str__(self):
        return f'{self.full_name} @ {self.session.access_code}'

    # ===== Helper methods =====

    @staticmethod
    def _avg(scores):
        valid = [float(s) for s in scores if s is not None]
        return sum(valid) / len(valid) if valid else None

    def calculate_writing_score(self):
        """Writing band score = Task1*0.33 + Task2*0.67 (mavjud bo'lsa)."""
        from decimal import Decimal
        t1 = self._avg([
            self.writing_task1_task_achievement,
            self.writing_task1_coherence,
            self.writing_task1_lexical,
            self.writing_task1_grammar,
        ])
        t2 = self._avg([
            self.writing_task2_task_response,
            self.writing_task2_coherence,
            self.writing_task2_lexical,
            self.writing_task2_grammar,
        ])
        if t1 is not None and t2 is not None:
            score = round(t1 * 0.33 + t2 * 0.67, 1)
            self.writing_score = Decimal(str(score))
        elif t1 is not None or t2 is not None:
            score = round(t1 if t1 is not None else t2, 1)
            self.writing_score = Decimal(str(score))
        else:
            self.writing_score = None
        return self.writing_score

    def calculate_overall_band_score(self):
        """Overall = (L+R+W+S)/4, 0.5 stepda yaxlitlanadi (IELTS rule)."""
        from decimal import Decimal
        scores = [
            self.listening_score,
            self.reading_score,
            self.writing_score,
            self.speaking_score,
        ]
        valid = [float(s) for s in scores if s is not None]
        if len(valid) == 4:
            avg = sum(valid) / 4
            rounded = round(avg * 2) / 2
            self.overall_band_score = Decimal(str(rounded))
        else:
            self.overall_band_score = None
        return self.overall_band_score


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
