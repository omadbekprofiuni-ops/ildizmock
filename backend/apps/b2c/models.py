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
    target_band = models.DecimalField(
        max_digits=3, decimal_places=1, null=True, blank=True,
    )
    exam_date = models.DateField(null=True, blank=True)
    weekly_goal_sessions = models.PositiveSmallIntegerField(default=5)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'B2C profile'
        verbose_name_plural = 'B2C profiles'

    def __str__(self) -> str:
        return f'B2C: {self.user.email or self.user.username}'


class B2CActivityEvent(models.Model):
    """B2C user'ning har bir mashq sessiyasi (section yoki full mock) yakunlandi.

    Heatmap, streak va haftalik progress shu modeldan aggregatsiyalanadi.
    ETAP 14'da model yaratiladi; haqiqiy yozish keyingi etaplarda
    (test/sessiya integratsiyasi) qo'shiladi. Hozircha admin yoki shell
    orqali test data kiritiladi.
    """
    SECTION_CHOICES = [
        ('listening', 'Listening'),
        ('reading', 'Reading'),
        ('writing', 'Writing'),
        ('full', 'Full Mock'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='b2c_activity_events',
    )
    section = models.CharField(max_length=20, choices=SECTION_CHOICES)
    minutes_spent = models.PositiveSmallIntegerField(default=0)
    score = models.DecimalField(
        max_digits=4, decimal_places=1, null=True, blank=True,
    )
    activity_date = models.DateField(db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=['user', 'activity_date'])]
        ordering = ['-activity_date', '-created_at']
        verbose_name = 'B2C activity event'
        verbose_name_plural = 'B2C activity events'

    def __str__(self) -> str:
        return f'{self.user.email or self.user.username} — {self.section} — {self.activity_date}'
