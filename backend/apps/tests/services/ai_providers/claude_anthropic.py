"""ETAP 16.7 — Claude (Anthropic) provider.

Claude Sonnet 4.6 PDF document blocks'ni native qo'llab-quvvatlaydi —
shuning uchun PDF'ni to'g'ridan-to'g'ri yuboramiz. Schema'ni system
prompt'ga qadoqlaymiz, model JSON-only qaytaradi.

Setup:
  .env: ANTHROPIC_API_KEY=sk-ant-...
  settings.AI_PROVIDER=claude_anthropic
"""
from __future__ import annotations

import base64
import json
import logging
from typing import Optional

from django.conf import settings

from .base import (
    IELTS_RESPONSE_SHAPE,
    SYSTEM_PROMPT,
    AIProvider,
    ParseResult,
    ProviderInfo,
)

logger = logging.getLogger(__name__)


CLAUDE_SYSTEM_PROMPT = (
    SYSTEM_PROMPT
    + '\n\nJSON quyidagi shape\'ga aniq mos kelishi kerak:\n'
    + json.dumps(IELTS_RESPONSE_SHAPE, indent=2, ensure_ascii=False)
)


class ClaudeAnthropicProvider(AIProvider):
    """Claude Sonnet 4.6 — Anthropic SDK orqali PDF document blocks."""

    MODEL_NAME = 'claude-sonnet-4-6'

    # Claude Sonnet 4.6 paid-tier narxlari ($/M token)
    INPUT_USD_PER_M = 3.00
    OUTPUT_USD_PER_M = 15.00

    def __init__(self) -> None:
        api_key = getattr(settings, 'ANTHROPIC_API_KEY', '') or ''
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY .env'da o'rnatilmagan")
        import anthropic  # noqa: PLC0415 — provider boshqa joyda ishlatilmasa, import qilmaymiz

        self._anthropic = anthropic
        self.client = anthropic.Anthropic(api_key=api_key)

    def parse_ielts_pdf(
        self,
        pdf_bytes: bytes,
        *,
        hint_section_type: Optional[str] = None,
    ) -> ParseResult:
        user_text = "Quyidagi IELTS test PDF'ini parse qiling va JSON qaytaring."
        if hint_section_type:
            user_text += f"\n\nHint: bu test {hint_section_type} bo'limi uchun."

        pdf_b64 = base64.standard_b64encode(pdf_bytes).decode('ascii')

        try:
            resp = self.client.messages.create(
                model=self.MODEL_NAME,
                max_tokens=8000,
                temperature=0.1,
                system=CLAUDE_SYSTEM_PROMPT,
                messages=[
                    {
                        'role': 'user',
                        'content': [
                            {
                                'type': 'document',
                                'source': {
                                    'type': 'base64',
                                    'media_type': 'application/pdf',
                                    'data': pdf_b64,
                                },
                            },
                            {'type': 'text', 'text': user_text},
                        ],
                    },
                ],
            )
        except Exception as exc:
            logger.exception('Claude API error')
            return ParseResult(
                success=False,
                error_message=f'Claude API xatosi: {exc}',
                model_used=self.MODEL_NAME,
            )

        tokens_in = getattr(resp.usage, 'input_tokens', 0) or 0
        tokens_out = getattr(resp.usage, 'output_tokens', 0) or 0
        total_tokens = tokens_in + tokens_out
        cost = (
            tokens_in / 1_000_000 * self.INPUT_USD_PER_M
            + tokens_out / 1_000_000 * self.OUTPUT_USD_PER_M
        )

        # Birinchi text blok — JSON. Markdown fence'ni stripping (model
        # ba'zan ``` o'rab beradi).
        raw_text = ''
        for block in resp.content:
            if getattr(block, 'type', None) == 'text':
                raw_text = block.text
                break
        raw_text = raw_text.strip()
        if raw_text.startswith('```'):
            raw_text = raw_text.split('```', 2)[1]
            if raw_text.startswith('json'):
                raw_text = raw_text[4:]
            raw_text = raw_text.strip().rstrip('`').strip()

        try:
            data = json.loads(raw_text)
        except json.JSONDecodeError as exc:
            logger.error(
                "Claude noto'g'ri JSON qaytardi: %s — first 500 chars: %s",
                exc, raw_text[:500],
            )
            return ParseResult(
                success=False,
                error_message=f"AI noto'g'ri JSON qaytardi: {exc}",
                tokens_used=total_tokens,
                model_used=self.MODEL_NAME,
                cost_usd=cost,
                raw_response=raw_text[:2000],
            )

        return ParseResult(
            success=True,
            data=data,
            tokens_used=total_tokens,
            model_used=self.MODEL_NAME,
            cost_usd=cost,
        )

    def info(self) -> ProviderInfo:
        return ProviderInfo(
            name='Claude (Anthropic)',
            model=self.MODEL_NAME,
            supports_pdf_direct=True,
            free_tier_available=False,
            notes='Claude Sonnet 4.6 — native PDF document blocks',
        )
