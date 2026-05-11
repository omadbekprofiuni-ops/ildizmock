from django.conf import settings
from django.db import models


class B2CProfile(models.Model):
    """Individual (B2C) foydalanuvchi profili.

    Markazga bog'lanmagan oxirgi foydalanuvchi uchun qo'shimcha ma'lumotlar.
    `accounts.User` modeliga 1:1 bog'langan; `User.role='b2c_user'` bo'lganlarga
    ushbu profil yaratiladi.
    """

    LANGUAGE_CHOICES = [
        ('uz', "O'zbek"),
        ('ru', 'Русский'),
        ('en', 'English'),
    ]
    SIGNUP_SOURCE_CHOICES = [
        ('email', 'Email'),
        ('google', 'Google'),
        ('admin', 'Admin'),
    ]

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='b2c_profile',
    )
    phone_number = models.CharField(max_length=20, blank=True)
    preferred_language = models.CharField(
        max_length=2, choices=LANGUAGE_CHOICES, default='uz',
    )
    signup_source = models.CharField(
        max_length=10, choices=SIGNUP_SOURCE_CHOICES, default='email',
    )
    has_completed_onboarding = models.BooleanField(default=False)
    # ETAP 16-17 uchun reserve; hozircha bo'sh string ham bo'lishi mumkin.
    target_exam = models.CharField(max_length=50, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'B2C profile'
        verbose_name_plural = 'B2C profiles'

    def __str__(self) -> str:
        return f'B2C: {self.user.email or self.user.username}'
