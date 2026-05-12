import uuid

from django.conf import settings
from django.db import models

from .validators import validate_audio_file


class Test(models.Model):
    MODULE_CHOICES = [
        ('listening', 'Listening'),
        ('reading', 'Reading'),
        ('writing', 'Writing'),
        ('speaking', 'Speaking'),
        ('full_mock', 'Full Mock (L+R+W)'),
    ]
    TYPE_CHOICES = [('academic', 'Academic'), ('general', 'General Training')]
    DIFFICULTY_CHOICES = [
        ('beginner', 'Boshlang‘ich (4.5–5.5)'),
        ('intermediate', 'O‘rta (5.5–6.5)'),
        ('advanced', 'Yuqori (6.5–7.5)'),
        ('expert', 'Mahoratli (7.5+)'),
        # Aliases used by ETAP-2 wizard
        ('easy', 'Easy (5.0–6.0)'),
        ('medium', 'Medium (6.0–7.0)'),
        ('hard', 'Hard (7.0–8.5)'),
    ]
    ACCESS_CHOICES = [('free', 'Free'), ('standard', 'Standard'), ('premium', 'Premium')]
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('published', 'Published'),
        ('archived', 'Archived'),
    ]

    class Source(models.TextChoices):
        CAMBRIDGE_7 = 'cambridge_7', 'Cambridge 7'
        CAMBRIDGE_8 = 'cambridge_8', 'Cambridge 8'
        CAMBRIDGE_9 = 'cambridge_9', 'Cambridge 9'
        CAMBRIDGE_10 = 'cambridge_10', 'Cambridge 10'
        CAMBRIDGE_11 = 'cambridge_11', 'Cambridge 11'
        CAMBRIDGE_12 = 'cambridge_12', 'Cambridge 12'
        CAMBRIDGE_13 = 'cambridge_13', 'Cambridge 13'
        CAMBRIDGE_14 = 'cambridge_14', 'Cambridge 14'
        CAMBRIDGE_15 = 'cambridge_15', 'Cambridge 15'
        CAMBRIDGE_16 = 'cambridge_16', 'Cambridge 16'
        CAMBRIDGE_17 = 'cambridge_17', 'Cambridge 17'
        CAMBRIDGE_18 = 'cambridge_18', 'Cambridge 18'
        CAMBRIDGE_19 = 'cambridge_19', 'Cambridge 19'
        CAMBRIDGE_20 = 'cambridge_20', 'Cambridge 20'
        REAL_EXAM_2024 = 'real_exam_2024', 'Real Exam 2024'
        REAL_EXAM_2025 = 'real_exam_2025', 'Real Exam 2025'
        REAL_EXAM_2026 = 'real_exam_2026', 'Real Exam 2026'
        ILDIZ_ORIGINAL = 'ildiz_original', 'ILDIZ Original'
        OTHER = 'other', 'Boshqa'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        'organizations.Organization',
        null=True, blank=True,
        related_name='tests',
        on_delete=models.CASCADE,
        help_text='Null = superadmin global test (for all centers)',
    )
    is_global = models.BooleanField(default=False)
    name = models.CharField(max_length=200)
    module = models.CharField(max_length=20, choices=MODULE_CHOICES)
    test_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='academic')
    difficulty = models.CharField(max_length=20, choices=DIFFICULTY_CHOICES, default='medium')
    duration_minutes = models.IntegerField(default=60)
    description = models.TextField(blank=True)
    is_published = models.BooleanField(default=True)
    access_level = models.CharField(max_length=20, choices=ACCESS_CHOICES, default='free')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True, null=True)

    # ETAP 2 yangi fieldlari
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='draft')
    category = models.CharField(
        max_length=100, blank=True, default='',
        help_text='e.g. "Cambridge IELTS 19"',
    )
    published_at = models.DateTimeField(null=True, blank=True)
    cloned_from = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='clones',
        help_text='Original global test (if this is a clone)',
    )

    # ETAP 6 — Practice Mode
    is_practice_enabled = models.BooleanField(
        default=False,
        help_text='Should this test be visible to students for independent practice?',
    )
    practice_time_limit = models.PositiveIntegerField(
        null=True, blank=True,
        help_text='Practice mode time limit (minutes). Empty = no limit.',
    )

    # ETAP 13 — Soft delete (arxivga olish + qayta tiklash imkoniyati)
    is_deleted = models.BooleanField(default=False, db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='deleted_tests',
    )

    # ETAP 16 — B2C catalog metadata
    available_for_b2c = models.BooleanField(
        default=False, db_index=True,
        help_text="B2C katalogida ko'rinishi uchun belgilang.",
    )
    b2c_published_at = models.DateTimeField(null=True, blank=True)
    b2c_display_name = models.CharField(max_length=200, blank=True, default='')
    b2c_description = models.TextField(blank=True, default='')

    # ETAP 16.6 — Test manbasi (Cambridge yili, Real Exam, ILDIZ Original).
    # Catalog'da source bo'yicha filtrlash uchun ishlatiladi.
    source = models.CharField(
        max_length=30,
        choices=Source.choices,
        default=Source.OTHER,
        db_index=True,
    )
    source_custom_name = models.CharField(
        max_length=100, blank=True, default='',
        help_text=(
            "source=OTHER bo'lsa, erkin nom yozish mumkin "
            "(masalan, 'IELTS Original 2026')."
        ),
    )

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.name} ({self.module})'

    @property
    def b2c_name(self):
        return self.b2c_display_name or self.name

    @property
    def source_display(self):
        """Catalog UI uchun: OTHER + custom_name bo'lsa erkin nom, aks holda label."""
        if self.source == self.Source.OTHER and self.source_custom_name:
            return self.source_custom_name
        return self.get_source_display()

    def soft_delete(self, user=None):
        from django.utils import timezone
        self.is_deleted = True
        self.deleted_at = timezone.now()
        if user is not None:
            self.deleted_by = user
        self.save(update_fields=['is_deleted', 'deleted_at', 'deleted_by'])

    def restore(self):
        self.is_deleted = False
        self.deleted_at = None
        self.deleted_by = None
        self.save(update_fields=['is_deleted', 'deleted_at', 'deleted_by'])


