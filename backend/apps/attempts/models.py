import uuid

from django.conf import settings
from django.db import models

from apps.tests.models import Question, Test


class Attempt(models.Model):
    STATUS_CHOICES = [
        ('in_progress', 'In Progress'),
        ('submitted', 'Submitted'),
        ('graded', 'Graded'),
        ('expired', 'Expired'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='attempts',
                             null=True, blank=True,
                             on_delete=models.CASCADE)
    organization = models.ForeignKey(
        'organizations.Organization',
        null=True, blank=True,
        related_name='attempts',
        on_delete=models.CASCADE,
    )
    test = models.ForeignKey(Test, related_name='attempts', on_delete=models.CASCADE)
    # Guest (anonymous) attempt token — only stored when user is None.
    # Frontend keeps it in localStorage and sends as X-Guest-Token header.
    guest_token = models.UUIDField(null=True, blank=True, default=None)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='in_progress')
    # `started_at` only fills when student actually clicks "Start" in the test
    # gate (after rules + audio preload). The attempt row is created earlier,
    # but the timer must not run during preload — so this stays NULL until
    # POST /attempts/<id>/start/ is called.
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    time_spent_seconds = models.IntegerField(default=0)
    raw_score = models.IntegerField(null=True, blank=True)
    total_questions = models.IntegerField(null=True, blank=True)
    band_score = models.DecimalField(max_digits=2, decimal_places=1, null=True, blank=True)
    # ETAP 25 — per-section raw / band breakdown.
    # Shape: {"reading": {"raw": 32, "max": 40, "band": 7.0}, ...}
    section_band_scores = models.JSONField(default=dict, blank=True)
    # ETAP 25 — Speaking recordings keyed by question id (or `qid-subindex` for
    # part-1/3 multi-prompt sets). Values are media URLs.
    speaking_recordings = models.JSONField(default=dict, blank=True)
    # For writing module — essay text + word count (AI band filled later)
    essay_text = models.TextField(blank=True, default='')
    word_count = models.IntegerField(null=True, blank=True)
    # Teacher grading (writing/speaking)
    teacher_feedback = models.TextField(blank=True, default='')
    graded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        related_name='graded_attempts',
        on_delete=models.SET_NULL,
    )
    graded_at = models.DateTimeField(null=True, blank=True)

    # ETAP 29 — Strict Test Mode (anti-cheating)
    flagged_as_cheating = models.BooleanField(
        default=False,
        help_text='Strict mode violation thresholdi kesib o\'tilganda True',
    )
    auto_submitted = models.BooleanField(
        default=False,
        help_text="Tizim avtomatik submit qilganmi (violations / time / manual)",
    )
    auto_submit_reason = models.CharField(
        max_length=64, blank=True, default='',
        help_text="too_many_violations | time_expired | manual",
    )

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        who = self.user.username if self.user_id else f'guest:{self.guest_token}'
        return f'{who} — {self.test.name} ({self.status})'

    def save(self, *args, **kwargs):
        if not self.organization_id and self.user_id and self.user.organization_id:
            self.organization_id = self.user.organization_id
        super().save(*args, **kwargs)


class WritingSubmission(models.Model):
    STATUS_CHOICES = [('pending', 'Pending'), ('graded', 'Graded')]

    attempt = models.OneToOneField(
        Attempt, related_name='writing_submission', on_delete=models.CASCADE,
    )
    essay_text = models.TextField()
    word_count = models.IntegerField(default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    teacher_band = models.DecimalField(
        max_digits=2, decimal_places=1, null=True, blank=True,
    )
    teacher_feedback = models.TextField(blank=True, default='')
    graded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        related_name='graded_essays', on_delete=models.SET_NULL,
    )
    graded_at = models.DateTimeField(null=True, blank=True)
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-submitted_at']

    def __str__(self):
        return f'Writing #{self.attempt_id} ({self.status})'


class Answer(models.Model):
    attempt = models.ForeignKey(Attempt, related_name='answers', on_delete=models.CASCADE)
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    user_answer = models.JSONField(null=True, blank=True)
    is_correct = models.BooleanField(null=True, blank=True)
    points_earned = models.DecimalField(max_digits=4, decimal_places=1, default=0)
    flagged = models.BooleanField(default=False)
    time_spent_seconds = models.IntegerField(default=0)

    class Meta:
        unique_together = [('attempt', 'question')]

    def __str__(self):
        return f'{self.attempt_id} / Q{self.question.order}'


class TestSecurityViolation(models.Model):
    """ETAP 29 — Strict mode davomida kuzatilgan har bir buzilish.

    Frontend useStrictTestMode hook'i tomonidan POST qilinadi. Server
    debounce qoidasini qo'llaydi (kichik blur'lar `counted=False` bilan
    yoziladi — teacher report'da ko'rinadi, lekin auto-submit'ga
    hissa qo'shmaydi).
    """

    TYPE_CHOICES = [
        ('tab_switched', 'Tab switched'),
        ('window_blurred', 'Window lost focus'),
        ('fullscreen_exited', 'Fullscreen exited'),
        ('devtools_attempt', 'DevTools shortcut attempted'),
        ('copy_attempt', 'Copy attempted'),
        ('paste_attempt', 'Paste attempted'),
        ('print_attempt', 'Print attempted'),
        ('save_attempt', 'Save attempted'),
        ('right_click', 'Right-click attempted'),
        ('view_source', 'View source attempted'),
        ('select_all', 'Select-all attempted'),
        ('other', 'Other'),
    ]

    attempt = models.ForeignKey(
        Attempt, on_delete=models.CASCADE, related_name='violations',
    )
    type = models.CharField(max_length=32, choices=TYPE_CHOICES)
    occurred_at = models.DateTimeField(auto_now_add=True)
    duration_ms = models.IntegerField(
        null=True, blank=True,
        help_text='tab_switched / window_blurred uchun: talaba qancha vaqt yo\'q bo\'lganligi',
    )
    metadata = models.JSONField(
        default=dict, blank=True,
        help_text='Qo\'shimcha context: user_agent, viewport, va h.k.',
    )
    counted = models.BooleanField(
        default=True,
        help_text='False = forgiven (debounced kichik blur). Auto-submit\'ga ta\'sir qilmaydi.',
    )

    class Meta:
        ordering = ['attempt', 'occurred_at']
        indexes = [
            models.Index(fields=['attempt', 'type']),
            models.Index(fields=['occurred_at']),
        ]

    def __str__(self):
        return f'{self.attempt_id} — {self.type} @ {self.occurred_at:%H:%M:%S}'
