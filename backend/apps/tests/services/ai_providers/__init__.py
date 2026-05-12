"""ETAP 16.7 + 16.8 — AI Provider abstraction.

Provider tanlash (priority):
  1. DB'dagi `AIProviderConfig.is_active=True` (ETAP 16.8 admin panel)
  2. `settings.AI_PROVIDER` + `settings.GEMINI_API_KEY` / `ANTHROPIC_API_KEY` (legacy fallback)

Yangi provider qo'shish uchun:
  1. `base.AIProvider`'dan meros qiluvchi klass yozing
  2. `_PROVIDER_CLASSES` mapping'iga qo'shing
  3. `AIProviderConfig.Provider` enum'ga value qo'shing
"""
from __future__ import annotations

import logging
from typing import Type

from django.conf import settings
from django.core.cache import cache

from .base import AIProvider, ParseResult, ProviderInfo

logger = logging.getLogger(__name__)


_ACTIVE_CACHE_KEY = 'ai_provider:active_config:v1'
_ACTIVE_CACHE_TTL = 60  # 1 daqiqa — tez-tez o'zgaradigan ma'lumot emas


def _provider_class(name: str) -> Type[AIProvider]:
    """Provider nomi → klass (lazy import — google-genai/anthropic ixtiyoriy)."""
    if name == 'gemini_aistudio':
        from .gemini_aistudio import GeminiAIStudioProvider

        return GeminiAIStudioProvider
    if name == 'claude_anthropic':
        from .claude_anthropic import ClaudeAnthropicProvider

        return ClaudeAnthropicProvider
    raise ValueError(f"Unknown AI provider: {name!r}")


def _get_active_config() -> dict | None:
    """DB'dan active config'ni cache bilan oladi.

    Return: `{provider, model_name, encrypted_api_key}` yoki `None`
    (agar DB'da hali config bo'lmasa yoki migration ishlamagan bo'lsa).
    """
    cached = cache.get(_ACTIVE_CACHE_KEY)
    if cached is not None:
        # `cached` "MISS" sentinel bo'lishi mumkin — bo'sh dict
        return cached or None

    try:
        from apps.tests.models import AIProviderConfig

        config = (
            AIProviderConfig.objects
            .filter(is_active=True)
            .exclude(encrypted_api_key='')
            .first()
        )
    except Exception:
        # Migration hali ishlamagan bo'lsa yoki DB tayyor emas
        cache.set(_ACTIVE_CACHE_KEY, {}, _ACTIVE_CACHE_TTL)
        return None

    if config is None:
        cache.set(_ACTIVE_CACHE_KEY, {}, _ACTIVE_CACHE_TTL)
        return None

    payload = {
        'provider': config.provider,
        'model_name': config.model_name,
        'encrypted_api_key': config.encrypted_api_key,
    }
    cache.set(_ACTIVE_CACHE_KEY, payload, _ACTIVE_CACHE_TTL)
    return payload


def invalidate_cache() -> None:
    """Config yangilanganda chaqiriladi — keyingi `get_ai_provider()` chaqirig'i
    DB'dan qayta o'qiydi."""
    cache.delete(_ACTIVE_CACHE_KEY)


def _build_from_env() -> AIProvider:
    """Legacy fallback — `.env` qiymatlari asosida provider yaratadi."""
    provider_name = getattr(settings, 'AI_PROVIDER', 'gemini_aistudio')
    if provider_name == 'gemini_aistudio':
        api_key = getattr(settings, 'GEMINI_API_KEY', '') or ''
        if not api_key:
            raise ValueError(
                "AI provider sozlanmagan. /super/settings/ai-providers/ "
                "sahifasida API key kiriting yoki .env'da GEMINI_API_KEY o'rnating.",
            )
        return _provider_class(provider_name)(api_key=api_key)
    if provider_name == 'claude_anthropic':
        api_key = getattr(settings, 'ANTHROPIC_API_KEY', '') or ''
        if not api_key:
            raise ValueError(
                "AI provider sozlanmagan. /super/settings/ai-providers/ "
                "sahifasida API key kiriting yoki .env'da ANTHROPIC_API_KEY o'rnating.",
            )
        return _provider_class(provider_name)(api_key=api_key)
    raise ValueError(f"Unknown AI_PROVIDER={provider_name!r}")


def get_ai_provider() -> AIProvider:
    """DB-first, env-fallback provider factory.

    Birinchi `AIProviderConfig.is_active=True` ni tekshiramiz. Topilmasa —
    `settings.AI_PROVIDER` + tegishli env key bilan ishlatamiz.
    """
    from .encryption_helpers import decrypt_db_key

    config = _get_active_config()
    if config is None:
        return _build_from_env()

    api_key = decrypt_db_key(config['encrypted_api_key'])
    return _provider_class(config['provider'])(
        api_key=api_key,
        model_name=config['model_name'] or '',
    )


__all__ = [
    'AIProvider',
    'ParseResult',
    'ProviderInfo',
    'get_ai_provider',
    'invalidate_cache',
]