class Passage(models.Model):
    test = models.ForeignKey(Test, related_name='passages', on_delete=models.CASCADE)
    part_number = models.IntegerField()
    title = models.CharField(max_length=200)
    subtitle = models.CharField(max_length=300, blank=True, default='')
    content = models.TextField()
    instructions = models.TextField(blank=True, default='')
    audio_file = models.FileField(null=True, blank=True, upload_to='audio/')
    audio_duration_seconds = models.IntegerField(null=True, blank=True)
    image = models.ImageField(
        upload_to='passage_images/%Y/%m/', blank=True, null=True,
        help_text='Image/diagram for the passage (optional)',
    )
    # For writing module: minimum required word count per task
    min_words = models.IntegerField(null=True, blank=True)
    order = models.IntegerField(default=0)

    # ETAP 30 — HTML Test Platform (examy.me-style content)
    # content_source = adminning markdown-uslubidagi DSL manba matni;
    # content_html = parser yaratgan rendered HTML (talabaga ko'rsatiladi).
    # Eski 'content' maydoni saqlanadi (legacy testlar uchun).
    content_source = models.TextField(
        blank=True, default='',
        help_text='HTML DSL manba matni (admin tahrir qiladi). {1}, {2} markerlar.',
    )
    content_html = models.TextField(
        blank=True, default='',
        help_text='Parser tomonidan generatsiya qilingan HTML. To\'g\'ridan-to\'g\'ri tahrir qilmang.',
    )

    class Meta:
        ordering = ['order', 'part_number']

    def __str__(self):
        return f'{self.test.name} — Part {self.part_number}: {self.title}'


class Question(models.Model):
    TYPE_CHOICES = [
        ('mcq', 'Multiple Choice'),
        ('multi_choice', 'Multiple Choice (Multi-Select)'),
        ('tfng', 'True/False/Not Given'),
        ('ynng', 'Yes/No/Not Given'),
        ('fill', 'Fill in the Blank'),
        ('gap_fill', 'Gap Fill'),
        ('matching', 'Matching'),
        ('matching_headings', 'Matching Headings'),
        ('short_answer', 'Short Answer'),
        ('form_completion', 'Form Completion'),
        ('map_labeling', 'Map Labeling'),
        ('summary_completion', 'Summary Completion'),
        ('sentence_completion', 'Sentence Completion'),
    ]

    passage = models.ForeignKey(
        Passage, related_name='questions', on_delete=models.CASCADE,
        null=True, blank=True,
    )
    listening_part = models.ForeignKey(
        'ListeningPart', related_name='questions', on_delete=models.CASCADE,
        null=True, blank=True,
    )
    order = models.IntegerField()
    question_number = models.PositiveSmallIntegerField(
        default=0, help_text='Order number within the test (1-40)',
    )
    question_type = models.CharField(max_length=30, choices=TYPE_CHOICES)
    text = models.TextField()
    prompt = models.TextField(blank=True, default='', help_text='Question text (new format)')
    options = models.JSONField(default=list, blank=True)
    correct_answer = models.JSONField()
    acceptable_answers = models.JSONField(default=list, blank=True)
    alt_answers = models.JSONField(
        default=list, blank=True,
        help_text='Alternate correct answers (new format)',
    )
    group_id = models.IntegerField(default=0)
    instruction = models.TextField(blank=True)
    points = models.IntegerField(default=1)
    image = models.ImageField(
        upload_to='question_images/%Y/%m/', blank=True, null=True,
        help_text='Image for the question (map, diagram, chart) — optional',
    )

    # ETAP 22 — type-specific JSON shape (admin builder + student renderer
    # agree on it). For matching_headings (group form): payload holds
    # {headings:[...], paragraphs:[...]} and answer_key holds
    # {matches:{B:'i', C:'iv', ...}}. Existing legacy fields above remain
    # the source of truth for older types until those types are migrated.
    payload = models.JSONField(default=dict, blank=True)
    answer_key = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f'Q{self.order}: {self.text[:60]}'


