"""ETAP 8 — Billing & pricing modellari.

Har markaz uchun PricingTier (sessiyalar soniga qarab narxlar) va
BillingCycle (oylik/kvartal hisob-kitoblar). Har MockSession finished
bo'lganda `SessionBillingLog` avtomatik yaratiladi (signals.py).
"""

from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone


class SubscriptionTier(models.Model):
    """ETAP 17 — Markazning aktiv obuna rejasi.

    Reja turlari:
    - pay_per_test: Default. Har test uchun progressiv narx
      (1–threshold gacha first_price, undan keyin after_price).
    - starter: Oylik obuna, monthly_quota chegarasi ichida bepul,
      undan keyin after_price.
    - pro: Oylik obuna, cheksiz testlar (monthly_quota=NULL).
    - enterprise: Maxsus shartnoma (custom narx/limit).
    """

    PLAN_CHOICES = [
        ('pay_per_test', 'Pay Per Test'),
        ('starter', 'Center Starter'),
        ('pro', 'Center Pro'),
        ('enterprise', 'Enterprise'),
    ]

    organization = models.OneToOneField(
        'organizations.Organization',
        on_delete=models.CASCADE,
        related_name='subscription_tier',
    )

    plan_type = models.CharField(
        max_length=20,
        choices=PLAN_CHOICES,
        default='pay_per_test',
    )

    monthly_price = models.DecimalField(
        max_digits=12, decimal_places=2,
        default=Decimal('0'),
        help_text='Oylik obuna narxi (pay_per_test uchun 0)',
    )
    monthly_quota = models.PositiveIntegerField(
        null=True, blank=True,
        help_text='Oyda nechta mock test (NULL = cheksiz)',
    )

    # Pay-per-test progressive pricing
    pay_per_test_threshold = models.PositiveIntegerField(
        default=100,
        help_text='Progressiv narx chegarasi (umumiy hisoblangan testlar)',
    )
    pay_per_test_first_price = models.DecimalField(
        max_digits=10, decimal_places=2,
        default=Decimal('30000.00'),
        help_text='Threshold ichidagi har test narxi',
    )
    pay_per_test_after_price = models.DecimalField(
        max_digits=10, decimal_places=2,
        default=Decimal('50000.00'),
        help_text='Threshold dan keyingi har test narxi',
    )

    starts_at = models.DateField(default=timezone.now)
    ends_at = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'subscription_tiers'

    def __str__(self):
        return f'{self.organization.name} · {self.get_plan_type_display()}'

    def amount_for_next_charge(self, total_charged_count: int,
                                month_charged_count: int) -> Decimal:
        """Keyingi MockSessionCharge uchun amount hisoblash.

        - pay_per_test: total_charged_count threshold dan past bo'lsa
          first_price, aks holda after_price.
        - starter: month_charged_count quota dan past bo'lsa 0
          (subscription qoplaydi), aks holda after_price.
        - pro / enterprise (quota=None): har doim 0.
        """
        if self.plan_type == 'pay_per_test':
            if total_charged_count < self.pay_per_test_threshold:
                return self.pay_per_test_first_price
            return self.pay_per_test_after_price

        # Subscription plans
        if self.monthly_quota is None:
            return Decimal('0')
        if month_charged_count < self.monthly_quota:
            return Decimal('0')
        return self.pay_per_test_after_price


class PricingTier(models.Model):
    """Markaz uchun individual narx jadvallari (so'mda)."""

    PERIOD_CHOICES = [
        ('monthly', 'Oylik'),
        ('quarterly', 'Kvartal'),
        ('annual', 'Yillik'),
    ]

    organization = models.OneToOneField(
        'organizations.Organization',
        on_delete=models.CASCADE,
        related_name='pricing_tier',
    )

    price_per_session_tier_1 = models.DecimalField(
        max_digits=10, decimal_places=2,
        default=Decimal('30000.00'),
        help_text='0–100 sessiya: bitta sessiya narxi (so‘m)',
    )
    price_per_session_tier_2 = models.DecimalField(
        max_digits=10, decimal_places=2,
        default=Decimal('15000.00'),
        help_text='101–500 sessiya: bitta sessiya narxi',
    )
    price_per_session_tier_3 = models.DecimalField(
        max_digits=10, decimal_places=2,
        default=Decimal('10000.00'),
        help_text='501+ sessiya: bitta sessiya narxi',
    )

    contract_start_date = models.DateField(null=True, blank=True)
    contract_end_date = models.DateField(null=True, blank=True)

    payment_period = models.CharField(
        max_length=20, choices=PERIOD_CHOICES, default='monthly',
    )
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'pricing_tiers'

    def __str__(self):
        return f'{self.organization.name} pricing'

    def price_for_count(self, count: int) -> Decimal:
        if count <= 100:
            return self.price_per_session_tier_1
        if count <= 500:
            return self.price_per_session_tier_2
        return self.price_per_session_tier_3


