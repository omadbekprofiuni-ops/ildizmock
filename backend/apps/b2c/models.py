import secrets
import string

from django.conf import settings
from django.db import models


# ETAP 17/19 — B2C credit system uchun default'lar
B2C_SIGNUP_BONUS_CREDITS = 3


def generate_promo_code(length: int = 8) -> str:
    """Adashtiruvchi belgilarsiz (O/0, I/1, l) tasodifiy promo kod."""
    alphabet = (string.ascii_uppercase + string.digits)
    for bad in ('O', '0', 'I', '1', 'L'):
        alphabet = alphabet.replace(bad, '')
    return ''.join(secrets.choice(alphabet) for _ in range(length))


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


class CreditBalance(models.Model):
    """B2C foydalanuvchining hozirgi balansi.

    Denormalized cache. Source of truth — CreditTransaction.
    Har bir spend/grant CreditTransaction yaratadi va shu balansni atomic ravishda yangilaydi.
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='credit_balance',
    )
    balance = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Credit balance'
        verbose_name_plural = 'Credit balances'

    def __str__(self) -> str:
        return f'{self.user.username}: {self.balance} credits'


class CreditTransaction(models.Model):
    """Har bir credit harakati — immutable audit log."""

    class Kind(models.TextChoices):
        SIGNUP_BONUS = 'signup_bonus', 'Ro‘yxatdan o‘tish bonusi'
        ADMIN_GRANT = 'admin_grant', 'Admin grant'
        ADMIN_DEDUCT = 'admin_deduct', 'Admin deduct'
        PURCHASE = 'purchase', 'Sotib olish'
        SPEND = 'spend', 'Test uchun foydalanish'
        REFUND = 'refund', 'Refund'
        PROMO_CODE = 'promo_code', 'Promo kod'

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='credit_transactions',
    )
    kind = models.CharField(max_length=20, choices=Kind.choices, db_index=True)
    # Musbat = balansga qo'shildi, manfiy = ayirildi
    amount = models.IntegerField()
    balance_after = models.PositiveIntegerField()
    note = models.TextField(blank=True, default='')

    # Tegishli ma'lumotlar (FK lar — ETAP 17/18 da qo'shiladi: package, attempt, promo)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='created_credit_transactions',
        help_text='Admin grant uchun — kim qildi',
    )

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['user', '-created_at'])]
        verbose_name = 'Credit transaction'
        verbose_name_plural = 'Credit transactions'

    def __str__(self) -> str:
        sign = '+' if self.amount >= 0 else ''
        return f'{self.user.username} {sign}{self.amount} ({self.get_kind_display()})'


class CreditPromoCode(models.Model):
    """Bepul kredit promo kodlari.

    Super-admin yaratadi; B2C user qabul qilib kredit oladi.
    Bir user bitta promo kodni faqat bir marta ishlatishi mumkin
    (CreditPromoCodeRedemption.unique_together orqali).
    """
    code = models.CharField(max_length=20, unique=True, db_index=True)
    description = models.CharField(max_length=200, blank=True, default='')
    credits_amount = models.PositiveIntegerField()

    max_uses = models.PositiveIntegerField(
        null=True, blank=True,
        help_text='Bo‘sh qoldirilsa cheksiz',
    )
    uses_count = models.PositiveIntegerField(default=0)

    valid_from = models.DateTimeField(null=True, blank=True)
    valid_until = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='created_promo_codes',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Credit promo code'
        verbose_name_plural = 'Credit promo codes'

    def __str__(self) -> str:
        return f'{self.code} (+{self.credits_amount})'

    @property
    def is_redeemable(self) -> bool:
        from django.utils import timezone
        if not self.is_active:
            return False
        now = timezone.now()
        if self.valid_from and now < self.valid_from:
            return False
        if self.valid_until and now > self.valid_until:
            return False
        if self.max_uses is not None and self.uses_count >= self.max_uses:
            return False
        return True


class CreditPromoCodeRedemption(models.Model):
    """Promo kod ishlatilishi (har user — bir marta)."""
    promo_code = models.ForeignKey(
        CreditPromoCode, on_delete=models.CASCADE, related_name='redemptions',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='promo_redemptions',
    )
    credit_transaction = models.ForeignKey(
        CreditTransaction,
        on_delete=models.SET_NULL,
        null=True, blank=True,
    )
    redeemed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('promo_code', 'user')]
        ordering = ['-redeemed_at']
