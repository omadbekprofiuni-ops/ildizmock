"""ETAP 17 — mavjud organizatsiyalar uchun default pay_per_test obunani yaratish."""

from decimal import Decimal

from django.db import migrations


def seed_default_subscriptions(apps, schema_editor):
    Organization = apps.get_model('organizations', 'Organization')
    SubscriptionTier = apps.get_model('billing', 'SubscriptionTier')

    new_tiers = []
    for org in Organization.objects.all():
        if SubscriptionTier.objects.filter(organization=org).exists():
            continue
        new_tiers.append(SubscriptionTier(
            organization=org,
            plan_type='pay_per_test',
            monthly_price=Decimal('0'),
            monthly_quota=None,
            pay_per_test_threshold=100,
            pay_per_test_first_price=Decimal('30000.00'),
            pay_per_test_after_price=Decimal('50000.00'),
            is_active=True,
        ))
    SubscriptionTier.objects.bulk_create(new_tiers)


def remove_seeded_subscriptions(apps, schema_editor):
    SubscriptionTier = apps.get_model('billing', 'SubscriptionTier')
    SubscriptionTier.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('billing', '0003_subscriptiontier'),
    ]

    operations = [
        migrations.RunPython(seed_default_subscriptions, remove_seeded_subscriptions),
    ]
