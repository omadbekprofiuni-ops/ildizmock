import uuid

from django.conf import settings
from django.db import models


class Test(models.Model):
    MODULE_CHOICES = [
        ('listening', 'Listening'),
        ('reading', 'Reading'),
        ('writing', 'Writing'),
        ('speaking', 'Speaking'),
    ]
    TYPE_CHOICES = [('academic', 'Academic'), ('general', 'General Training')]
    DIFFICULTY_CHOICES = [
        ('beginner', 'Boshlang‘ich (4.5–5.5)'),
        ('intermediate', 'O‘rta (5.5–6.5)'),
        ('advanced', 'Yuqori (6.5–7.5)'),
        ('expert', 'Mahoratli (7.5+)'),
    ]
    ACCESS_CHOICES = [('free', 'Free'), ('standard', 'Standard'), ('premium', 'Premium')]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
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

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.name} ({self.module})'


class Passage(models.Model):
    test = models.ForeignKey(Test, related_name='passages', on_delete=models.CASCADE)
    part_number = models.IntegerField()
    title = models.CharField(max_length=200)
    content = models.TextField()
    audio_file = models.FileField(null=True, blank=True, upload_to='audio/')
    audio_duration_seconds = models.IntegerField(null=True, blank=True)
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
        ('fill', 'Fill in the Blank'),
        ('matching', 'Matching'),
    ]

    passage = models.ForeignKey(Passage, related_name='questions', on_delete=models.CASCADE)
    order = models.IntegerField()
    question_type = models.CharField(max_length=30, choices=TYPE_CHOICES)
    text = models.TextField()
    options = models.JSONField(default=list, blank=True)
    correct_answer = models.JSONField()
    acceptable_answers = models.JSONField(default=list, blank=True)
    group_id = models.IntegerField(default=0)
    instruction = models.TextField(blank=True)
    points = models.IntegerField(default=1)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f'Q{self.order}: {self.text[:60]}'
