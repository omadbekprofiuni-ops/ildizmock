from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, phone, password, **extra):
        if not phone:
            raise ValueError('Telefon raqam majburiy')
        user = self.model(phone=phone, **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, phone, password=None, **extra):
        extra.setdefault('is_staff', False)
        extra.setdefault('is_superuser', False)
        return self._create_user(phone, password, **extra)

    def create_superuser(self, phone, password=None, **extra):
        extra.setdefault('is_staff', True)
        extra.setdefault('is_superuser', True)
        extra.setdefault('role', 'superadmin')
        return self._create_user(phone, password, **extra)


class User(AbstractUser):
    ROLE_CHOICES = [
        ('superadmin', 'Super Admin'),
        ('org_admin', 'Markaz Admin'),
        ('teacher', 'Ustoz'),
        ('student', 'Talaba'),
    ]
    LANGUAGE_CHOICES = [('uz', 'Uzbek'), ('ru', 'Russian'), ('en', 'English')]

    username = None
    phone = models.CharField(max_length=20, unique=True)
    telegram_id = models.BigIntegerField(null=True, blank=True, unique=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='student')
    target_band = models.DecimalField(max_digits=3, decimal_places=1, null=True, blank=True)
    language = models.CharField(max_length=2, choices=LANGUAGE_CHOICES, default='uz')
    created_at = models.DateTimeField(auto_now_add=True)

    organization = models.ForeignKey(
        'organizations.Organization',
        null=True, blank=True,
        related_name='users',
        on_delete=models.CASCADE,
        help_text='Foydalanuvchi tegishli bo‘lgan markaz. Superadmin uchun null.',
    )

    teacher = models.ForeignKey(
        'self', null=True, blank=True,
        related_name='students',
        on_delete=models.SET_NULL,
        limit_choices_to={'role': 'teacher'},
        help_text='Student → Teacher biriktirilgan (markaz ichida)',
    )

    USERNAME_FIELD = 'phone'
    REQUIRED_FIELDS = []
    objects = UserManager()

    def __str__(self):
        full = f'{self.first_name} {self.last_name}'.strip()
        return f'{full or self.phone} ({self.get_role_display()})'

    def clean(self):
        super().clean()
        from django.core.exceptions import ValidationError
        if self.role in ('org_admin', 'teacher', 'student') and not self.organization_id:
            raise ValidationError({'organization': 'Bu rol uchun markaz tanlash majburiy.'})
        if self.role == 'superadmin' and self.organization_id:
            raise ValidationError({'organization': 'Superadmin markazga tegishli emas.'})
        if self.teacher_id and self.role != 'student':
            raise ValidationError({'teacher': 'Faqat talaba uchun ustoz biriktiriladi.'})
        if self.teacher_id and self.teacher.organization_id != self.organization_id:
            raise ValidationError({'teacher': 'Ustoz boshqa markazdan bo‘lishi mumkin emas.'})
