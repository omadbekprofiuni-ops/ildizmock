from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone


class Plan(models.Model):
    """Tarif rejalari — Trial / Starter / Pro / Enterprise."""

    PLAN_CHOICES = [
        ('trial', 'Trial'),
        ('starter', 'Starter'),
        ('pro', 'Pro'),
        ('enterprise', 'Enterprise'),
    ]

    code = models.CharField(max_length=20, unique=True, choices=PLAN_CHOICES)
    name = models.CharField(max_length=100)
    max_students = models.IntegerField(default=5, help_text='-1 = cheksiz')
    max_teachers = models.IntegerField(default=1, help_text='-1 = cheksiz')
    duration_days = models.IntegerField(default=14)
    price_usd = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    features = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ['price_usd']

    def __str__(self):
        return self.name


class Organization(models.Model):
    """O'quv markaz."""

    STATUS_CHOICES = [
        ('trial', 'Trial'),
        ('active', 'Faol'),
        ('expired', 'Tarif tugagan'),
        ('blocked', 'Bloklangan'),
    ]

    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=64, unique=True)
    primary_color = models.CharField(max_length=7, default='#DC2626')
    logo = models.FileField(upload_to='org-logos/', null=True, blank=True)

    contact_phone = models.CharField(max_length=20, blank=True)
    contact_email = models.EmailField(blank=True)
    address = models.CharField(max_length=300, blank=True)

    plan = models.ForeignKey(Plan, on_delete=models.PROTECT, related_name='organizations')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='trial')
    plan_starts_at = models.DateTimeField(default=timezone.now)
    plan_expires_at = models.DateTimeField()

    notes = models.TextField(blank=True, help_text='Internal notes (only superadmin sees)')

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.name

    @property
    def is_active(self) -> bool:
        return self.status == 'active' and self.plan_expires_at > timezone.now()

    @property
    def days_remaining(self) -> int:
        delta = self.plan_expires_at - timezone.now()
        return max(0, delta.days)

    @property
    def students_count(self) -> int:
        return self.users.filter(role='student').count()

    @property
    def teachers_count(self) -> int:
        return self.users.filter(role='teacher').count()

    @property
    def admins_count(self) -> int:
        return self.users.filter(role='org_admin').count()

    def save(self, *args, **kwargs):
        if not self.plan_expires_at:
            self.plan_expires_at = self.plan_starts_at + timedelta(days=self.plan.duration_days)
        super().save(*args, **kwargs)


class OrganizationMembership(models.Model):
    """User ↔ Organization aloqasi (rol bilan).

    ETAP 2: User.organization (FK) bilan birga ishlaydi (parallel struktura).
    Existing data: post-migrate signal/data migration orqali avtomatik
    to'ldiriladi User.organization va User.role asosida.
    """

    ROLE_CHOICES = [
        ('owner', 'Owner'),
        ('admin', 'Admin'),
        ('teacher', 'Teacher'),
        ('student', 'Student'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='org_memberships',
    )
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE,
        related_name='memberships',
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('user', 'organization', 'role')]
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.user.username} @ {self.organization.slug} ({self.role})'


class StudentGroup(models.Model):
    """Talabalar guruhi (markaz ichida).

    O'qituvchilar guruhdagi talabalarni kuzatadi, admin esa
    guruhlar o'rtasida taqqoslaydi.
    """

    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE,
        related_name='student_groups',
    )
    name = models.CharField(
        max_length=100,
        help_text='Misol: IELTS 7.0, Group A, Beginner 1',
    )
    description = models.TextField(blank=True, default='')

    teacher = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='teaching_groups',
        limit_choices_to={'role': 'teacher'},
    )

    target_band_score = models.DecimalField(
        max_digits=3, decimal_places=1, null=True, blank=True,
        help_text='Maqsad band score (6.5, 7.0, 7.5...)',
    )
    class_schedule = models.CharField(max_length=200, blank=True, default='')

    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = [('organization', 'name')]

    def __str__(self):
        return f'{self.name} — {self.organization.slug}'


class Payment(models.Model):
    """To'lov tarixi (qo'lda belgilanadi superadmin tomonidan)."""

    STATUS_CHOICES = [
        ('pending', 'Kutilmoqda'),
        ('paid', 'To‘langan'),
        ('failed', 'Muvaffaqiyatsiz'),
        ('refunded', 'Qaytarilgan'),
    ]

    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name='payments',
    )
    plan = models.ForeignKey(Plan, on_delete=models.PROTECT)
    amount_usd = models.DecimalField(max_digits=8, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')

    marked_paid_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='marked_payments',
    )
    notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    paid_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.organization.name} · {self.plan.code} · ${self.amount_usd} · {self.status}'