class BillingCycle(models.Model):
    """Oylik hisobot davri (ETAP 16: month+year asoslangan).

    `period_start`/`period_end` legacy uchun saqlanadi (ETAP 8). Yangi
    yondashuv `year` + `month` orqali aniqlanadi.
    """

    STATUS_CHOICES = [
        ('pending', 'To‘lanmagan'),
        ('paid', 'To‘langan'),
        ('overdue', 'Muddati o‘tgan'),
        ('cancelled', 'Bekor qilingan'),
    ]

    PAYMENT_METHOD_CHOICES = [
        ('cash', 'Naqd'),
        ('bank_transfer', 'Bank o‘tkazmasi'),
        ('card', 'Karta'),
        ('other', 'Boshqa'),
    ]

    organization = models.ForeignKey(
        'organizations.Organization',
        on_delete=models.CASCADE,
        related_name='billing_cycles',
    )

    # ETAP 8 legacy
    period_start = models.DateField(null=True, blank=True)
    period_end = models.DateField(null=True, blank=True)

    # ETAP 16 — month/year asosida tracking
    year = models.IntegerField(null=True, blank=True, db_index=True)
    month = models.IntegerField(
        null=True, blank=True,
        help_text='1-12',
    )

    total_sessions = models.PositiveIntegerField(
        default=0,
        help_text='Bu davrda yakunlangan mock sessiyalar (charge yaratilgan)',
    )
    total_students = models.PositiveIntegerField(
        default=0,
        help_text='Charge qilingan unique talabalar soni',
    )
    total_amount = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal('0'),
    )

    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='pending',
    )
    paid_amount = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal('0'),
    )
    paid_at = models.DateTimeField(null=True, blank=True)
    payment_method = models.CharField(
        max_length=20, blank=True, default='',
        choices=PAYMENT_METHOD_CHOICES + [('', '—')],
    )
    payment_reference = models.CharField(max_length=100, blank=True, default='')
    payment_date = models.DateField(null=True, blank=True)
    marked_paid_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='marked_billing_cycles',
    )

    invoice_number = models.CharField(
        max_length=50, blank=True, default='',
    )
    invoice_generated_at = models.DateTimeField(null=True, blank=True)

    notes = models.TextField(blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='created_billing_cycles',
    )

    class Meta:
        db_table = 'billing_cycles'
        ordering = ['-year', '-month', '-period_start']
        unique_together = [('organization', 'period_start', 'period_end')]
        indexes = [
            models.Index(fields=['organization', 'status']),
            models.Index(fields=['year', 'month']),
        ]

    def __str__(self):
        if self.year and self.month:
            return (
                f'{self.organization.name} · {self.year}-{self.month:02d} '
                f'({self.get_status_display()})'
            )
        return (
            f'{self.organization.name} · {self.period_start}–{self.period_end} '
            f'({self.get_status_display()})'
        )

    @property
    def period_label(self) -> str:
        if self.year and self.month:
            return f'{self.year}-{self.month:02d}'
        if self.period_start:
            return self.period_start.strftime('%Y-%m')
        return '—'

    def ensure_invoice_number(self):
        if not self.invoice_number:
            slug = (self.organization.slug or 'org')[:6].upper()
            year = self.year or (self.period_start.year if self.period_start else timezone.now().year)
            month = self.month or (self.period_start.month if self.period_start else timezone.now().month)
            self.invoice_number = (
                f'INV-{year}-{month:02d}-{slug}-{self.pk:04d}'
            )
            self.invoice_generated_at = timezone.now()
            self.save(update_fields=['invoice_number', 'invoice_generated_at'])

    def calculate_totals(self):
        """ETAP 16 — MockSessionCharge'lardan total'larni qayta hisoblash."""
        from django.db.models import Sum
        charges = self.mock_charges.filter(is_charged=True)
        self.total_sessions = charges.values('session').distinct().count()
        self.total_students = charges.values('participant').count()
        self.total_amount = charges.aggregate(s=Sum('amount'))['s'] or Decimal('0')
        self.save(update_fields=['total_sessions', 'total_students',
                                 'total_amount', 'updated_at'])

    def mark_as_paid(self, *, payment_method, payment_date, amount_paid,
                     marked_paid_by=None, notes=''):
        """ETAP 16 — to'langan deb belgilash + PaymentHistory yaratish."""
        from decimal import Decimal as _D
        self.status = 'paid'
        self.payment_method = payment_method or ''
        self.payment_date = payment_date
        self.paid_at = timezone.now()
        self.paid_amount = _D(str(amount_paid)) if amount_paid is not None else self.total_amount
        if marked_paid_by:
            self.marked_paid_by = marked_paid_by
        if notes:
            self.notes = notes
        self.save()
        self.ensure_invoice_number()

        PaymentHistory.objects.create(
            organization=self.organization,
            billing_cycle=self,
            amount_paid=self.paid_amount,
            payment_method=payment_method or 'other',
            payment_date=payment_date,
            received_by=marked_paid_by,
            notes=notes,
        )


