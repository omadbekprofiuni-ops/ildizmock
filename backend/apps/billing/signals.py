"""ETAP 17 — MockSession finished bo'lganda har talabaga charge yaratiladi.

Charge summasi `SubscriptionTier`'ga qarab progressiv hisoblanadi:
  - pay_per_test: 1–threshold gacha 30k, undan keyin 50k
  - starter: monthly_quota ichida 0, undan keyin 50k
  - pro/enterprise: cheksiz quota → har doim 0

Aktiv obuna bo'lmasa default 30k flat (eski xulq).
"""

from decimal import Decimal

from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone

DEFAULT_AMOUNT = Decimal('30000.00')


@receiver(post_save, sender='mock.MockSession')
def create_charges_on_finalize(sender, instance, created, **kwargs):
    if created or instance.status != 'finished':
        return
    if not instance.organization_id:
        return

    from .models import MockSessionCharge, SubscriptionTier

    if MockSessionCharge.objects.filter(session=instance).exists():
        return

    participants = list(instance.participants.all())
    if not participants:
        return

    tier = (
        SubscriptionTier.objects
        .filter(organization_id=instance.organization_id, is_active=True)
        .first()
    )

    today = timezone.now().date()
    month_start = today.replace(day=1)

    if tier is None:
        amounts = [DEFAULT_AMOUNT for _ in participants]
    else:
        # Bu organization uchun hozirgacha qancha test charge qilingan
        total_count = MockSessionCharge.objects.filter(
            session__organization_id=instance.organization_id,
            is_charged=True,
        ).count()

        # Joriy oydagi charged count
        month_count = MockSessionCharge.objects.filter(
            session__organization_id=instance.organization_id,
            is_charged=True,
            charged_at__date__gte=month_start,
        ).count()

        amounts = []
        for _ in participants:
            amounts.append(
                tier.amount_for_next_charge(
                    total_charged_count=total_count,
                    month_charged_count=month_count,
                )
            )
            total_count += 1
            month_count += 1

    bulk = [
        MockSessionCharge(
            session=instance,
            participant=p,
            amount=amount,
            is_charged=amount > 0,
        )
        for p, amount in zip(participants, amounts)
    ]
    with transaction.atomic():
        MockSessionCharge.objects.bulk_create(bulk)
