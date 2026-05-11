"""ETAP 16.7 — Gemini AI Studio provider.

Setup:
  pip install google-genai
  .env: GEMINI_API_KEY=AIza...
  https://aistudio.google.com/apikey orqali kalit olish

Pricing (Gemini 2.5 Flash):
  Free tier: 250 RPD, 10 RPM, 250K TPM
  Paid:      $0.30 / M input, $2.50 / M output
"""
from __future__ import annotations

import json
import logging
from typing import Optional

from django.conf import settings

from .base import (
    SYSTEM_PROMPT,
    AIProvider,
    ParseResult,
    ProviderInfo,
)

logger = logging.getLogger(__name__)


# Gemini structured-output JSON schema (OpenAPI subset). google-genai
# kutubxonasi `response_schema` parametri orqali qabul qiladi.
IELTS_SCHEMA = {
    'type': 'OBJECT',
    'properties': {
        'test_metadata': {
            'type': 'OBJECT',
            'properties': {
                'title': {'type': 'STRING'},
                'section_type': {
                    'type': 'STRING',
                    'enum': ['listening', 'reading', 'writing', 'full'],
                },
                'source_book': {'type': 'STRING'},
                'test_number': {'type': 'STRING'},
                'duration_minutes': {'type': 'INTEGER'},
                'difficulty': {
                    'type': 'STRING',
                    'enum': ['easy', 'medium', 'hard'],
                },
            },
        },
        'sections': {
            'type': 'ARRAY',
            'items': {
                'type': 'OBJECT',
                'properties': {
                    'section_number': {'type': 'INTEGER'},
                    'section_title': {'type': 'STRING'},
                    'passage': {'type': 'STRING'},
                    'instructions': {'type': 'STRING'},
                    'questions': {
                        'type': 'ARRAY',
                        'items': {
                            'type': 'OBJECT',
                            'properties': {
                                'question_number': {'type': 'INTEGER'},
                                'question_type': {
                                    'type': 'STRING',
                                    'enum': [
                                        'multiple_choice',
                                        'true_false_not_given',
                                        'yes_no_not_given',
                                        'fill_in_blank',
                                        'matching',
                                        'short_answer',
                                        'sentence_completion',
                                        'summary_completion',
                                        'diagram_labeling',
                                        'essay',
                                    ],
                                },
                                'question_text': {'type': 'STRING'},
                                'options': {
                                    'type': 'ARRAY',
                                    'items': {'type': 'STRING'},
                                },
                                'correct_answer': {'type': 'STRING'},
                                'max_words': {'type': 'INTEGER'},
                                'explanation': {'type': 'STRING'},
                            },
                            'required': [
                                'question_number',
                                'question_type',
                                'question_text',
                            ],
                        },
                    },
                },
                'required': ['section_number', 'questions'],
            },
        },
        'audio_references': {
            'type': 'ARRAY',
            'items': {'type': 'STRING'},
        },
    },
    'required': ['test_metadata', 'sections'],
}


class GeminiAIStudioProvider(AIProvider):
    """Gemini 2.5 Flash via Google AI Studio API."""

    MODEL_NAME = 'gemini-2.5-flash'

    # Gemini 2.5 Flash paid-tier narxlari ($/M token)
    INPUT_USD_PER_M = 0.30
    OUTPUT_USD_PER_M = 2.50

    def __init__(self) -> None:
        api_key = getattr(settings, 'GEMINI_API_KEY', '') or ''
        if not api_key:
            raise ValueError("GEMINI_API_KEY .env'da o'rnatilmagan")
        # Lazy import — `google-genai` ixtiyoriy bog'liqlik, fallback chaqirilmasa
        # import qilinmaydi.
        from google import genai

        self._genai = genai
        self.client = genai.Client(api_key=api_key)

    def parse_ielts_pdf(
        self,
        pdf_bytes: bytes,
        *,
        hint_section_type: Optional[str] = None,
    ) -> ParseResult:
        from google.genai import types

        user_prompt = "Quyidagi IELTS test PDF'ini parse qiling va JSON qaytaring."
        if hint_section_type:
            user_prompt += f"\n\nHint: bu test {hint_section_type} bo'limi uchun."

        try:
            response = self.client.models.generate_content(
                model=self.MODEL_NAME,
                contents=[
                    types.Part.from_bytes(
                        data=pdf_bytes, mime_type='application/pdf',
                    ),
                    user_prompt,
                ],
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    response_mime_type='application/json',
                    response_schema=IELTS_SCHEMA,
                    temperature=0.1,
                    max_output_tokens=32000,
                ),
            )
        except Exception as exc:
            logger.exception('Gemini API error')
            return ParseResult(
                success=False,
                error_message=f'Gemini API xatosi: {exc}',
                model_used=self.MODEL_NAME,
            )

        usage = getattr(response, 'usage_metadata', None)
        tokens_in = getattr(usage, 'prompt_token_count', 0) or 0
        tokens_out = getattr(usage, 'candidates_token_count', 0) or 0
        total_tokens = tokens_in + tokens_out
        cost = (
            tokens_in / 1_000_000 * self.INPUT_USD_PER_M
            + tokens_out / 1_000_000 * self.OUTPUT_USD_PER_M
        )

        raw_text = (response.text or '').strip()
        try:
            data = json.loads(raw_text)
        except json.JSONDecodeError as exc:
            logger.error(
                'Gemini noto\'g\'ri JSON qaytardi: %s — first 500 chars: %s',
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
            name='Gemini AI Studio',
            model=self.MODEL_NAME,
            supports_pdf_direct=True,
            free_tier_available=True,
            daily_quota=250,
            notes='Free tier: 250 RPD, 10 RPM, 250K TPM',
        )
