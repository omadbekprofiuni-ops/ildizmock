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

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        'organizations.Organization',
        null=True, blank=True,
        related_name='tests',
        on_delete=models.CASCADE,
        help_text='Null = superadmin global test (hamma markazlar uchun)',
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
        help_text='Asl global test (agar bu klon bo‘lsa)',
    )

    # ETAP 6 — Practice Mode
    is_practice_enabled = models.BooleanField(
        default=False,
        help_text='Talabalar mustaqil mashq qilish uchun bu testni ko‘rsatishimi?',
    )
    practice_time_limit = models.PositiveIntegerField(
        null=True, blank=True,
        help_text='Practice rejimi vaqt limiti (daqiqada). Bo‘sh — limit yo‘q.',
    )

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.name} ({self.module})'


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
        help_text='Passage uchun rasm/diagram (ixtiyoriy)',
    )
    # For writing module: minimum required word count per task
    min_words = models.IntegerField(null=True, blank=True)
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ['order', 'part_number']

    def __str__(self):
        return f'{self.test.name} — Part {self.part_number}: {self.title}'


class Question(models.Model):
    TYPE_CHOICES = [
        ('mcq', 'Multiple Choice'),
        ('tfng', 'True/False/Not Given'),
        ('ynng', 'Yes/No/Not Given'),
        ('fill', 'Fill in the Blank'),
        ('gap_fill', 'Gap Fill'),
        ('matching', 'Matching'),
        ('short_answer', 'Short Answer'),
        ('form_completion', 'Form Completion'),
        ('map_labeling', 'Map Labeling'),
        ('summary_completion', 'Summary Completion'),
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
        default=0, help_text='Test ichidagi tartib raqam (1-40)',
    )
    question_type = models.CharField(max_length=30, choices=TYPE_CHOICES)
    text = models.TextField()
    prompt = models.TextField(blank=True, default='', help_text='Savol matni (yangi format)')
    options = models.JSONField(default=list, blank=True)
    correct_answer = models.JSONField()
    acceptable_answers = models.JSONField(default=list, blank=True)
    alt_answers = models.JSONField(
        default=list, blank=True,
        help_text='Muqobil to‘g‘ri javoblar (yangi format)',
    )
    group_id = models.IntegerField(default=0)
    instruction = models.TextField(blank=True)
    points = models.IntegerField(default=1)
    image = models.ImageField(
        upload_to='question_images/%Y/%m/', blank=True, null=True,
        help_text='Savol uchun rasm (map, diagram, chart) — ixtiyoriy',
    )

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f'Q{self.order}: {self.text[:60]}'


class ListeningPart(models.Model):
    """Listening test 4 qismdan iborat (Part 1, 2, 3, 4)."""

    test = models.ForeignKey(
        Test, on_delete=models.CASCADE, related_name='listening_parts',
    )
    part_number = models.PositiveSmallIntegerField(help_text='1, 2, 3 yoki 4')

    audio_file = models.FileField(
        upload_to='listening_audio/%Y/%m/', null=True, blank=True,
        validators=[validate_audio_file],
    )
    audio_duration_seconds = models.PositiveIntegerField(default=0)
    audio_bitrate_kbps = models.PositiveIntegerField(default=0)
    audio_size_bytes = models.PositiveIntegerField(default=0)

    image = models.ImageField(
        upload_to='listening_images/%Y/%m/', blank=True, null=True,
        help_text='Bo‘lim uchun rasm (ixtiyoriy)',
    )
    transcript = models.TextField(blank=True, default='')
    instructions = models.TextField(
        blank=True, default='', help_text='Bo‘lim ko‘rsatmasi',
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
    task_number = models.PositiveSmallIntegerField(help_text='1 yoki 2')

    prompt = models.TextField(help_text='Topshiriq matni')
    chart_image = models.ImageField(
        upload_to='writing_charts/', null=True, blank=True,
        help_text='Faqat Task 1 uchun (chart, grafik, jadval rasmi)',
    )

    min_words = models.PositiveIntegerField(default=150)
    suggested_minutes = models.PositiveIntegerField(default=20)

    requirements = models.TextField(
        blank=True, default='',
        help_text='Qo‘shimcha talablar (masalan: "Compare both views")',
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['task_number']
        unique_together = [('test', 'task_number')]

    def __str__(self):
        return f'{self.test.name} — Task {self.task_number}'


class TestClone(models.Model):
    """Markaz qaysi global testni nusxalaganini kuzatish (audit)."""

    organization = models.ForeignKey(
        'organizations.Organization', on_delete=models.CASCADE,
        related_name='test_clones',
    )
    source_test = models.ForeignKey(
        Test, on_delete=models.CASCADE,
        related_name='clone_records',
        help_text='Asl global test',
    )
    cloned_test = models.ForeignKey(
        Test, on_delete=models.CASCADE,
        related_name='+',
        help_text='Klon test (markaz bazasidagi nusxa)',
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
