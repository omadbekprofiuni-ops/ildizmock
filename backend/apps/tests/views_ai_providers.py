"""ETAP 16.8 — Superadmin AI Provider boshqaruv paneli API.

Endpoints (mounted at `/api/v1/super/ai-providers/`):
  GET    /ai-providers/                — provider list + status
  PATCH  /ai-providers/<id>/           — API key/model yangilash
  POST   /ai-providers/<id>/activate/  — aktiv qilish (boshqalari deaktiv)
  POST   /ai-providers/<id>/test/      — ulanishni sinash
  GET    /ai-providers/audit-log/      — oxirgi 50 o'zgartirish
"""
from __future__ import annotations

import time

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AIProviderAuditLog, AIProviderConfig
from .services.ai_providers import invalidate_cache
from .services.encryption import (
    EncryptionError,
    decrypt_api_key,
    encrypt_api_key,
    encryption_available,
    last4 as last4_helper,
)


# Provider va model variantlari (UI dropdown uchun).
PROVIDER_MODELS: dict[str, list[dict]] = {
    'gemini_aistudio': [
        {'value': 'gemini-2.5-flash', 'label': 'Gemini 2.5 Flash (tez, bepul 250 RPD)'},
        {'value': 'gemini-2.5-pro', 'label': 'Gemini 2.5 Pro (aniqroq, bepul 100 RPD)'},
    ],
    'claude_anthropic': [
        {'value': 'claude-sonnet-4-6', 'label': 'Claude Sonnet 4.6 (balansli)'},
        {'value': 'claude-opus-4-7', 'label': 'Claude Opus 4.7 (eng aniq)'},
        {'value': 'claude-haiku-4-5-20251001', 'label': 'Claude Haiku 4.5 (tezkor, arzon)'},
    ],
}


# ---------- permission helpers ----------


class IsSuperAdmin(permissions.BasePermission):
    message = 'Faqat superadmin ushbu sahifaga kira oladi.'

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and getattr(request.user, 'role', None) == 'superadmin'
        )


def _humanize_provider_error(exc: Exception) -> str:
    """Google/Anthropic SDK xatolaridan foydalanuvchi uchun toza xabar.

    Google `google.genai.errors.ClientError` xato matnida JSON dict bo'ladi
    (`{'error': {'code': 400, 'message': '...', 'status': 'INVALID_ARGUMENT'}}`)
    — biz `message`'ni va `reason`'ni ajratib olamiz.

    Anthropic SDK `anthropic.APIStatusError` `.message` atributi bilan keladi.
    """
    raw = str(exc)

    # 1) Google `genai` errors — `ClientError: 400 INVALID_ARGUMENT. {...}`
    json_start = raw.find('{')
    if json_start != -1:
        import ast

        try:
            data = ast.literal_eval(raw[json_start:])
        except (SyntaxError, ValueError):
            data = None
        if isinstance(data, dict):
            err_payload = data.get('error') if isinstance(data.get('error'), dict) else data
            message = (err_payload or {}).get('message') or ''
            details = (err_payload or {}).get('details') or []
            reason = ''
            for d in details:
                if isinstance(d, dict) and d.get('reason'):
                    reason = d['reason']
                    break
            if reason == 'API_KEY_INVALID':
                return 'API kalit yaroqsiz — Google AI Studio\'dan qayta nusxa ko\'chiring.'
            if reason == 'PERMISSION_DENIED':
                return 'API kalitda yetarli ruxsat yo\'q.'
            if reason == 'RATE_LIMIT_EXCEEDED' or 'rate' in message.lower():
                return 'Kunlik limit tugagan. Ertaga qayta urinib ko\'ring.'
            if message:
                return message[:200]

    # 2) Anthropic — xato xabarida odatda "Error code: 401 ..." formatda
    lower = raw.lower()
    if 'authentication' in lower or 'invalid api key' in lower or '401' in lower:
        return 'API kalit yaroqsiz — Anthropic Console\'dan qayta nusxa ko\'chiring.'
    if 'rate_limit' in lower or '429' in lower:
        return 'Kunlik limit tugagan. Bir oz kutib qayta urinib ko\'ring.'

    return raw[:200]