class MockSessionCharge(models.Model):
    """ETAP 16 — har talaba uchun mock sessiyada hisoblanadigan summa.

    Default 30,000 so'm flat. session+participant unique bo'lishi kerak.
    is_charged=False — bepul/test sessiyalar uchun.
    """

    session = models.ForeignKey(
        'mock.MockSession',
        on_delete=models.CASCADE,
        related_name='mock_charges',
    )
    participant = models.ForeignKey(
        'mock.MockParticipant',
        on_delete=models.CASCADE,
        related_name='mock_charges',
    )

    amount = models.DecimalField(
        max_digits=10, decimal_places=2,
        default=Decimal('30000.00'),
    )
    is_charged = models.BooleanField(
        default=True,
        help_text='False — bepul/test sessiya, billing\'da hisoblanmaydi',
    )

    billing_cycle = models.ForeignKey(
        'BillingCycle',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='mock_charges',
    )

    charged_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'mock_session_charges'
        ordering = ['-charged_at']
        unique_together = [('session', 'participant')]
        indexes = [
            models.Index(fields=['billing_cycle', 'is_charged']),
            models.Index(fields=['session', 'participant']),
        ]

    def __str__(self):
        return (
            f'{self.participant.full_name} · {self.session.name} · '
            f'{self.amount:,.0f} so\'m'
        )


class PaymentHistory(models.Model):
    """ETAP 16 — markaz to'lov tarixi (har bir to'lov yozuvi)."""

    PAYMENT_METHOD_CHOICES = [
        ('cash', 'Naqd'),
        ('bank_transfer', 'Bank o‘tkazmasi'),
        ('card', 'Karta'),
        ('other', 'Boshqa'),
    ]

    organization = models.ForeignKey(
        'organizations.Organization',
        on_delete=models.CASCADE,
        related_name='payment_history',
    )
    billing_cycle = models.ForeignKey(
        BillingCycle,
        on_delete=models.CASCADE,
        related_name='payments',
    )

    amount_paid = models.DecimalField(max_digits=12, decimal_places=2)
    payment_method = models.CharField(
        max_length=20, choices=PAYMENT_METHOD_CHOICES,
    )
    payment_date = models.DateField()
    receipt_number = models.CharField(max_length=50, blank=True, default='')

    received_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='received_payments',
    )
    notes = models.TextField(blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'payment_history'
        ordering = ['-payment_date', '-created_at']
        verbose_name = 'To\'lov tarixi'
        verbose_name_plural = 'To\'lov tarixi'

    def __str__(self):
        return (
            f'{self.organization.name} · {self.payment_date} · '
            f'{self.amount_paid:,.0f} so\'m'
        )


class SessionBillingLog(models.Model):
    """ETAP 8 LEGACY — Har MockSession yakuniga yetganda yaratiladigan billing log.

    ETAP 16 dan boshlab MockSessionCharge ishlatiladi (per-participant).
    Bu model eski ma'lumotlar uchun saqlanadi, yangi sessiya'larda
    avtomatik yaratilmaydi.
    """

    session = models.OneToOneField(
        'mock.MockSession',
        on_delete=models.CASCADE,
        related_name='billing_log',
    )
    billing_cycle = models.ForeignKey(
        BillingCycle,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='session_logs',
    )

    price_per_session = models.DecimalField(max_digits=10, decimal_places=2)
    participant_count = models.PositiveIntegerField(default=0)

    is_billed = models.BooleanField(default=False)
    billed_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'session_billing_logs'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.session_id} · {self.price_per_session} so‘m'
