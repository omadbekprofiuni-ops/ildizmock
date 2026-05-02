# ETAP 22 — Pricing tier_1 default: 20000 -> 30000

from decimal import Decimal
from django.db import migrations, models


def update_existing_20k(apps, schema_editor):
    """Mavjud 20,000 qiymatdagi yozuvlarni 30,000 ga yangilash."""
    PricingTier = apps.get_model('billing', 'PricingTier')
    PricingTier.objects.filter(
        price_per_session_tier_1=Decimal('20000.00'),
    ).update(price_per_session_tier_1=Decimal('30000.00'))


def reverse_noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('billing', '0004_seed_default_subscriptions'),
    ]

    operations = [
        migrations.AlterField(
            model_name='pricingtier',
            name='price_per_session_tier_1',
            field=models.DecimalField(decimal_places=2, default=Decimal('30000.00'), help_text='0–100 sessiya: bitta sessiya narxi (so‘m)', max_digits=10),
        ),
        migrations.RunPython(update_existing_20k, reverse_noop),
    ]
