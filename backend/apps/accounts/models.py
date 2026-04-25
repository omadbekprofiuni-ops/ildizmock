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
        extra.setdefault('role', 'super_admin')
        return self._create_user(phone, password, **extra)


class User(AbstractUser):
    ROLE_CHOICES = [
        ('student', 'Student'),
        ('teacher', 'Teacher'),
        ('admin', 'Admin'),
        ('super_admin', 'Super Admin'),
    ]
    LANGUAGE_CHOICES = [('uz', 'Uzbek'), ('ru', 'Russian'), ('en', 'English')]

    username = None
    phone = models.CharField(max_length=20, unique=True)
    telegram_id = models.BigIntegerField(null=True, blank=True, unique=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='student')
    target_band = models.DecimalField(max_digits=2, decimal_places=1, null=True, blank=True)
    language = models.CharField(max_length=2, choices=LANGUAGE_CHOICES, default='uz')
    created_at = models.DateTimeField(auto_now_add=True)

    teacher = models.ForeignKey(
        'self', null=True, blank=True,
        related_name='students',
        on_delete=models.SET_NULL,
        limit_choices_to={'role': 'teacher'},
        help_text='Student → Teacher biriktirilgan',
    )

    USERNAME_FIELD = 'phone'
    REQUIRED_FIELDS = []
    objects = UserManager()

    def __str__(self):
        return self.phone

    def clean(self):
        super().clean()
        from django.core.exceptions import ValidationError
        if self.teacher_id and self.role != 'student':
            raise ValidationError({'teacher': 'Faqat student rolidagi user teacher biriktiradi.'})
        if self.teacher_id and self.teacher.role != 'teacher':
            raise ValidationError({'teacher': 'Biriktirilgan user role=teacher bo‘lishi shart.'})
