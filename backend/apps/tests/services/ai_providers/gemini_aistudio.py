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

from .base import (
    SYSTEM_PROMPT,
    AIProvider,
    ParseResult,
    ProviderInfo,
)

logger = logging.getLogger(__name__)


# Gemini structured-output JSON schema (OpenAPI subset). Description'lar
# Gemini'ga har maydon nimani aniq kutayotganini aytadi — bu input'da kichik
# qo'shimcha token, lekin sifatni sezilarli oshiradi.
IELTS_SCHEMA = {
    'type': 'OBJECT',
    'properties': {
        'test_metadata': {
            'type': 'OBJECT',
            'properties': {
                'title': {
                    'type': 'STRING',
                    'description': (
                        "Test sarlavhasi (masalan 'IELTS Listening Test 1' "
                        "yoki PDF'dagi haqiqiy nom)."
                    ),
                },
                'section_type': {
                    'type': 'STRING',
                    'enum': ['listening', 'reading', 'writing', 'full'],
                    'description': 'Test moduli.',
                },
                'source_book': {
                    'type': 'STRING',
                    'description': "Masalan 'Cambridge IELTS 19', 'Real Exam 2024'.",
                },
                'test_number': {
                    'type': 'STRING',
                    'description': "Masalan 'Test 1', 'Test 2'.",
                },
                'duration_minutes': {
                    'type': 'INTEGER',
                    'description': 'IELTS: listening=30, reading=60, writing=60.',
                },
                'difficulty': {
                    'type': 'STRING',
                    'enum': ['easy', 'medium', 'hard'],
                },
            },
        },
        'sections': {
            'type': 'ARRAY',
            'description': (
                "IELTS sectionlar. Listening — 4 part, Reading — 3 passage, "
                "Writing — 2 task."
            ),
            'items': {
                'type': 'OBJECT',
                'properties': {
                    'section_number': {
                        'type': 'INTEGER',
                        'description': '1, 2, 3 yoki 4.',
                    },
                    'section_title': {
                        'type': 'STRING',
                        'description': (
                            "Masalan 'Part 1 — Booking form', 'Reading Passage 1'."
                        ),
                    },
                    'passage': {
                        'type': 'STRING',
                        'description': (
                            "Reading: to'liq passage matni. Listening: agar "
                            "PDF'da transcript bo'lsa shuni qo'y, aks holda bo'sh."
                        ),
                    },
                    'instructions': {
                        'type': 'STRING',
                        'description': (
                            "PDF'dagi instruksiya: masalan 'NO MORE THAN TWO "
                            "WORDS AND/OR A NUMBER'."
                        ),
                    },
                    'questions': {
                        'type': 'ARRAY',
                        'items': {
                            'type': 'OBJECT',
                            'properties': {
                                'question_number': {
                                    'type': 'INTEGER',
                                    'description': 'IELTS 1-40 oralig\'ida.',
                                },
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
                                'question_text': {
                                    'type': 'STRING',
                                    'description': (
                                        "To'liq stem. Bo'sh joy uchun '____' "
                                        "(4 ta pastki chiziq). Kontekstni kesma."
                                    ),
                                },
                                'options': {
                                    'type': 'ARRAY',
                                    'items': {'type': 'STRING'},
                                    'description': (
                                        "Multiple choice / matching uchun "
                                        "variantlar. Faqat to'liq matn, A/B/C "
                                        "harflarisiz."
                                    ),
                                },
                                'correct_answer': {
                                    'type': 'STRING',
                                    'description': (
                                        "PDF oxiridagi Answer Key'dan ol. MCQ "
                                        "uchun harf yoki to'liq matn; fill uchun "
                                        "aynan PDF'dagi shaklda."
                                    ),
                                },
                                'max_words': {
                                    'type': 'INTEGER',
                                    'description': (
                                        "fill_in_blank uchun ruxsat etilgan "
                                        "maksimal so'z (instruksiyadan)."
                                    ),
                                },
                                'explanation': {
                                    'type': 'STRING',
                                    'description': 'Ixtiyoriy (PDF\'da bo\'lsa).',
                                },
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
            'description': (
                "Listening uchun audio fayl nomi ko'rsatilgan bo'lsa (mp3/wav)."
            ),
        },
    },
    'required': ['test_metadata', 'sections'],
}


class GeminiAIStudioProvider(AIProvider):
    """Gemini 2.5 Flash via Google AI Studio API."""

    DEFAULT_MODEL = 'gemini-2.5-flash'

    # Gemini 2.5 Flash paid-tier narxlari ($/M token)
    INPUT_USD_PER_M = 0.30
    OUTPUT_USD_PER_M = 2.50

    def __init__(self, api_key: str = '', model_name: str = '') -> None:
        if not api_key:
            raise ValueError("Gemini API key kerak (DB yoki .env'da o'rnating)")
        self.model_name = model_name or self.DEFAULT_MODEL
        # Lazy import — `google-genai` ixtiyoriy bog'liqlik.
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

        user_prompt = (
            "Quyidagi IELTS test PDF'ini boshidan oxirigacha (Answer Key "
            "bo'limini ham) chuqur o'qib, schema'ga aynan mos JSON qaytaring. "
            "Stem'larda kontekstni saqlang, bo'sh joylar uchun '____' "
            "ishlating. Hech bir savolni o'tkazib yubormang."
        )
        if hint_section_type:
            user_prompt += (
                f"\n\nUser hint: bu test {hint_section_type} bo'limi uchun."
            )

        # Token-aware config:
        # - thinking_budget=2048 — modelga chuqur o'ylash uchun reasoning token
        #   beradi (output emas). Sifatni sezilarli oshiradi.
        # - max_output_tokens=16000 — 40 savol + passage uchun yetadi.
        # - temperature=0 — determinism, har safar bir xil natija.
        # Eski SDK versiyalari `thinking_config`'ni qo'llab-quvvatlamasligi
        # mumkin — shu sababli try-except orqali fallback.
        base_kwargs = dict(
            system_instruction=SYSTEM_PROMPT,
            response_mime_type='application/json',
            response_schema=IELTS_SCHEMA,
            temperature=0,
            max_output_tokens=16000,
        )
        try:
            config_obj = types.GenerateContentConfig(
                **base_kwargs,
                thinking_config=types.ThinkingConfig(thinking_budget=2048),
            )
        except (AttributeError, TypeError):
            # SDK eskiroq yoki model thinking'ni qo'llamaydi
            config_obj = types.GenerateContentConfig(**base_kwargs)

        try:
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=[
                    types.Part.from_bytes(
                        data=pdf_bytes, mime_type='application/pdf',
                    ),
                    user_prompt,
                ],
                config=config_obj,
            )
        except Exception as exc:
            logger.exception('Gemini API error')
            return ParseResult(
                success=False,
                error_message=f'Gemini API xatosi: {exc}',
                model_used=self.model_name,
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
                model_used=self.model_name,
                cost_usd=cost,
                raw_response=raw_text[:2000],
            )

        return ParseResult(
            success=True,
            data=data,
            tokens_used=total_tokens,
            model_used=self.model_name,
            cost_usd=cost,
        )

    def info(self) -> ProviderInfo:
        return ProviderInfo(
            name='Gemini AI Studio',
            model=self.model_name,
            supports_pdf_direct=True,
            free_tier_available=True,
            daily_quota=250,
            notes='Free tier: 250 RPD, 10 RPM, 250K TPM',
        )
