import random
import secrets
import string

from django.conf import settings
from django.db import models


def generate_access_code() -> str:
    """`ILDIZ` + 3 ta tasodifiy raqam, model save vaqtida unique tekshiriladi."""
    return 'ILDIZ' + ''.join(random.choices(string.digits, k=3))


def generate_browser_session_id() -> str:
    return ''.join(random.choices(string.ascii_letters + string.digits, k=32))


def generate_verification_code() -> str:
    """ETAP 20 — Certificate verification kodini yaratish (URL-safe token)."""
    return secrets.token_urlsafe(32)


class MockSession(models.Model):
    """Center admini yaratadigan sinxron mock sessiya."""

    STATUS_CHOICES = [
        ('waiting', 'Kutilmoqda'),
        ('listening', 'Listening'),
        ('reading', 'Reading'),
        ('writing', 'Writing'),
        ('speaking', 'Speaking'),
        ('finished', 'Tugagan'),
        ('cancelled', 'Revoked'),
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
    speaking_test = models.ForeignKey(
        'tests.Test',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='+',
        limit_choices_to={'module': 'speaking'},
        help_text='Speaking test (optional — adds the speaking stage if present)',
    )

    listening_pdf_test = models.ForeignKey(
        'tests.PDFTest',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='+',
        limit_choices_to={'module': 'listening'},
    )
    reading_pdf_test = models.ForeignKey(
        'tests.PDFTest',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='+',
        limit_choices_to={'module': 'reading'},
    )

    listening_duration = models.PositiveIntegerField(default=30)
    reading_duration = models.PositiveIntegerField(default=60)
    writing_duration = models.PositiveIntegerField(default=60)
    speaking_duration = models.PositiveIntegerField(default=15)

    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='waiting',
    )
    section_started_at = models.DateTimeField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    access_code = models.CharField(
        max_length=16, unique=True, default=generate_access_code,
    )

    # ETAP 19 — Link amal qilish muddati va kech qo'shilish ruxsati
    link_expires_at = models.DateTimeField(
        null=True, blank=True,
        help_text='Link expiration time (empty = unlimited)',
    )
    allow_late_join = models.BooleanField(
        default=True,
        help_text='Allow joining after the session starts',
    )
    allow_guests = models.BooleanField(
        default=True,
        help_text='Whether students not on the roster can join by entering their name',
    )

    is_archived = models.BooleanField(default=False, db_index=True)
    archived_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'mock_sessions'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.name} ({self.access_code}) — {self.get_status_display()}'

    def is_join_allowed(self) -> bool:
        """ETAP 19 — Hozir bu sessiyaga qo'shilish mumkinmi?"""
        from django.utils import timezone
        if self.link_expires_at and timezone.now() > self.link_expires_at:
            return False
        if self.status in ('finished', 'cancelled'):
            return False
        if self.status != 'waiting' and not self.allow_late_join:
            return False
        return True

    @property
    def current_test(self):
        if self.status == 'listening':
            return self.listening_test or self.listening_pdf_test
        if self.status == 'reading':
            return self.reading_test or self.reading_pdf_test
        if self.status == 'writing':
            return self.writing_test
        if self.status == 'speaking':
            return self.speaking_test
        return None

    @property
    def current_test_kind(self):
        """'regular' (Test) | 'pdf' (PDFTest) | None — current section uchun."""
        if self.status == 'listening':
            if self.listening_test_id:
                return 'regular'
            if self.listening_pdf_test_id:
                return 'pdf'
        elif self.status == 'reading':
            if self.reading_test_id:
                return 'regular'
            if self.reading_pdf_test_id:
                return 'pdf'
        elif self.status == 'writing' and self.writing_test_id:
            return 'regular'
        elif self.status == 'speaking' and self.speaking_test_id:
            return 'regular'
        return None

    @property
    def current_duration_minutes(self) -> int:
        if self.status == 'listening':
            return self.listening_duration
        if self.status == 'reading':
            return self.reading_duration
        if self.status == 'writing':
            return self.writing_duration
        if self.status == 'speaking':
            return self.speaking_duration
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
        help_text='Direct link if the student is logged in',
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

    # ETAP 14 BUG #11 — Speaking audio recording
    speaking_audio = models.FileField(
        upload_to='speaking_recordings/%Y/%m/',
        null=True, blank=True,
        help_text='Speaking audio recorded by the student (webm/mp3/m4a)',
    )
    speaking_uploaded_at = models.DateTimeField(null=True, blank=True)
    speaking_duration_seconds = models.PositiveIntegerField(null=True, blank=True)

    joined_at = models.DateTimeField(auto_now_add=True)

    # ETAP 19 — Pre-registered (teacher tomondan oldindan qo'shilgan) vs claimed
    # `joined_at` — record yaratilgan vaqt (teacher pre-registered yoki guest qo'shilgan)
    # `has_joined` — talaba aslida link orqali kirib, ismini bosgan
    # `claimed_at` — qachon kirib, sessiya tokenini olgan
    has_joined = models.BooleanField(default=False)
    claimed_at = models.DateTimeField(null=True, blank=True)

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
        help_text='IELTS Overall: (L+R+W+S)/4, rounded to 0.5',
    )

    class Meta:
        db_table = 'mock_participants'
        unique_together = [('session', 'full_name')]
        ordering = ['joined_at']

    def __str__(self):
        return f'{self.full_name} @ {self.session.access_code}'

    @property
    def is_guest(self) -> bool:
        """ETAP 19 — Login akkauntiga bog'lanmagan participant."""
        return self.user_id is None

    def get_display_name(self) -> str:
        """ETAP 19 — Ism (linked user nomi yoki guest full_name)."""
        if self.user_id:
            full = (
                f'{(self.user.first_name or "").strip()} '
                f'{(self.user.last_name or "").strip()}'
            ).strip()
            return full or self.user.username
        return self.full_name

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


