"""ETAP 8 — Billing & pricing modellari.

Har markaz uchun PricingTier (sessiyalar soniga qarab narxlar) va
BillingCycle (oylik/kvartal hisob-kitoblar). Har MockSession finished
bo'lganda `SessionBillingLog` avtomatik yaratiladi (signals.py).
"""

from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone


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
        default=Decimal('20000.00'),
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
    """Oylik/kvartal/yillik hisobot davri."""

    STATUS_CHOICES = [
        ('pending', 'To‘lanmagan'),
        ('paid', 'To‘langan'),
        ('overdue', 'Muddati o‘tgan'),
        ('cancelled', 'Bekor qilingan'),
    ]

    organization = models.ForeignKey(
        'organizations.Organization',
        on_delete=models.CASCADE,
        related_name='billing_cycles',
    )
    period_start = models.DateField()
    period_end = models.DateField()

    total_sessions = models.PositiveIntegerField(default=0)
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
    payment_method = models.CharField(max_length=50, blank=True, default='')
    payment_reference = models.CharField(max_length=100, blank=True, default='')
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

    class Meta:
        db_table = 'billing_cycles'
        ordering = ['-period_start']
        unique_together = [('organization', 'period_start', 'period_end')]

    def __str__(self):
        return (
            f'{self.organization.name} · {self.period_start}–{self.period_end} '
            f'({self.get_status_display()})'
        )

    def ensure_invoice_number(self):
        if not self.invoice_number:
            slug = (self.organization.slug or 'org')[:6].upper()
            self.invoice_number = (
                f'INV-{self.period_start.strftime("%Y%m")}-{slug}-{self.pk:04d}'
            )
            self.invoice_generated_at = timezone.now()
            self.save(update_fields=['invoice_number', 'invoice_generated_at'])


class SessionBillingLog(models.Model):
    """Har MockSession yakuniga yetganda yaratiladigan billing log."""

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
