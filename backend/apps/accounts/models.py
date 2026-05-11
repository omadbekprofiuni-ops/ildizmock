from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, username, password, **extra):
        if not username:
            raise ValueError('Username required')
        username = username.lower().strip()
        user = self.model(username=username, **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, username, password=None, **extra):
        extra.setdefault('is_staff', False)
        extra.setdefault('is_superuser', False)
        return self._create_user(username, password, **extra)

    def create_superuser(self, username, password=None, **extra):
        extra.setdefault('is_staff', True)
        extra.setdefault('is_superuser', True)
        extra.setdefault('role', 'superadmin')
        return self._create_user(username, password, **extra)


class User(AbstractUser):
    ROLE_CHOICES = [
        ('superadmin', 'Super Admin'),
        ('org_admin', 'Center Admin'),
        ('teacher', 'Teacher'),
        ('student', 'Student'),
        # ETAP 14 — B2C individual user (markazga bog'lanmagan).
        ('b2c_user', 'Individual (B2C)'),
    ]
    B2B_ROLES = ('org_admin', 'teacher', 'student')
    LANGUAGE_CHOICES = [('uz', 'Uzbek'), ('ru', 'Russian'), ('en', 'English')]

    # MUHIM: AbstractUser allaqachon username field bor, ammo unique va max_length=150.
    # Override qilamiz qisqaroq + lowercase.
    username = models.CharField(max_length=50, unique=True, db_index=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    telegram_id = models.BigIntegerField(null=True, blank=True, unique=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='student')
    target_band = models.DecimalField(max_digits=3, decimal_places=1, null=True, blank=True)
    language = models.CharField(max_length=2, choices=LANGUAGE_CHOICES, default='uz')
    must_change_password = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    organization = models.ForeignKey(
        'organizations.Organization',
        null=True, blank=True,
        related_name='users',
        on_delete=models.CASCADE,
    )
    teacher = models.ForeignKey(
        'self', null=True, blank=True,
        related_name='students',
        on_delete=models.SET_NULL,
        limit_choices_to={'role': 'teacher'},
    )
    group = models.ForeignKey(
        'organizations.StudentGroup', null=True, blank=True,
        related_name='members',
        on_delete=models.SET_NULL,
    )
    enrolled_at = models.DateField(null=True, blank=True)

    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = []
    objects = UserManager()

    def __str__(self):
        return f'{self.username} ({self.get_role_display()})'

    @property
    def is_b2c(self) -> bool:
        return self.role == 'b2c_user'

    @property
    def is_b2b(self) -> bool:
        return self.role in self.B2B_ROLES

    def clean(self):
        super().clean()
        from django.core.exceptions import ValidationError
        if self.role in self.B2B_ROLES and not self.organization_id:
            raise ValidationError({'organization': 'Center is required for this role.'})
        if self.role in ('superadmin', 'b2c_user') and self.organization_id:
            raise ValidationError(
                {'organization': 'Superadmin/B2C user must not be linked to a center.'},
            )
        if self.teacher_id and self.role != 'student':
            raise ValidationError({'teacher': 'Only students can have a teacher assigned.'})
        if self.teacher_id and self.teacher.organization_id != self.organization_id:
            raise ValidationError({'teacher': 'Teacher must belong to the same center.'})