class Certificate(models.Model):
    """ETAP 20 — Persistent IELTS Mock Certificate.

    Teacher participantni baholab bo'lganidan keyin "Certificate berish"
    tugmasini bosadi va shu yerda yaratiladi (PDF ham yoziladi).
    Student o'z dashboardida ko'radi va PDF yuklab oladi.
    """

    participant = models.OneToOneField(
        MockParticipant,
        on_delete=models.CASCADE,
        related_name='certificate',
        help_text='Mock participant the certificate was issued to',
    )

    # Unique identifiers
    certificate_number = models.CharField(
        max_length=50, unique=True,
        help_text='Format: ORG-YYYY-MM-NNN (e.g. ILDIZ-2026-05-001)',
    )
    verification_code = models.CharField(
        max_length=64, unique=True, default=generate_verification_code,
        help_text='Token for verification via QR or URL',
    )

    # Snapshot of scores (immutable — sertifikat berilganda yozilgan)
    listening_score = models.DecimalField(max_digits=3, decimal_places=1)
    reading_score = models.DecimalField(max_digits=3, decimal_places=1)
    writing_score = models.DecimalField(max_digits=3, decimal_places=1)
    speaking_score = models.DecimalField(max_digits=3, decimal_places=1)
    overall_band_score = models.DecimalField(max_digits=3, decimal_places=1)

    # Snapshot of identity
    full_name = models.CharField(max_length=200)
    test_date = models.DateField()
    organization_name = models.CharField(max_length=200, blank=True, default='')

    # PDF saqlangan fayl
    pdf_file = models.FileField(
        upload_to='certificates/%Y/%m/',
        null=True, blank=True,
    )

    # Issuer
    issued_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='issued_certificates',
    )

    # Revocation
    is_revoked = models.BooleanField(default=False)
    revoked_at = models.DateTimeField(null=True, blank=True)
    revoked_reason = models.TextField(blank=True, default='')
    revoked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='revoked_certificates',
    )

    issue_date = models.DateField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'mock_certificates'
        ordering = ['-issue_date', '-id']
        indexes = [
            models.Index(fields=['certificate_number']),
            models.Index(fields=['verification_code']),
        ]

    def __str__(self):
        return f'{self.certificate_number} — {self.full_name}'

    @staticmethod
    def generate_certificate_number(organization, test_date) -> str:
        """ORG-YYYY-MM-NNN — markaz uchun shu oydagi navbatdagi raqam."""
        org_code = ''.join(
            ch for ch in (organization.name or 'ORG').upper() if ch.isalnum()
        )[:6] or 'ORG'
        year = test_date.year
        month = test_date.month
        # Shu oydagi sertifikatlar sonini sanaymiz
        count = Certificate.objects.filter(
            participant__session__organization=organization,
            test_date__year=year,
            test_date__month=month,
        ).count()
        # Unique kafolati (race conditionga qarshi while loop)
        while True:
            candidate = f'{org_code}-{year}-{month:02d}-{count + 1:03d}'
            if not Certificate.objects.filter(certificate_number=candidate).exists():
                return candidate
            count += 1
