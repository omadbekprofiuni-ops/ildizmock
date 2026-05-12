"""ETAP 16.8 — seed AIProviderConfig rows va `.env` API kalitlarini DB'ga
ko'chiradi (shifrlangan holda).

Encryption kalit (`AI_PROVIDER_ENCRYPTION_KEY`) hali `.env`'da bo'lmasa,
migration provider rows'ni encrypted_api_key="" bilan yaratadi — superadmin
keyin panel orqali key kiritadi.
"""
from django.conf import settings
from django.db import migrations


def _maybe_encrypt(plain):
    """Plain API key → (encrypted, last4). Encryption kalit yo'q bo'lsa ('', '')."""
    if not plain:
        return '', ''
    try:
        from apps.tests.services.encryption import encrypt_api_key, last4

        return encrypt_api_key(plain), last4(plain)
    except Exception:  # noqa: BLE001 — encryption kaliti yo'q yoki bo'sh
        return '', ''


def seed_configs(apps, schema_editor):
    AIProviderConfig = apps.get_model('tests', 'AIProviderConfig')

    gemini_key = (getattr(settings, 'GEMINI_API_KEY', '') or '').strip()
    claude_key = (getattr(settings, 'ANTHROPIC_API_KEY', '') or '').strip()
    active_provider = getattr(settings, 'AI_PROVIDER', 'gemini_aistudio')

    gemini_enc, gemini_last4 = _maybe_encrypt(gemini_key)
    claude_enc, claude_last4 = _maybe_encrypt(claude_key)

    AIProviderConfig.objects.update_or_create(
        provider='gemini_aistudio',
        defaults={
            'model_name': 'gemini-2.5-flash',
            'encrypted_api_key': gemini_enc,
            'api_key_last4': gemini_last4,
            'is_active': active_provider == 'gemini_aistudio' and bool(gemini_enc),
        },
    )

    AIProviderConfig.objects.update_or_create(
        provider='claude_anthropic',
        defaults={
            'model_name': 'claude-sonnet-4-6',
            'encrypted_api_key': claude_enc,
            'api_key_last4': claude_last4,
            'is_active': active_provider == 'claude_anthropic' and bool(claude_enc),
        },
    )


def unseed(apps, schema_editor):
    AIProviderConfig = apps.get_model('tests', 'AIProviderConfig')
    AIProviderConfig.objects.filter(
        provider__in=['gemini_aistudio', 'claude_anthropic'],
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('tests', '0019_aiproviderconfig_aiproviderauditlog'),
    ]

    operations = [
        migrations.RunPython(seed_configs, unseed),
    ]
