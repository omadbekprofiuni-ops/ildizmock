# ETAP 16.8: AI Provider Admin Panel (DB-stored Encrypted API Keys)

## Kontekst

ETAP 16.7 da AI provider abstraction o'rnatildi, lekin API key hozir `.env` faylida — har yangilashda server SSH + restart kerak. Bu ETAP'da **superadmin paneldan** API kalitlarini boshqarish imkonini beramiz:

- Yangi API key kiritish/yangilash
- Aktiv provider'ni almashtirish (Gemini ↔ Claude ↔ kelajakda boshqalar)
- Model variant tanlash (`gemini-2.5-flash` ↔ `gemini-2.5-pro`)
- Test connection (key haqiqatdan ishlayotganini tekshirish)
- Audit log — kim, qachon nimani o'zgartirgan

**Xavfsizlik talablari** (oldingi muloqotda kelishilgan):
- (a) **Write-only API key** — saqlangach faqat oxirgi 4 belgi ko'rinadi (`...XyZ9`), to'liq matn DB'dan ham ko'rinmaydi
- **Encrypted at rest** — `cryptography.fernet` orqali shifrlangan
- **Audit log** — `AIProviderAuditLog` har o'zgartirishni yozadi

## Loyihaning hozirgi holati

- ETAP 16.7 yakunlangan: `apps/tests/services/ai_providers/` (base, gemini, claude, factory)
- API key hozir `settings.GEMINI_API_KEY` (env'dan)
- `factory.get_ai_provider()` settings asosida provider qaytaradi
- `PDFImportLog` mavjud, quota tracking ishlaydi

## ETAP yakunidagi natija

1. `AIProviderConfig` model — har provider uchun konfiguratsiya, encrypted key
2. `AIProviderAuditLog` model — o'zgartirishlar tarixi
3. Encryption helper — Fernet bilan key shifrlash/ochish
4. `get_ai_provider()` endi DB'dan o'qiydi (env fallback bilan)
5. `/super/settings/ai-providers/` sahifa — boshqaruv paneli
6. API endpoints: list, update, activate, test_connection
7. Audit log oxirgi 50 o'zgartirishni ko'rsatadi
8. Migration mavjud `.env` qiymatidan DB'ga ko'chiradi
9. Git push muvaffaqiyatli

---

## 1-bosqich: Encryption helper

### `apps/tests/services/encryption.py`

```python
"""
API key'larni encrypted holda saqlash uchun.
Fernet symmetric encryption — master key .env'da.

Master key generatsiya qilish (bir martagina):
    python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

Natijani .env'ga AI_PROVIDER_ENCRYPTION_KEY sifatida qo'ying.
"""
from django.conf import settings
from cryptography.fernet import Fernet, InvalidToken


class EncryptionError(Exception):
    pass


def _get_fernet() -> Fernet:
    key = getattr(settings, "AI_PROVIDER_ENCRYPTION_KEY", None)
    if not key:
        raise EncryptionError(
            "AI_PROVIDER_ENCRYPTION_KEY .env'da o'rnatilmagan. "
            "Yarating: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
        )
    if isinstance(key, str):
        key = key.encode()
    return Fernet(key)


def encrypt_api_key(plaintext: str) -> str:
    """Plain API key'ni shifrlaydi. DB'ga shu encrypted matn yoziladi."""
    if not plaintext:
        return ""
    f = _get_fernet()
    return f.encrypt(plaintext.encode()).decode()


def decrypt_api_key(ciphertext: str) -> str:
    """Encrypted key'ni ochib qaytaradi. Faqat provider'ni chaqirayotganda ishlatiladi."""
    if not ciphertext:
        return ""
    f = _get_fernet()
    try:
        return f.decrypt(ciphertext.encode()).decode()
    except InvalidToken as e:
        raise EncryptionError(
            "API key ochib bo'lmadi. AI_PROVIDER_ENCRYPTION_KEY noto'g'ri yoki key o'zgartirilgan."
        ) from e


def mask_api_key(plaintext: str) -> str:
    """UI uchun: faqat oxirgi 4 belgini ko'rsatadi. `***XyZ9` ko'rinishida."""
    if not plaintext:
        return ""
    if len(plaintext) <= 4:
        return "•" * len(plaintext)
    return "•" * 8 + plaintext[-4:]
```

### `requirements.txt`'ga (agar yo'q bo'lsa)

```
cryptography>=42.0
```

### `.env`'ga

```
AI_PROVIDER_ENCRYPTION_KEY=<Fernet.generate_key() natijasi>
```

`settings.py`:
```python
AI_PROVIDER_ENCRYPTION_KEY = env("AI_PROVIDER_ENCRYPTION_KEY", default="")
```

**MUHIM:** Bu kalit yo'qolsa, mavjud encrypted API key'lar yana ochib bo'lmaydi. Backup oling. Lekin bu xavfli emas — yangi API key olib qayta kiritish 30 soniyalik ish.

---

## 2-bosqich: Modellar

### `apps/tests/models.py` ga qo'shing

```python
class AIProviderConfig(models.Model):
    """
    Har AI provider uchun konfiguratsiya.
    API key shifrlangan holda saqlanadi (encrypted_api_key).
    """
    
    class Provider(models.TextChoices):
        GEMINI_AISTUDIO = "gemini_aistudio", "Gemini AI Studio"
        CLAUDE_ANTHROPIC = "claude_anthropic", "Claude (Anthropic)"
        # Kelajakda: OPENAI = "openai", "OpenAI"
    
    provider = models.CharField(
        max_length=30, choices=Provider.choices, unique=True,
    )
    
    model_name = models.CharField(
        max_length=100, blank=True,
        help_text="masalan: gemini-2.5-flash, claude-sonnet-4-6",
    )
    
    encrypted_api_key = models.TextField(
        blank=True,
        help_text="Fernet bilan shifrlangan API key. Hech qachon to'g'ridan-to'g'ri o'qimang.",
    )
    
    api_key_last4 = models.CharField(
        max_length=4, blank=True,
        help_text="UI da ko'rsatish uchun oxirgi 4 belgi (encrypted emas).",
    )
    
    is_active = models.BooleanField(
        default=False,
        help_text="True bo'lsa, get_ai_provider() shu provider'ni qaytaradi. Faqat bittasi True bo'la oladi.",
    )
    
    # Test connection holati
    last_test_at = models.DateTimeField(null=True, blank=True)
    last_test_success = models.BooleanField(null=True, blank=True)
    last_test_error = models.TextField(blank=True)
    last_test_latency_ms = models.PositiveIntegerField(null=True, blank=True)
    
    # Audit
    last_updated_at = models.DateTimeField(auto_now=True)
    last_updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="updated_ai_configs",
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = "AI Provider Config"
        verbose_name_plural = "AI Provider Configs"
    
    def __str__(self):
        return f"{self.get_provider_display()} ({'active' if self.is_active else 'inactive'})"
    
    @property
    def is_configured(self):
        return bool(self.encrypted_api_key)
    
    @property
    def masked_key(self):
        if not self.api_key_last4:
            return ""
        return "•" * 8 + self.api_key_last4


class AIProviderAuditLog(models.Model):
    """Har bir provider o'zgartirishini logga yozadi."""
    
    config = models.ForeignKey(
        AIProviderConfig, on_delete=models.CASCADE, related_name="audit_logs",
    )
    
    class Action(models.TextChoices):
        KEY_SET = "key_set", "API key o'rnatildi"
        KEY_UPDATED = "key_updated", "API key yangilandi"
        KEY_CLEARED = "key_cleared", "API key o'chirildi"
        MODEL_CHANGED = "model_changed", "Model o'zgartirildi"
        ACTIVATED = "activated", "Aktiv qilindi"
        DEACTIVATED = "deactivated", "Deaktiv qilindi"
        TEST_CONNECTION = "test_connection", "Sinov o'tkazildi"
    
    action = models.CharField(max_length=30, choices=Action.choices)
    
    # Avvalgi va yangi qiymat (sezgir ma'lumotsiz — masalan model nomi)
    old_value = models.CharField(max_length=200, blank=True)
    new_value = models.CharField(max_length=200, blank=True)
    
    # Test connection uchun
    test_success = models.BooleanField(null=True, blank=True)
    test_error = models.TextField(blank=True)
    
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True,
        related_name="ai_audit_logs",
    )
    
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        ordering = ["-created_at"]
    
    def __str__(self):
        user = self.performed_by.email if self.performed_by else "system"
        return f"{user} · {self.get_action_display()} · {self.created_at:%Y-%m-%d %H:%M}"
```

Migration:
```bash
python manage.py makemigrations tests
python manage.py migrate
```

---

## 3-bosqich: Data migration — mavjud `.env` qiymatini DB'ga ko'chirish

```bash
python manage.py makemigrations --empty tests --name seed_ai_provider_configs
```

```python
# tests/migrations/00XX_seed_ai_provider_configs.py
from django.db import migrations
from django.conf import settings


def seed_configs(apps, schema_editor):
    AIProviderConfig = apps.get_model("tests", "AIProviderConfig")
    
    # Gemini config — agar .env'da kalit bo'lsa, shifrlab DB'ga yozamiz
    gemini_key = getattr(settings, "GEMINI_API_KEY", "")
    is_gemini_active = getattr(settings, "AI_PROVIDER", "gemini_aistudio") == "gemini_aistudio"
    
    # Encryption helper'ni shu yerda chaqiramiz
    encrypted_key = ""
    last4 = ""
    if gemini_key:
        from apps.tests.services.encryption import encrypt_api_key
        encrypted_key = encrypt_api_key(gemini_key)
        last4 = gemini_key[-4:] if len(gemini_key) >= 4 else ""
    
    AIProviderConfig.objects.update_or_create(
        provider="gemini_aistudio",
        defaults={
            "model_name": "gemini-2.5-flash",
            "encrypted_api_key": encrypted_key,
            "api_key_last4": last4,
            "is_active": is_gemini_active and bool(encrypted_key),
        },
    )
    
    # Claude config — placeholder (key bo'sh)
    AIProviderConfig.objects.update_or_create(
        provider="claude_anthropic",
        defaults={
            "model_name": "claude-sonnet-4-6",
            "encrypted_api_key": "",
            "api_key_last4": "",
            "is_active": getattr(settings, "AI_PROVIDER", "") == "claude_anthropic",
        },
    )


def reverse(apps, schema_editor):
    apps.get_model("tests", "AIProviderConfig").objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [("tests", "<oldingi migration>")]
    operations = [migrations.RunPython(seed_configs, reverse)]
```

**Eslatma:** Migration ichida `import` qilishda settings module'lar yetib kelishi shart. Agar `AI_PROVIDER_ENCRYPTION_KEY` hali `.env`'da bo'lmasa, migration xatolik beradi — avval shu kalitni yarating va `.env`'ga qo'ying.

---

## 4-bosqich: Provider factory'ni yangilash

### `apps/tests/services/ai_providers/factory.py`

Mavjud `get_ai_provider()`'ni DB'dan o'qiy oladigan qilib o'zgartiring:

```python
from django.conf import settings
from django.core.cache import cache
from .base import AIProvider
from .gemini import GeminiAIStudioProvider
from .claude import ClaudeAnthropicProvider

CACHE_KEY = "ai_provider_active_config"
CACHE_TTL = 60  # 1 daqiqa — tez o'zgaradigan ma'lumot emas


def _get_active_config():
    """DB'dan active config'ni cache bilan oladi."""
    cached = cache.get(CACHE_KEY)
    if cached is not None:
        return cached
    
    from apps.tests.models import AIProviderConfig
    try:
        config = AIProviderConfig.objects.get(is_active=True)
        result = {
            "provider": config.provider,
            "model_name": config.model_name,
            "encrypted_api_key": config.encrypted_api_key,
        }
    except AIProviderConfig.DoesNotExist:
        result = None
    
    cache.set(CACHE_KEY, result, CACHE_TTL)
    return result


def invalidate_cache():
    """Config yangilanganda chaqiriladi."""
    cache.delete(CACHE_KEY)


def get_ai_provider() -> AIProvider:
    from .encryption import decrypt_api_key  # local import — circular oldini olish
    
    config = _get_active_config()
    
    if not config or not config["encrypted_api_key"]:
        # Fallback: .env'dan o'qish (DB hali to'ldirilmagan bo'lsa)
        provider_name = getattr(settings, "AI_PROVIDER", "gemini_aistudio")
        api_key = getattr(settings, "GEMINI_API_KEY", "")
        if not api_key:
            raise ValueError(
                "AI provider sozlanmagan. /super/settings/ai-providers/ da kalit kiriting."
            )
        if provider_name == "gemini_aistudio":
            return GeminiAIStudioProvider(api_key=api_key, model_name="gemini-2.5-flash")
        raise ValueError(f"Provider {provider_name} sozlanmagan.")
    
    # DB'dan
    api_key = decrypt_api_key(config["encrypted_api_key"])
    
    if config["provider"] == "gemini_aistudio":
        return GeminiAIStudioProvider(
            api_key=api_key,
            model_name=config["model_name"] or "gemini-2.5-flash",
        )
    
    if config["provider"] == "claude_anthropic":
        return ClaudeAnthropicProvider(
            api_key=api_key,
            model_name=config["model_name"] or "claude-sonnet-4-6",
        )
    
    raise ValueError(f"Noma'lum provider: {config['provider']}")
```

### Provider klasslarini moslashtirish

`GeminiAIStudioProvider` va `ClaudeAnthropicProvider` konstruktor'iga `api_key` va `model_name` parametrlari qo'shilsin (settings'dan o'qish o'rniga):

```python
# apps/tests/services/ai_providers/gemini.py
class GeminiAIStudioProvider(AIProvider):
    def __init__(self, api_key: str, model_name: str = "gemini-2.5-flash"):
        if not api_key:
            raise ValueError("API key kerak")
        self.model_name = model_name
        self.client = genai.Client(api_key=api_key)
    
    # parse_ielts_pdf va boshqalar o'zgarmaydi, faqat self.model_name'ni ishlatadi
```

---

## 5-bosqich: API endpoints

### `apps/super_admin/views_ai_providers.py` (yangi fayl)

```python
import time
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db import transaction

from apps.tests.models import AIProviderConfig, AIProviderAuditLog
from apps.tests.services.encryption import encrypt_api_key, decrypt_api_key
from apps.tests.services.ai_providers.factory import invalidate_cache
from apps.tests.services.ai_providers.gemini import GeminiAIStudioProvider
from apps.tests.services.ai_providers.claude import ClaudeAnthropicProvider


def _superadmin_required(request):
    return request.user.is_authenticated and request.user.user_type == "superadmin"


# Provider va model variantlari ro'yxati (UI dropdown uchun)
PROVIDER_MODELS = {
    "gemini_aistudio": [
        {"value": "gemini-2.5-flash", "label": "Gemini 2.5 Flash (tez, bepul 250 RPD)"},
        {"value": "gemini-2.5-pro", "label": "Gemini 2.5 Pro (aniqroq, bepul 100 RPD)"},
    ],
    "claude_anthropic": [
        {"value": "claude-sonnet-4-6", "label": "Claude Sonnet 4.6 (balansli)"},
        {"value": "claude-opus-4-7", "label": "Claude Opus 4.7 (eng aniq)"},
    ],
}


class AIProviderListView(APIView):
    """GET /api/v1/super/ai-providers/"""
    
    def get(self, request):
        if not _superadmin_required(request):
            return Response(status=403)
        
        configs = AIProviderConfig.objects.all().order_by("provider")
        return Response({
            "providers": [
                {
                    "id": c.id,
                    "provider": c.provider,
                    "provider_display": c.get_provider_display(),
                    "model_name": c.model_name,
                    "available_models": PROVIDER_MODELS.get(c.provider, []),
                    "masked_key": c.masked_key,
                    "is_configured": c.is_configured,
                    "is_active": c.is_active,
                    "last_test_at": c.last_test_at,
                    "last_test_success": c.last_test_success,
                    "last_test_error": c.last_test_error,
                    "last_test_latency_ms": c.last_test_latency_ms,
                    "last_updated_at": c.last_updated_at,
                    "last_updated_by": c.last_updated_by.email if c.last_updated_by else None,
                }
                for c in configs
            ],
        })


class AIProviderUpdateView(APIView):
    """PATCH /api/v1/super/ai-providers/<id>/"""
    
    def patch(self, request, pk):
        if not _superadmin_required(request):
            return Response(status=403)
        
        try:
            config = AIProviderConfig.objects.get(pk=pk)
        except AIProviderConfig.DoesNotExist:
            return Response(status=404)
        
        new_key = request.data.get("api_key")  # plain text, faqat kelganda
        new_model = request.data.get("model_name")
        
        with transaction.atomic():
            # Model o'zgarishi
            if new_model and new_model != config.model_name:
                AIProviderAuditLog.objects.create(
                    config=config,
                    action=AIProviderAuditLog.Action.MODEL_CHANGED,
                    old_value=config.model_name,
                    new_value=new_model,
                    performed_by=request.user,
                )
                config.model_name = new_model
            
            # API key o'zgarishi (faqat new_key kelganda)
            if new_key is not None:  # bo'sh "" — clear, mavjud bo'lmaslik — tegmaydi
                if new_key.strip():
                    config.encrypted_api_key = encrypt_api_key(new_key.strip())
                    config.api_key_last4 = new_key.strip()[-4:]
                    action = (
                        AIProviderAuditLog.Action.KEY_UPDATED
                        if config.encrypted_api_key else AIProviderAuditLog.Action.KEY_SET
                    )
                else:
                    config.encrypted_api_key = ""
                    config.api_key_last4 = ""
                    action = AIProviderAuditLog.Action.KEY_CLEARED
                
                AIProviderAuditLog.objects.create(
                    config=config, action=action, performed_by=request.user,
                )
                
                # Test holatini reset qilamiz — yangi key bilan eski test natijasi yaroqsiz
                config.last_test_at = None
                config.last_test_success = None
                config.last_test_error = ""
                config.last_test_latency_ms = None
            
            config.last_updated_by = request.user
            config.save()
        
        invalidate_cache()
        
        return Response({"status": "updated", "masked_key": config.masked_key})


class AIProviderActivateView(APIView):
    """POST /api/v1/super/ai-providers/<id>/activate/"""
    
    def post(self, request, pk):
        if not _superadmin_required(request):
            return Response(status=403)
        
        try:
            config = AIProviderConfig.objects.get(pk=pk)
        except AIProviderConfig.DoesNotExist:
            return Response(status=404)
        
        if not config.is_configured:
            return Response(
                {"error": "API key kiritilmagan. Avval kalit qo'shing."},
                status=400,
            )
        
        with transaction.atomic():
            # Boshqa barchasini deaktivlash
            for other in AIProviderConfig.objects.exclude(pk=pk).filter(is_active=True):
                AIProviderAuditLog.objects.create(
                    config=other,
                    action=AIProviderAuditLog.Action.DEACTIVATED,
                    performed_by=request.user,
                )
                other.is_active = False
                other.save(update_fields=["is_active"])
            
            # Bu provider'ni aktivlash
            config.is_active = True
            config.last_updated_by = request.user
            config.save(update_fields=["is_active", "last_updated_by", "last_updated_at"])
            
            AIProviderAuditLog.objects.create(
                config=config,
                action=AIProviderAuditLog.Action.ACTIVATED,
                performed_by=request.user,
            )
        
        invalidate_cache()
        
        return Response({"status": "activated"})


class AIProviderTestView(APIView):
    """POST /api/v1/super/ai-providers/<id>/test/"""
    
    def post(self, request, pk):
        if not _superadmin_required(request):
            return Response(status=403)
        
        try:
            config = AIProviderConfig.objects.get(pk=pk)
        except AIProviderConfig.DoesNotExist:
            return Response(status=404)
        
        if not config.is_configured:
            return Response({"error": "API key yo'q"}, status=400)
        
        api_key = decrypt_api_key(config.encrypted_api_key)
        
        try:
            start = time.time()
            
            if config.provider == "gemini_aistudio":
                provider = GeminiAIStudioProvider(api_key=api_key, model_name=config.model_name)
                # Kichik test so'rovi
                from google.genai import types
                response = provider.client.models.generate_content(
                    model=config.model_name,
                    contents=["Reply with the single word: OK"],
                    config=types.GenerateContentConfig(max_output_tokens=10, temperature=0),
                )
                ok = "OK" in (response.text or "").upper()
            elif config.provider == "claude_anthropic":
                provider = ClaudeAnthropicProvider(api_key=api_key, model_name=config.model_name)
                # Claude uchun analog test
                # ETAP 16.7 da Claude provider tayyor bo'lsa ulang
                ok = True  # placeholder
            else:
                return Response({"error": "Noma'lum provider"}, status=400)
            
            latency_ms = int((time.time() - start) * 1000)
            
            config.last_test_at = timezone.now()
            config.last_test_success = ok
            config.last_test_error = "" if ok else "Kutilgan javob kelmadi"
            config.last_test_latency_ms = latency_ms
            config.save(update_fields=[
                "last_test_at", "last_test_success",
                "last_test_error", "last_test_latency_ms",
            ])
            
            AIProviderAuditLog.objects.create(
                config=config,
                action=AIProviderAuditLog.Action.TEST_CONNECTION,
                test_success=ok,
                test_error="" if ok else "Kutilgan javob kelmadi",
                performed_by=request.user,
            )
            
            return Response({
                "success": ok,
                "latency_ms": latency_ms,
                "error": "" if ok else "Kutilgan javob kelmadi",
            })
        
        except Exception as e:
            latency_ms = int((time.time() - start) * 1000) if 'start' in dir() else 0
            err = str(e)[:500]
            
            config.last_test_at = timezone.now()
            config.last_test_success = False
            config.last_test_error = err
            config.last_test_latency_ms = latency_ms
            config.save(update_fields=[
                "last_test_at", "last_test_success",
                "last_test_error", "last_test_latency_ms",
            ])
            
            AIProviderAuditLog.objects.create(
                config=config,
                action=AIProviderAuditLog.Action.TEST_CONNECTION,
                test_success=False, test_error=err,
                performed_by=request.user,
            )
            
            return Response({"success": False, "error": err, "latency_ms": latency_ms}, status=200)


class AIProviderAuditLogView(APIView):
    """GET /api/v1/super/ai-providers/audit-log/"""
    
    def get(self, request):
        if not _superadmin_required(request):
            return Response(status=403)
        
        logs = (
            AIProviderAuditLog.objects
            .select_related("config", "performed_by")
            .order_by("-created_at")[:50]
        )
        
        return Response({
            "logs": [
                {
                    "id": log.id,
                    "provider": log.config.get_provider_display(),
                    "action": log.get_action_display(),
                    "old_value": log.old_value,
                    "new_value": log.new_value,
                    "test_success": log.test_success,
                    "test_error": log.test_error,
                    "performed_by": log.performed_by.email if log.performed_by else "system",
                    "created_at": log.created_at,
                }
                for log in logs
            ],
        })
```

### URL'lar

```python
# apps/super_admin/urls.py
from . import views_ai_providers as v

urlpatterns = [
    # ... mavjud yo'llar ...
    path("ai-providers/", v.AIProviderListView.as_view()),
    path("ai-providers/<int:pk>/", v.AIProviderUpdateView.as_view()),
    path("ai-providers/<int:pk>/activate/", v.AIProviderActivateView.as_view()),
    path("ai-providers/<int:pk>/test/", v.AIProviderTestView.as_view()),
    path("ai-providers/audit-log/", v.AIProviderAuditLogView.as_view()),
]
```

---

## 6-bosqich: Frontend — admin panel

### `pages/superadmin/SuperAdminAIProvidersPage.tsx`

```tsx
import { useState, useEffect } from "react";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import toast from "react-hot-toast";

interface Provider {
  id: number;
  provider: string;
  provider_display: string;
  model_name: string;
  available_models: { value: string; label: string }[];
  masked_key: string;
  is_configured: boolean;
  is_active: boolean;
  last_test_at: string | null;
  last_test_success: boolean | null;
  last_test_error: string;
  last_test_latency_ms: number | null;
  last_updated_at: string;
  last_updated_by: string | null;
}

export function SuperAdminAIProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const load = async () => {
    const [pRes, lRes] = await Promise.all([
      fetch("/api/v1/super/ai-providers/").then((r) => r.json()),
      fetch("/api/v1/super/ai-providers/audit-log/").then((r) => r.json()),
    ]);
    setProviders(pRes.providers);
    setAuditLogs(lRes.logs);
    setLoading(false);
  };
  
  useEffect(() => { load(); }, []);
  
  if (loading) return <SuperAdminLayout><div className="py-12 text-center text-gray-500">Yuklanmoqda...</div></SuperAdminLayout>;
  
  return (
    <SuperAdminLayout active="ai-providers">
      <div className="space-y-5 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold">AI Provider sozlamalari</h1>
          <p className="text-sm text-gray-500 mt-1">
            PDF parse uchun ishlatiladigan AI provider va API kalitlarini boshqaring
          </p>
        </div>
        
        {/* Provider cards */}
        <div className="space-y-3">
          {providers.map((p) => (
            <ProviderCard key={p.id} provider={p} onChanged={load} />
          ))}
        </div>
        
        {/* Audit log */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <h2 className="font-bold mb-3">Oxirgi o'zgartirishlar</h2>
          {auditLogs.length === 0 ? (
            <p className="text-sm text-gray-500">Hozircha o'zgartirishlar yo'q</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {auditLogs.map((log) => (
                <div key={log.id} className="py-2 text-sm flex items-center justify-between">
                  <div>
                    <span className="font-medium">{log.action}</span>
                    <span className="text-gray-500"> · {log.provider}</span>
                    {log.old_value && (
                      <span className="text-gray-400 text-xs ml-1">
                        {log.old_value} → {log.new_value}
                      </span>
                    )}
                    {log.test_success === false && (
                      <span className="text-red-600 text-xs ml-2">✗ {log.test_error}</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400">
                    {log.performed_by} · {new Date(log.created_at).toLocaleString("uz")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </SuperAdminLayout>
  );
}


function ProviderCard({ provider, onChanged }: { provider: Provider; onChanged: () => void }) {
  const [model, setModel] = useState(provider.model_name);
  const [newKey, setNewKey] = useState("");
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  
  const save = async () => {
    setSaving(true);
    const body: any = {};
    if (model !== provider.model_name) body.model_name = model;
    if (newKey.trim()) body.api_key = newKey.trim();
    
    if (Object.keys(body).length === 0) {
      setSaving(false);
      return;
    }
    
    const res = await fetch(`/api/v1/super/ai-providers/${provider.id}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrf() },
      body: JSON.stringify(body),
    });
    
    setSaving(false);
    if (res.ok) {
      toast.success("Saqlandi");
      setNewKey("");
      setShowKeyInput(false);
      onChanged();
    } else {
      toast.error("Xatolik");
    }
  };
  
  const test = async () => {
    setTesting(true);
    const res = await fetch(`/api/v1/super/ai-providers/${provider.id}/test/`, {
      method: "POST",
      headers: { "X-CSRFToken": getCsrf() },
    });
    setTesting(false);
    const data = await res.json();
    if (data.success) {
      toast.success(`Ulanish muvaffaqiyatli (${data.latency_ms}ms)`);
    } else {
      toast.error(`Xatolik: ${data.error}`);
    }
    onChanged();
  };
  
  const activate = async () => {
    if (!provider.is_configured) {
      toast.error("Avval API key kiriting");
      return;
    }
    if (!confirm(`${provider.provider_display}'ni aktiv qilasizmi? Boshqa provider deaktivlanadi.`)) return;
    
    const res = await fetch(`/api/v1/super/ai-providers/${provider.id}/activate/`, {
      method: "POST",
      headers: { "X-CSRFToken": getCsrf() },
    });
    
    if (res.ok) {
      toast.success(`${provider.provider_display} aktiv`);
      onChanged();
    }
  };
  
  return (
    <div className={`bg-white border-2 rounded-2xl p-5 ${provider.is_active ? "border-rose-500" : "border-gray-200"}`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-lg">{provider.provider_display}</h3>
            {provider.is_active && (
              <span className="text-xs font-bold bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">AKTIV</span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {provider.is_configured ? "API key o'rnatilgan" : "API key kiritilmagan"}
          </p>
        </div>
        
        {!provider.is_active && provider.is_configured && (
          <button
            onClick={activate}
            className="text-sm bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg font-medium"
          >
            Aktiv qilish
          </button>
        )}
      </div>
      
      {/* Model selector */}
      <div className="mb-3">
        <label className="text-xs font-medium text-gray-700 block mb-1">Model</label>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          {provider.available_models.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>
      
      {/* API key */}
      <div className="mb-3">
        <label className="text-xs font-medium text-gray-700 block mb-1">API Key</label>
        {!showKeyInput && provider.is_configured && (
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 font-mono">
              {provider.masked_key}
            </code>
            <button
              onClick={() => setShowKeyInput(true)}
              className="text-sm border border-gray-300 hover:bg-gray-50 px-3 py-2 rounded-lg"
            >
              Yangilash
            </button>
          </div>
        )}
        {(showKeyInput || !provider.is_configured) && (
          <div className="flex items-center gap-2">
            <input
              type="password"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder={
                provider.provider === "gemini_aistudio"
                  ? "AIzaSy... (https://aistudio.google.com/apikey)"
                  : "sk-ant-... (https://console.anthropic.com)"
              }
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
              autoComplete="new-password"
            />
            {showKeyInput && provider.is_configured && (
              <button
                onClick={() => { setShowKeyInput(false); setNewKey(""); }}
                className="text-sm text-gray-500 px-2"
              >
                Bekor
              </button>
            )}
          </div>
        )}
        <p className="text-[11px] text-gray-400 mt-1">
          Saqlangach faqat oxirgi 4 belgi ko'rinadi. To'liq matn shifrlangan holda DB'da.
        </p>
      </div>
      
      {/* Test status */}
      {provider.last_test_at && (
        <div className={`text-xs mb-3 px-3 py-2 rounded-lg ${
          provider.last_test_success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
        }`}>
          {provider.last_test_success ? "✓" : "✗"} Oxirgi sinov: {new Date(provider.last_test_at).toLocaleString("uz")}
          {provider.last_test_latency_ms != null && ` · ${provider.last_test_latency_ms}ms`}
          {provider.last_test_error && <div className="mt-1 text-[11px]">{provider.last_test_error}</div>}
        </div>
      )}
      
      {/* Actions */}
      <div className="flex gap-2 pt-3 border-t border-gray-100">
        <button
          onClick={save}
          disabled={saving || (!newKey.trim() && model === provider.model_name)}
          className="bg-rose-600 hover:bg-rose-700 disabled:opacity-30 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          {saving ? "..." : "Saqlash"}
        </button>
        <button
          onClick={test}
          disabled={testing || !provider.is_configured}
          className="border border-gray-300 hover:bg-gray-50 disabled:opacity-30 text-sm px-4 py-2 rounded-lg"
        >
          {testing ? "Sinab ko'rilmoqda..." : "Sinash"}
        </button>
      </div>
      
      <p className="text-[11px] text-gray-400 mt-3">
        Oxirgi yangilangan: {new Date(provider.last_updated_at).toLocaleString("uz")}
        {provider.last_updated_by && ` · ${provider.last_updated_by}`}
      </p>
    </div>
  );
}
```

Route `App.tsx`:
```tsx
<Route path="/super/settings/ai-providers" element={<SuperAdminProtected><SuperAdminAIProvidersPage /></SuperAdminProtected>} />
```

Super-admin sidebar'ga link:
```tsx
<NavItem to="/super/settings/ai-providers" icon="🤖">AI Providers</NavItem>
```

---

## 7-bosqich: Manual test checklist

- [ ] `AI_PROVIDER_ENCRYPTION_KEY` `.env`'da, Fernet kalit
- [ ] Migration ishlagan, `AIProviderConfig` ikki entry'li (Gemini, Claude)
- [ ] Gemini config'da mavjud `.env` kaliti shifrlanib ko'chgan
- [ ] `/super/settings/ai-providers/` ochiladi, 2 ta provider kartochka ko'rinadi
- [ ] Gemini kartochkasida masked key (`••••••••XyZ9`) ko'rinadi
- [ ] Model dropdown ishlaydi (Flash ↔ Pro)
- [ ] "Yangilash" tugmasi → input ochiladi, yangi key kiritish mumkin
- [ ] Saqlangach yangi `last4` ko'rinadi
- [ ] "Sinash" tugmasi → ~1-2 soniyada javob, latency ko'rinadi
- [ ] Noto'g'ri key bilan sinash → xato xabar va red banner
- [ ] Claude kartasiga key kiritsangiz, faqat shu key shifrlanadi
- [ ] "Aktiv qilish" → Gemini'dan Claude'ga o'tadi, faqat bittasi aktiv
- [ ] PDF import sahifaga o'tib, aktiv provider ishlatilishini ko'ring (preview'da provider nomi)
- [ ] Audit log o'zgartirishlarni tartibda ko'rsatadi (yangi → eski)
- [ ] Cache invalidate ishlaydi — provider almashtirgach 1 daqiqada (yoki invalidate_cache chaqirilgani uchun darrov) yangi key ishlatiladi
- [ ] B2C user yoki center admin `/super/settings/ai-providers/` ga kirsa — 403
- [ ] DB'da `encrypted_api_key` ustunidagi qiymat shifrlangan (plain key emas) — `python manage.py shell` orqali tekshiring

---

## 8-bosqich: Git commit va push (MAJBURIY)

```bash
git add .
git commit -m "ETAP 16.8: AI Provider admin panel — DB-stored encrypted keys, test connection, audit log"
git push origin <branch-nomi>
```

---

## Yakuniy checklist

- [ ] `cryptography>=42.0` `requirements.txt`'da
- [ ] `AI_PROVIDER_ENCRYPTION_KEY` `.env`'da
- [ ] `services/encryption.py` — encrypt/decrypt/mask
- [ ] `AIProviderConfig` model
- [ ] `AIProviderAuditLog` model
- [ ] Migration mavjud `.env` Gemini key'ni DB'ga ko'chiradi
- [ ] `factory.get_ai_provider()` DB'dan o'qiydi + cache + env fallback
- [ ] Provider klasslar `api_key` va `model_name` konstruktor parametrlari bilan
- [ ] API endpoints: list, update (PATCH), activate, test, audit-log
- [ ] `SuperAdminAIProvidersPage.tsx` to'liq UI
- [ ] Sidebar link
- [ ] Route ulangan
- [ ] DB encrypted matn saqlaydi, masked UI'da
- [ ] Migration fayllar git'da
- [ ] `git push origin <branch>` muvaffaqiyatli

---

## Keyingi qadam

ETAP 16.8 tugagandan keyin:
- `.env` `GEMINI_API_KEY` qator'ini olib tashlash mumkin (DB'da bor) yoki fallback uchun qoldirish
- Anthropic API key olganda — to'g'ridan-to'g'ri panel orqali kiritasiz, server tegmaysiz
- Kelajakda OpenAI yoki boshqa provider qo'shish uchun: `AIProviderConfig.Provider` enum'ga value, `PROVIDER_MODELS` ga model'lar, va `factory.py`'ga provider klassi qo'shing — UI avtomatik ishlaydi
