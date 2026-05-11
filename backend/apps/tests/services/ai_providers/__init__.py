"""ETAP 16.7 — AI Provider abstraction.

Provider tanlash:
  settings.AI_PROVIDER (default: 'gemini_aistudio')

Yangi provider qo'shish uchun:
  1. `base.AIProvider`'dan meros qiluvchi klass yozing
  2. Quyidagi `_PROVIDERS` mapping'iga qo'shing
"""
from __future__ import annotations

from typing import Callable

from django.conf import settings

from .base import AIProvider, ParseResult, ProviderInfo


def _build_gemini() -> AIProvider:
    from .gemini_aistudio import GeminiAIStudioProvider

    return GeminiAIStudioProvider()


def _build_claude() -> AIProvider:
    from .claude_anthropic import ClaudeAnthropicProvider

    return ClaudeAnthropicProvider()


_PROVIDERS: dict[str, Callable[[], AIProvider]] = {
    'gemini_aistudio': _build_gemini,
    'claude_anthropic': _build_claude,
}


def get_ai_provider() -> AIProvider:
    """Settings'dagi `AI_PROVIDER` asosida provider qaytaradi.

    Default: `gemini_aistudio` (ETAP 16.7 spec).
    `AI_PROVIDER` noma'lum bo'lsa ValueError.
    """
    name = getattr(settings, 'AI_PROVIDER', 'gemini_aistudio')
    builder = _PROVIDERS.get(name)
    if builder is None:
        raise ValueError(
            f"Unknown AI_PROVIDER={name!r}. "
            f"Mavjudlari: {sorted(_PROVIDERS)}"
        )
    return builder()


__all__ = ['AIProvider', 'ParseResult', 'ProviderInfo', 'get_ai_provider']