class ListeningPart(models.Model):
    """Listening test 4 qismdan iborat (Part 1, 2, 3, 4)."""

    test = models.ForeignKey(
        Test, on_delete=models.CASCADE, related_name='listening_parts',
    )
    part_number = models.PositiveSmallIntegerField(help_text='1, 2, 3 or 4')

    audio_file = models.FileField(
        upload_to='listening_audio/%Y/%m/', null=True, blank=True,
        validators=[validate_audio_file],
    )
    audio_duration_seconds = models.PositiveIntegerField(default=0)
    audio_bitrate_kbps = models.PositiveIntegerField(default=0)
    audio_size_bytes = models.PositiveIntegerField(default=0)

    image = models.ImageField(
        upload_to='listening_images/%Y/%m/', blank=True, null=True,
        help_text='Image for the section (optional)',
    )
    transcript = models.TextField(blank=True, default='')
    instructions = models.TextField(
        blank=True, default='', help_text='Section instructions',
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['part_number']
        unique_together = [('test', 'part_number')]

    def __str__(self):
        return f'{self.test.name} — Part {self.part_number}'


class WritingTask(models.Model):
    """Writing test 2 ta taskdan iborat."""

    test = models.ForeignKey(
        Test, on_delete=models.CASCADE, related_name='writing_tasks',
    )
    task_number = models.PositiveSmallIntegerField(help_text='1 or 2')

    prompt = models.TextField(help_text='Task text')
    chart_image = models.ImageField(
        upload_to='writing_charts/', null=True, blank=True,
        help_text='Only for Task 1 (chart, graph, table image)',
    )

    min_words = models.PositiveIntegerField(default=150)
    suggested_minutes = models.PositiveIntegerField(default=20)

    requirements = models.TextField(
        blank=True, default='',
        help_text='Additional requirements (e.g. "Compare both views")',
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['task_number']
        unique_together = [('test', 'task_number')]

    def __str__(self):
        return f'{self.test.name} — Task {self.task_number}'


class PDFTest(models.Model):
    """PDF + audio + answer key dan tashkil topgan oddiy test (2 daqiqada yaratiladi)."""

    public_id = models.UUIDField(
        default=uuid.uuid4, unique=True, editable=False, db_index=True,
        help_text='URLs use this UUID instead of the sequential int PK.',
    )

    MODULE_CHOICES = [
        ('reading', 'Reading'),
        ('listening', 'Listening'),
    ]
    DIFFICULTY_CHOICES = [
        ('easy', 'Easy'),
        ('medium', 'Medium'),
        ('hard', 'Hard'),
    ]
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('published', 'Published'),
    ]

    organization = models.ForeignKey(
        'organizations.Organization',
        on_delete=models.CASCADE,
        related_name='pdf_tests',
    )
    name = models.CharField(max_length=200)
    module = models.CharField(max_length=20, choices=MODULE_CHOICES)
    difficulty = models.CharField(
        max_length=20, choices=DIFFICULTY_CHOICES, default='medium',
    )

    pdf_file = models.FileField(upload_to='test_pdfs/')

    # HOTFIX — PDF sahifalari PNG'ga aylantirilib, talabaga rasm sifatida
    # ko'rsatiladi (Brave/Chrome shield iframe'larni bloklayapti edi).
    pdf_pages = models.JSONField(
        default=list, blank=True,
        help_text="Aylantirilgan PNG sahifalarning media URL'lari "
                  "(masalan ['/media/pdf_pages/<uuid>/page_1.png', ...])",
    )
    pdf_page_count = models.PositiveIntegerField(default=0)

    audio_part1 = models.FileField(upload_to='listening_audios/', null=True, blank=True)
    audio_part2 = models.FileField(upload_to='listening_audios/', null=True, blank=True)
    audio_part3 = models.FileField(upload_to='listening_audios/', null=True, blank=True)
    audio_part4 = models.FileField(upload_to='listening_audios/', null=True, blank=True)

    # {"1": "C", "2": "B", "3": "NOT GIVEN", ...}
    answer_key = models.JSONField()

    total_questions = models.IntegerField(default=40)
    duration_minutes = models.IntegerField(default=60)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='published')
    is_published = models.BooleanField(default=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='pdf_tests_created',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tests_pdftest'
        ordering = ['-created_at']

    def __str__(self):
        return self.name


class PDFTestAttempt(models.Model):
    """Talabaning PDFTest urinishi — auto-grading qiladi."""

    test = models.ForeignKey(
        PDFTest, on_delete=models.CASCADE, related_name='attempts',
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='pdf_test_attempts',
    )

    # {"1": "C", "2": "B", ...}
    answers = models.JSONField(default=dict)

    score = models.IntegerField(null=True, blank=True)
    total_questions = models.IntegerField()
    percentage = models.FloatField(null=True, blank=True)

    # {"1": true, "2": false, ...}
    results = models.JSONField(default=dict)

    started_at = models.DateTimeField(auto_now_add=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    time_taken_seconds = models.IntegerField(null=True, blank=True)

    class Meta:
        db_table = 'tests_pdfattempt'
        ordering = ['-started_at']
        unique_together = [('test', 'student')]
        indexes = [models.Index(fields=['test', 'student'])]

    @staticmethod
    def _normalize_answer(value):
        """Compare-friendly: trim, uppercase, multiple spaces → single space."""
        import re
        if value is None:
            return ''
        s = str(value).strip().upper()
        s = re.sub(r'\s+', ' ', s)
        return s

    def auto_grade(self):
        correct_count = 0
        results = {}
        norm = self._normalize_answer
        for q_num, correct_answer in self.test.answer_key.items():
            student_answer = self.answers.get(str(q_num), '')
            # Correct answer can be a list (multiple acceptable) or a string with `/` separator.
            if isinstance(correct_answer, list):
                acceptable = {norm(a) for a in correct_answer}
            else:
                acceptable = {norm(p) for p in str(correct_answer).split('/')}
            is_correct = norm(student_answer) in acceptable
            if is_correct:
                correct_count += 1
            results[str(q_num)] = is_correct

        total = len(self.test.answer_key) or 1
        self.score = correct_count
        self.total_questions = len(self.test.answer_key)
        self.percentage = (correct_count / total) * 100
        self.results = results
        self.save()
        return self.score

    def __str__(self):
        return f'{self.student} — {self.test.name}'


class PDFImportLog(models.Model):
    """ETAP 16.7 — Har bir PDF import urinishini audit va quota uchun logga yozadi."""

    class Status(models.TextChoices):
        PROCESSING = 'processing', 'Davom etmoqda'
        AI_PARSED = 'ai_parsed', 'AI parse qildi'
        SAVED = 'saved', 'Test saqlandi'
        FAILED = 'failed', 'Xato'
        COMPLETED_NO_AI = 'completed_no_ai', 'AI ishlatilmadi'

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL, null=True, blank=True,
        related_name='pdf_imports',
    )
    organization = models.ForeignKey(
        'organizations.Organization',
        on_delete=models.SET_NULL, null=True, blank=True,
        related_name='pdf_imports',
    )

    file_name = models.CharField(max_length=255)
    file_size_bytes = models.PositiveIntegerField(default=0)

    use_ai = models.BooleanField(default=False)
    section_type_hint = models.CharField(max_length=20, blank=True, default='')

    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PROCESSING,
    )

    provider_name = models.CharField(max_length=50, blank=True, default='')
    model_used = models.CharField(max_length=50, blank=True, default='')
    tokens_used = models.PositiveIntegerField(default=0)
    cost_usd = models.DecimalField(max_digits=10, decimal_places=6, default=0)

    error_message = models.TextField(blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'PDF import log'
        verbose_name_plural = 'PDF import logs'

    def __str__(self):
        return f'{self.file_name} — {self.status} — {self.created_at:%Y-%m-%d %H:%M}'


class AIProviderConfig(models.Model):
    """ETAP 16.8 — Har AI provider uchun konfiguratsiya.

    API key Fernet (`services/encryption.py`) bilan shifrlanib saqlanadi —
    plain matn DB'da hech qachon yo'q. UI faqat oxirgi 4 belgini ko'rsatadi.
    Faqat bir nechta provider'dan bittasi `is_active=True` bo'la oladi.
    """

    class Provider(models.TextChoices):
        GEMINI_AISTUDIO = 'gemini_aistudio', 'Gemini AI Studio'
        CLAUDE_ANTHROPIC = 'claude_anthropic', 'Claude (Anthropic)'

    provider = models.CharField(
        max_length=30, choices=Provider.choices, unique=True,
    )
    model_name = models.CharField(
        max_length=100, blank=True, default='',
        help_text='masalan: gemini-2.5-flash, claude-sonnet-4-6',
    )
    encrypted_api_key = models.TextField(
        blank=True, default='',
        help_text='Fernet bilan shifrlangan API key. Hech qachon plain matn emas.',
    )
    api_key_last4 = models.CharField(
        max_length=4, blank=True, default='',
        help_text='UI da ko\'rsatish uchun oxirgi 4 belgi (encrypted emas).',
    )
    is_active = models.BooleanField(
        default=False,
        help_text='True bo\'lsa, get_ai_provider() shu provider\'ni qaytaradi.',
    )

    last_test_at = models.DateTimeField(null=True, blank=True)
    last_test_success = models.BooleanField(null=True, blank=True)
    last_test_error = models.TextField(blank=True, default='')
    last_test_latency_ms = models.PositiveIntegerField(null=True, blank=True)

    last_updated_at = models.DateTimeField(auto_now=True)
    last_updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL, null=True, blank=True,
        related_name='updated_ai_configs',
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['provider']
        verbose_name = 'AI Provider Config'
        verbose_name_plural = 'AI Provider Configs'

    def __str__(self):
        suffix = 'active' if self.is_active else 'inactive'
        return f'{self.get_provider_display()} ({suffix})'

    @property
    def is_configured(self) -> bool:
        return bool(self.encrypted_api_key)

    @property
    def masked_key(self) -> str:
        if not self.api_key_last4:
            return ''
        return '•' * 8 + self.api_key_last4


class AIProviderAuditLog(models.Model):
    """ETAP 16.8 — Har bir provider o'zgartirishini logga yozadi."""

    class Action(models.TextChoices):
        KEY_SET = 'key_set', "API key o'rnatildi"
        KEY_UPDATED = 'key_updated', 'API key yangilandi'
        KEY_CLEARED = 'key_cleared', "API key o'chirildi"
        MODEL_CHANGED = 'model_changed', "Model o'zgartirildi"
        ACTIVATED = 'activated', 'Aktiv qilindi'
        DEACTIVATED = 'deactivated', 'Deaktiv qilindi'
        TEST_CONNECTION = 'test_connection', "Sinov o'tkazildi"

    config = models.ForeignKey(
        AIProviderConfig,
        on_delete=models.CASCADE, related_name='audit_logs',
    )
    action = models.CharField(max_length=30, choices=Action.choices)

    old_value = models.CharField(max_length=200, blank=True, default='')
    new_value = models.CharField(max_length=200, blank=True, default='')

    test_success = models.BooleanField(null=True, blank=True)
    test_error = models.TextField(blank=True, default='')

    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL, null=True, blank=True,
        related_name='ai_audit_logs',
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'AI provider audit log'
        verbose_name_plural = 'AI provider audit logs'

    def __str__(self):
        who = self.performed_by.username if self.performed_by else 'system'
        return f'{who} · {self.get_action_display()} · {self.created_at:%Y-%m-%d %H:%M}'


class TestClone(models.Model):
    """Center qaysi global testni nusxalaganini kuzatish (audit)."""

    organization = models.ForeignKey(
        'organizations.Organization', on_delete=models.CASCADE,
        related_name='test_clones',
    )
    source_test = models.ForeignKey(
        Test, on_delete=models.CASCADE,
        related_name='clone_records',
        help_text='Original global test',
    )
    cloned_test = models.ForeignKey(
        Test, on_delete=models.CASCADE,
        related_name='+',
        help_text="Clone test (a copy in the center's database)",
    )
    cloned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True,
        related_name='+',
    )
    cloned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-cloned_at']

    def __str__(self):
        return f'{self.organization.slug} ← {self.source_test.name}'