def _serialize_config(c: AIProviderConfig) -> dict:
    return {
        'id': c.id,
        'provider': c.provider,
        'provider_display': c.get_provider_display(),
        'model_name': c.model_name,
        'available_models': PROVIDER_MODELS.get(c.provider, []),
        'masked_key': c.masked_key,
        'is_configured': c.is_configured,
        'is_active': c.is_active,
        'last_test_at': c.last_test_at.isoformat() if c.last_test_at else None,
        'last_test_success': c.last_test_success,
        'last_test_error': c.last_test_error,
        'last_test_latency_ms': c.last_test_latency_ms,
        'last_updated_at': c.last_updated_at.isoformat() if c.last_updated_at else None,
        'last_updated_by': (
            c.last_updated_by.username if c.last_updated_by_id else None
        ),
    }


# ---------- views ----------


class AIProviderListView(APIView):
    """`GET /api/v1/super/ai-providers/` — provider list + global status."""

    permission_classes = [IsSuperAdmin]

    def get(self, request):
        configs = AIProviderConfig.objects.all().order_by('provider')
        return Response({
            'providers': [_serialize_config(c) for c in configs],
            'encryption_available': encryption_available(),
        })


class AIProviderUpdateView(APIView):
    """`PATCH /api/v1/super/ai-providers/<id>/` — API key yoki model yangilash."""

    permission_classes = [IsSuperAdmin]

    def patch(self, request, pk: int):
        config = get_object_or_404(AIProviderConfig, pk=pk)
        new_key = request.data.get('api_key')  # plain text — faqat kelganda
        new_model = request.data.get('model_name')

        with transaction.atomic():
            if new_model and new_model != config.model_name:
                AIProviderAuditLog.objects.create(
                    config=config,
                    action=AIProviderAuditLog.Action.MODEL_CHANGED,
                    old_value=config.model_name or '',
                    new_value=new_model,
                    performed_by=request.user,
                )
                config.model_name = new_model

            if new_key is not None:
                stripped = (new_key or '').strip()
                if stripped:
                    if not encryption_available():
                        return Response(
                            {'error': (
                                "AI_PROVIDER_ENCRYPTION_KEY .env'da o'rnatilmagan. "
                                "API kalit shifrlab saqlab bo'lmaydi."
                            )},
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                    had_key_before = bool(config.encrypted_api_key)
                    try:
                        config.encrypted_api_key = encrypt_api_key(stripped)
                    except EncryptionError as exc:
                        return Response(
                            {'error': str(exc)},
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                    config.api_key_last4 = last4_helper(stripped)
                    action = (
                        AIProviderAuditLog.Action.KEY_UPDATED
                        if had_key_before
                        else AIProviderAuditLog.Action.KEY_SET
                    )
                else:
                    config.encrypted_api_key = ''
                    config.api_key_last4 = ''
                    action = AIProviderAuditLog.Action.KEY_CLEARED

                AIProviderAuditLog.objects.create(
                    config=config, action=action, performed_by=request.user,
                )

                # Test natijasini reset qilamiz — yangi key bilan eski sinov yaroqsiz.
                config.last_test_at = None
                config.last_test_success = None
                config.last_test_error = ''
                config.last_test_latency_ms = None

            config.last_updated_by = request.user
            config.save()

        invalidate_cache()
        return Response({
            'status': 'updated',
            'config': _serialize_config(config),
        })


class AIProviderActivateView(APIView):
    """`POST /api/v1/super/ai-providers/<id>/activate/` — aktiv qilish."""

    permission_classes = [IsSuperAdmin]

    def post(self, request, pk: int):
        config = get_object_or_404(AIProviderConfig, pk=pk)
        if not config.is_configured:
            return Response(
                {'error': "API key kiritilmagan. Avval kalit qo'shing."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            others = (
                AIProviderConfig.objects
                .filter(is_active=True)
                .exclude(pk=pk)
            )
            for other in others:
                AIProviderAuditLog.objects.create(
                    config=other,
                    action=AIProviderAuditLog.Action.DEACTIVATED,
                    performed_by=request.user,
                )
                other.is_active = False
                other.save(update_fields=['is_active'])

            config.is_active = True
            config.last_updated_by = request.user
            config.save(update_fields=[
                'is_active', 'last_updated_by', 'last_updated_at',
            ])
            AIProviderAuditLog.objects.create(
                config=config,
                action=AIProviderAuditLog.Action.ACTIVATED,
                performed_by=request.user,
            )

        invalidate_cache()
        return Response({
            'status': 'activated',
            'config': _serialize_config(config),
        })


class AIProviderTestView(APIView):
    """`POST /api/v1/super/ai-providers/<id>/test/` — kalit ishlayotganini sinash."""

    permission_classes = [IsSuperAdmin]

    def post(self, request, pk: int):
        config = get_object_or_404(AIProviderConfig, pk=pk)
        if not config.is_configured:
            return Response(
                {'error': "API key yo'q"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            api_key = decrypt_api_key(config.encrypted_api_key)
        except EncryptionError as exc:
            return Response(
                {'error': str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ok = False
        err = ''
        start = time.monotonic()
        try:
            if config.provider == 'gemini_aistudio':
                from .services.ai_providers.gemini_aistudio import (
                    GeminiAIStudioProvider,
                )
                from google.genai import types

                provider = GeminiAIStudioProvider(
                    api_key=api_key,
                    model_name=config.model_name or 'gemini-2.5-flash',
                )
                # Sinov: API ping. Gemini 2.5 Flash "thinking" mode qo'shimcha
                # tokenlarni iste'mol qiladi — `max_output_tokens=64` qo'yamiz va
                # response.candidates bo'sh emasligini tekshiramiz (mazmun emas).
                response = provider.client.models.generate_content(
                    model=provider.model_name,
                    contents=['Say hello.'],
                    config=types.GenerateContentConfig(
                        max_output_tokens=64, temperature=0,
                    ),
                )
                # Muvaffaqiyat: Google javob qaytardi va kamida bir kandidat bor.
                has_candidate = bool(getattr(response, 'candidates', None))
                has_text = bool((getattr(response, 'text', None) or '').strip())
                ok = has_candidate or has_text
                err = '' if ok else 'Modeldan bo\'sh javob keldi'
            elif config.provider == 'claude_anthropic':
                from .services.ai_providers.claude_anthropic import (
                    ClaudeAnthropicProvider,
                )

                provider = ClaudeAnthropicProvider(
                    api_key=api_key,
                    model_name=config.model_name or 'claude-sonnet-4-6',
                )
                resp = provider.client.messages.create(
                    model=provider.model_name,
                    max_tokens=64,
                    messages=[{'role': 'user', 'content': 'Say hello.'}],
                )
                # Claude API javob qaytardi → kalit ishlaydi.
                ok = bool(getattr(resp, 'content', None))
                err = '' if ok else 'Modeldan bo\'sh javob keldi'
            else:
                err = "Noma'lum provider"
        except Exception as exc:  # noqa: BLE001 — har qanday SDK xatosi
            err = _humanize_provider_error(exc)
            ok = False

        latency_ms = int((time.monotonic() - start) * 1000)

        config.last_test_at = timezone.now()
        config.last_test_success = ok
        config.last_test_error = err
        config.last_test_latency_ms = latency_ms
        config.save(update_fields=[
            'last_test_at', 'last_test_success',
            'last_test_error', 'last_test_latency_ms',
        ])
        AIProviderAuditLog.objects.create(
            config=config,
            action=AIProviderAuditLog.Action.TEST_CONNECTION,
            test_success=ok,
            test_error=err,
            performed_by=request.user,
        )

        return Response({
            'success': ok,
            'latency_ms': latency_ms,
            'error': err,
        })


class AIProviderAuditLogView(APIView):
    """`GET /api/v1/super/ai-providers/audit-log/` — oxirgi 50 o'zgartirish."""

    permission_classes = [IsSuperAdmin]

    def get(self, request):
        logs = (
            AIProviderAuditLog.objects
            .select_related('config', 'performed_by')
            .order_by('-created_at')[:50]
        )
        return Response({
            'logs': [
                {
                    'id': log.id,
                    'provider': log.config.get_provider_display(),
                    'provider_code': log.config.provider,
                    'action': log.get_action_display(),
                    'action_code': log.action,
                    'old_value': log.old_value,
                    'new_value': log.new_value,
                    'test_success': log.test_success,
                    'test_error': log.test_error,
                    'performed_by': (
                        log.performed_by.username if log.performed_by_id else 'system'
                    ),
                    'created_at': log.created_at.isoformat(),
                }
                for log in logs
            ],
        })
