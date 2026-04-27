"""MockSession yakunlanganda billing log avtomatik yaratiladi."""

from decimal import Decimal

from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender='mock.MockSession')
def log_session_billing(sender, instance, created, **kwargs):
    if created or instance.status != 'finished':
        return

    from apps.mock.models import MockSession

    from .models import PricingTier, SessionBillingLog

    if SessionBillingLog.objects.filter(session=instance).exists():
        return

    org = instance.organization
    if not org:
        return

    pricing = getattr(org, 'pricing_tier', None)
    if pricing is None:
        pricing = PricingTier.objects.create(organization=org)

    finished_count = MockSession.objects.filter(
        organization=org, status='finished',
    ).count()
    price = pricing.price_for_count(finished_count)

    SessionBillingLog.objects.create(
        session=instance,
        price_per_session=Decimal(price),
        participant_count=instance.participants.count(),
    )
