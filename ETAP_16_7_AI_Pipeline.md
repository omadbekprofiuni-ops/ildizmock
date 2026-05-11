# ETAP 16.7: PDF Import AI Pipeline — Gemini AI Studio + Provider Abstraction

## Kontekst

Hozirgi PDF import sahifasida ("Import test from PDF" superadmin'da) **"Use AI to improve question parsing" checkbox** mavjud, lekin natija aniq emas — testlar xato import qilinmoqda. Bu pipeline'ni **Gemini 2.5 Flash (AI Studio)** bilan to'liq qayta quramiz, va **provider abstraction** orqali kelajakda Claude (Anthropic) yoki boshqa LLM'larga osongina o'tish imkonini beramiz.

**Bu ETAP-ning vazifasi:**
1. Mavjud PDF AI parsing kodini tekshirish va auditga olish
2. **Provider abstraction qatlami** — `AIProvider` interface + `GeminiAIStudioProvider` (hozir) + `ClaudeAnthropicProvider` (placeholder, kelajak uchun)
3. **Strict JSON schema** — IELTS test strukturasiga to'liq mos
4. **PDF'ni to'g'ridan-to'g'ri Gemini'ga yuborish** (text extract qilmasdan, layout va rasm bilan birga)
5. **Quota tracking** — kuniga necha so'rov ishlatilganini logga yozish
6. **Mavjud preview/review UI** bilan to'liq integratsiya
7. **Error handling + retry** — agar Gemini xatolik bersa, foydalanuvchiga aniq xabar

**Bu ETAP-da YO'Q:** Claude integratsiyasi (faqat skeleton qoldiriladi), Google Cloud setup (kerak emas), JSON schema editor UI (keyinroq).

## Loyihaning hozirgi holati

- Django backend + React frontend (Vite)
- Superadmin'da `/super/global-tests/pdf-import` sahifasi mavjud (screenshot)
- "Use AI" checkbox bor — qaysidir AI pipeline allaqachon ulangan, lekin yetarli aniq emas
- Mavjud Test modeli: section_type (Listening/Reading/Writing/Full), difficulty, duration_minutes, questions related model, va h.k.
- ETAP 16-16.6 dan: `available_for_b2c`, `source`, `b2c_credits_cost` field'lari mavjud

## Birinchi navbatda — kod auditi

Cursor Agent, **kod yozishdan oldin** quyidagilarni tekshiring va menga (terminal output yoki summary sifatida) javob bering:

1. **PDF AI parsing kodini topib bering** — qaysi fayl(lar)?
   - Tipik joylar: `apps/tests/services/pdf_import.py`, `apps/tests/services/ai_parser.py`, yoki shunga o'xshash
   - "Use AI" checkbox qaysi endpoint'ga so'rov yuboradi?

2. **Hozirgi qaysi AI service ishlatilmoqda?**
   - `requirements.txt`'da qaysi kutubxonalar bor: `openai`, `anthropic`, `google-generativeai`, `google-genai`, `huggingface`, va h.k.?
   - Kod qaysi LLM provider'ga so'rov yuboradi?

3. **Hozirgi system prompt nima?**
   - PDF parsing uchun qanday instruksiyalar yuborilmoqda?
   - JSON schema bormi yoki free-form parsing?

4. **Mavjud Test → Question model strukturasini ko'rsating**
   - `apps/tests/models.py` ichida Test, Question (yoki uning analoglari) modellari qanday tuzilgan?
   - Question turlari qaysi (multiple_choice, fill_blank, matching, true_false, va h.k.)?
   - Passage (o'qish matni) Test ichida joylashganmi yoki alohida modelmi?

Bu javoblar bilan men hozir yozayotgan kod skeleton'i loyihaning haqiqiy strukturasiga moslashadi. Quyidagi kod **shartli** — siz audit'dan keyin haqiqiy field nomlariga moslashtirib o'rnatasiz.

---

## 1-bosqich: Provider abstraction

### `apps/tests/services/ai_providers/__init__.py`

```python
"""
AI Provider abstraction.
Hozir GeminiAIStudio ishlatiladi. Kelajakda Claude (Anthropic) qo'shish uchun
faqat yangi Provider klassi yozish kifoya — boshqa kod o'zgarmaydi.

Provider tanlash settings.AI_PROVIDER orqali (default: gemini_aistudio).
"""
from django.conf import settings
from .base import AIProvider
from .gemini_aistudio import GeminiAIStudioProvider


def get_ai_provider() -> AIProvider:
    provider_name = getattr(settings, "AI_PROVIDER", "gemini_aistudio")
    
    if provider_name == "gemini_aistudio":
        return GeminiAIStudioProvider()
    
    # Kelajak uchun:
    # if provider_name == "claude_anthropic":
    #     from .claude_anthropic import ClaudeAnthropicProvider
    #     return ClaudeAnthropicProvider()
    
    raise ValueError(f"Unknown AI provider: {provider_name}")
```

### `apps/tests/services/ai_providers/base.py`

```python
"""AI Provider interface."""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class ParseResult:
    """PDF parsing natijasi — universal format."""
    success: bool
    data: Optional[dict] = None  # IELTS test structured data
    error_message: str = ""
    tokens_used: int = 0
    model_used: str = ""
    cost_usd: float = 0.0  # taxminiy, free tier'da 0


@dataclass
class ProviderInfo:
    name: str
    model: str
    supports_pdf_direct: bool
    free_tier_available: bool
    daily_quota: Optional[int] = None
    notes: str = ""


class AIProvider(ABC):
    """Barcha AI provider'lar shu interface'ni amalga oshiradi."""
    
    @abstractmethod
    def parse_ielts_pdf(self, pdf_bytes: bytes, *, hint_section_type: Optional[str] = None) -> ParseResult:
        """
        IELTS test PDF'ni structured JSON'ga o'tkazish.
        
        Args:
            pdf_bytes: PDF fayl raw bytes
            hint_section_type: ixtiyoriy hint ("listening", "reading", "writing", "full")
                               — agar berilsa, AI shu turga moslab parse qiladi
        
        Returns:
            ParseResult — muvaffaqiyat yoki xato + data + token usage
        """
        ...
    
    @abstractmethod
    def info(self) -> ProviderInfo:
        """Provider haqida metadata (UI va logging uchun)."""
        ...
```

### `apps/tests/services/ai_providers/gemini_aistudio.py`

```python
"""
Gemini AI Studio provider — Google AI Studio API key orqali ishlaydi.
GCP project, service account kerak emas.

Setup:
  pip install google-genai
  .env'ga GEMINI_API_KEY=AIza... qo'shish
  https://aistudio.google.com/apikey orqali kalit olish

Pricing:
  Free tier: 250 RPD (kuniga so'rov), 10 RPM, 250K TPM (Gemini 2.5 Flash)
  Paid: $0.50 input / $3.00 output per M token
"""
import base64
import json
import logging
from django.conf import settings
from google import genai
from google.genai import types

from .base import AIProvider, ParseResult, ProviderInfo

logger = logging.getLogger(__name__)


# IELTS uchun strict JSON schema
IELTS_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "test_metadata": {
            "type": "OBJECT",
            "properties": {
                "title": {"type": "STRING"},
                "section_type": {
                    "type": "STRING",
                    "enum": ["listening", "reading", "writing", "full"],
                },
                "source_book": {"type": "STRING", "description": "masalan 'Cambridge 9'"},
                "test_number": {"type": "STRING", "description": "masalan 'Test 1'"},
                "duration_minutes": {"type": "INTEGER"},
                "difficulty": {
                    "type": "STRING",
                    "enum": ["easy", "medium", "hard"],
                },
            },
        },
        "sections": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "section_number": {"type": "INTEGER"},
                    "section_title": {"type": "STRING"},
                    "passage": {
                        "type": "STRING",
                        "description": "Reading uchun matn, Listening uchun audio script (agar bo'lsa)",
                    },
                    "instructions": {"type": "STRING"},
                    "questions": {
                        "type": "ARRAY",
                        "items": {
                            "type": "OBJECT",
                            "properties": {
                                "question_number": {"type": "INTEGER"},
                                "question_type": {
                                    "type": "STRING",
                                    "enum": [
                                        "multiple_choice",
                                        "true_false_not_given",
                                        "yes_no_not_given",
                                        "fill_in_blank",
                                        "matching",
                                        "short_answer",
                                        "sentence_completion",
                                        "summary_completion",
                                        "diagram_labeling",
                                        "essay",
                                    ],
                                },
                                "question_text": {"type": "STRING"},
                                "options": {
                                    "type": "ARRAY",
                                    "items": {"type": "STRING"},
                                    "description": "multiple_choice/matching uchun variantlar",
                                },
                                "correct_answer": {"type": "STRING", "description": "Javob kaliti"},
                                "max_words": {"type": "INTEGER", "description": "fill_in_blank uchun"},
                                "explanation": {"type": "STRING", "description": "ixtiyoriy"},
                            },
                            "required": ["question_number", "question_type", "question_text"],
                        },
                    },
                },
                "required": ["section_number", "questions"],
            },
        },
        "audio_references": {
            "type": "ARRAY",
            "items": {"type": "STRING"},
            "description": "Listening uchun audio fayl nomlari (agar PDF'da ko'rsatilgan bo'lsa)",
        },
    },
    "required": ["test_metadata", "sections"],
}


SYSTEM_PROMPT = """Sen IELTS test PDF'larini parse qiluvchi mutaxassissan. Sening vazifang — yuborilgan IELTS test PDF'ini aniq JSON strukturasiga aylantirish.

Qoidalar:
1. PDF'ni diqqat bilan o'qing — matn, jadval, rasm, diagramma — hammasini.
2. Section turini aniqlang: listening (audio), reading (matn), writing (essay), yoki full (barchasi).
3. Har bir savolni alohida question object sifatida ajrating, savol raqamini saqlang.
4. Reading uchun: passage to'liq matnini "passage" maydoniga qo'ying.
5. Listening uchun: audio script bo'lsa "passage" ga, audio fayl ishoralari "audio_references"ga.
6. Savol turini aniq belgilang (multiple_choice, true_false_not_given, fill_in_blank va h.k.).
7. Multiple choice uchun "options" ro'yxatini to'liq keltiring (A, B, C, D).
8. Javob kalitini (correct_answer) PDF'ning oxiridagi "Answers" yoki "Answer Key" bo'limidan toping va saqlang.
9. Fill-in-blank uchun "max_words" maydonini qo'shing (instruksiyada "NO MORE THAN TWO WORDS" deb yozilgan bo'lsa, 2).
10. Ishonchsiz joylarda boshqa savol-ni "skipped" qilib qoldirgandan ko'ra, taxminni saqlang — odam keyin tahrirlaydi.

JSON faqat sxemaga mos qaytaring. Boshqa matn, izoh, markdown — yo'q."""


class GeminiAIStudioProvider(AIProvider):
    MODEL_NAME = "gemini-2.5-flash"  # tezkor va bepul tier
    # Yuqori aniqlik kerak bo'lsa: "gemini-2.5-pro" (kuniga 100 so'rov bepul)
    
    def __init__(self):
        api_key = getattr(settings, "GEMINI_API_KEY", None)
        if not api_key:
            raise ValueError("GEMINI_API_KEY .env'da o'rnatilmagan")
        self.client = genai.Client(api_key=api_key)
    
    def parse_ielts_pdf(self, pdf_bytes: bytes, *, hint_section_type=None) -> ParseResult:
        try:
            # Hint qo'shilsa, system prompt'ga qo'shamiz
            user_prompt = "Quyidagi IELTS test PDF'ini parse qiling va JSON qaytaring."
            if hint_section_type:
                user_prompt += f"\n\nHint: bu test {hint_section_type} bo'limi uchun."
            
            response = self.client.models.generate_content(
                model=self.MODEL_NAME,
                contents=[
                    types.Part.from_bytes(data=pdf_bytes, mime_type="application/pdf"),
                    user_prompt,
                ],
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    response_mime_type="application/json",
                    response_schema=IELTS_SCHEMA,
                    temperature=0.1,  # kam ijodiy, ko'p aniq
                    max_output_tokens=32000,
                ),
            )
            
            # Token usage
            usage = response.usage_metadata
            tokens_in = getattr(usage, "prompt_token_count", 0) or 0
            tokens_out = getattr(usage, "candidates_token_count", 0) or 0
            total = tokens_in + tokens_out
            
            # Cost (paid tier rates — free tier'da 0)
            # Gemini 2.5 Flash: $0.30/M input, $2.50/M output
            cost = (tokens_in / 1_000_000) * 0.30 + (tokens_out / 1_000_000) * 2.50
            
            # JSON parse
            try:
                data = json.loads(response.text)
            except json.JSONDecodeError as e:
                logger.error(f"Gemini JSON parse error: {e}\nRaw: {response.text[:500]}")
                return ParseResult(
                    success=False,
                    error_message=f"AI noto'g'ri JSON qaytardi: {e}",
                    tokens_used=total,
                    model_used=self.MODEL_NAME,
                )
            
            return ParseResult(
                success=True,
                data=data,
                tokens_used=total,
                model_used=self.MODEL_NAME,
                cost_usd=cost,
            )
        
        except Exception as e:
            logger.exception("Gemini API error")
            return ParseResult(
                success=False,
                error_message=f"Gemini API xatosi: {e}",
                model_used=self.MODEL_NAME,
            )
    
    def info(self) -> ProviderInfo:
        return ProviderInfo(
            name="Gemini AI Studio",
            model=self.MODEL_NAME,
            supports_pdf_direct=True,
            free_tier_available=True,
            daily_quota=250,
            notes="Free: 250 RPD, 10 RPM, 250K TPM",
        )
```

### Kelajak uchun skeleton — `apps/tests/services/ai_providers/claude_anthropic.py`

```python
"""
Claude (Anthropic) provider — KELAJAK UCHUN PLACEHOLDER.

Ulash uchun:
  pip install anthropic
  .env'ga ANTHROPIC_API_KEY=sk-ant-... qo'shish
  settings.AI_PROVIDER = "claude_anthropic"

NotImplementedError'ni olib tashlash va parse_ielts_pdf'ni implement qilish.
"""
from .base import AIProvider, ParseResult, ProviderInfo


class ClaudeAnthropicProvider(AIProvider):
    MODEL_NAME = "claude-sonnet-4-6"
    
    def __init__(self):
        raise NotImplementedError(
            "Claude provider hali ulanmagan. Anthropic API key olganda yoqamiz. "
            "Hozircha settings.AI_PROVIDER='gemini_aistudio' ishlating."
        )
    
    def parse_ielts_pdf(self, pdf_bytes, *, hint_section_type=None) -> ParseResult:
        raise NotImplementedError()
    
    def info(self) -> ProviderInfo:
        return ProviderInfo(
            name="Claude (Anthropic)",
            model=self.MODEL_NAME,
            supports_pdf_direct=True,
            free_tier_available=False,
        )
```

---

## 2-bosqich: Settings, .env, requirements

### `requirements.txt`'ga qo'shing

```
google-genai>=0.3.0
```

(`google-generativeai` — eski paket. Yangi unified SDK `google-genai`.)

### `.env` (server)

```
GEMINI_API_KEY=AIza...sizning kalitingiz...
AI_PROVIDER=gemini_aistudio
```

### `settings.py`

```python
import environ
env = environ.Env()  # yoki mavjud env loading

GEMINI_API_KEY = env("GEMINI_API_KEY", default="")
AI_PROVIDER = env("AI_PROVIDER", default="gemini_aistudio")
```

---

## 3-bosqich: PDF import view'ni provider'ga ulash

### Mavjud import view'ni topish

Audit qilib aniqlang: `/super/global-tests/pdf-import` ga POST qaysi view? Tipik yo'l:
- `apps/super_admin/views.py` ichidagi `GlobalTestPDFImportView` yoki shunga o'xshash
- Frontend `SuperAdminPdfImportPage.tsx` qaysi endpoint'ga so'rov yuboradi?

### View kodi (haqiqiy joyga moslang)

```python
# apps/super_admin/views.py yoki haqiqiy joy
import logging
from django.db import transaction
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser

from apps.tests.services.ai_providers import get_ai_provider
from apps.tests.services.pdf_import import build_preview_from_ai_data
from apps.tests.models import PDFImportLog  # quyida yaratamiz

logger = logging.getLogger(__name__)


class GlobalTestPDFImportPreviewView(APIView):
    """
    POST /api/v1/super/global-tests/pdf-import/preview
    
    PDF'ni AI orqali parse qiladi va preview qaytaradi.
    User keyin preview'da tekshirib, "Confirm" bossa, test DB'ga saqlanadi.
    """
    parser_classes = [MultiPartParser]
    
    def post(self, request):
        if request.user.user_type != "superadmin":
            return Response({"error": "forbidden"}, status=403)
        
        pdf_file = request.FILES.get("pdf")
        use_ai = request.data.get("use_ai", "false").lower() == "true"
        hint = request.data.get("section_type")  # ixtiyoriy
        
        if not pdf_file:
            return Response({"error": "PDF fayl topilmadi"}, status=400)
        
        pdf_bytes = pdf_file.read()
        pdf_size_mb = len(pdf_bytes) / 1024 / 1024
        
        if pdf_size_mb > 50:  # AI Studio limit
            return Response(
                {"error": f"PDF juda katta ({pdf_size_mb:.1f} MB). Maksimum 50 MB."},
                status=400,
            )
        
        # Import log (audit + quota tracking)
        log = PDFImportLog.objects.create(
            user=request.user,
            file_name=pdf_file.name,
            file_size_bytes=len(pdf_bytes),
            use_ai=use_ai,
            section_type_hint=hint or "",
            status="processing",
        )
        
        if not use_ai:
            # Fallback: AI siz parse (eski logika, agar mavjud bo'lsa)
            # ... mavjud kodga moslang
            log.status = "completed_no_ai"
            log.save()
            return Response({"preview": {...}, "ai_used": False})
        
        # AI bilan parse
        provider = get_ai_provider()
        result = provider.parse_ielts_pdf(pdf_bytes, hint_section_type=hint)
        
        log.tokens_used = result.tokens_used
        log.model_used = result.model_used
        log.cost_usd = result.cost_usd
        
        if not result.success:
            log.status = "failed"
            log.error_message = result.error_message
            log.save()
            return Response(
                {"error": result.error_message, "log_id": log.id},
                status=500,
            )
        
        log.status = "ai_parsed"
        log.save()
        
        # AI'dan kelgan data'ni preview formatiga aylantirish
        # (preview UI mavjud bo'lsa, uning kutgan formatiga moslang)
        preview = build_preview_from_ai_data(result.data)
        
        return Response({
            "preview": preview,
            "ai_used": True,
            "ai_provider": provider.info().name,
            "ai_model": result.model_used,
            "tokens_used": result.tokens_used,
            "cost_usd": result.cost_usd,
            "log_id": log.id,
        })


class GlobalTestPDFImportConfirmView(APIView):
    """
    POST /api/v1/super/global-tests/pdf-import/confirm
    
    User preview'ni tahrir qilib (yoki o'zgartirmasdan) confirm qiladi.
    Test va savollar DB'ga saqlanadi.
    """
    
    def post(self, request):
        if request.user.user_type != "superadmin":
            return Response({"error": "forbidden"}, status=403)
        
        data = request.data  # user tahrir qilingan structured data
        log_id = data.get("log_id")
        
        try:
            with transaction.atomic():
                # Test yaratish (loyihaning haqiqiy model field nomlariga moslang)
                # Test va Question modellari mavjud — ularning to'g'ri field'larini ishlatang
                ...
        except Exception as e:
            logger.exception("Test save error")
            return Response({"error": str(e)}, status=500)
        
        if log_id:
            PDFImportLog.objects.filter(id=log_id).update(status="saved")
        
        return Response({"status": "saved", "test_id": test.id})
```

### `apps/tests/services/pdf_import.py` — preview builder

```python
def build_preview_from_ai_data(ai_data: dict) -> dict:
    """
    AI'dan kelgan IELTS schema'ni frontend preview UI kutgan formatga aylantiradi.
    Bu funksiyani mavjud preview UI kutgan struktura'ga moslang.
    """
    metadata = ai_data.get("test_metadata", {})
    sections = ai_data.get("sections", [])
    
    return {
        "title": metadata.get("title", ""),
        "section_type": metadata.get("section_type", ""),
        "source_book": metadata.get("source_book", ""),
        "duration_minutes": metadata.get("duration_minutes"),
        "difficulty": metadata.get("difficulty", "medium"),
        "sections": [
            {
                "number": s.get("section_number"),
                "title": s.get("section_title", ""),
                "passage": s.get("passage", ""),
                "instructions": s.get("instructions", ""),
                "questions": [
                    {
                        "number": q.get("question_number"),
                        "type": q.get("question_type"),
                        "text": q.get("question_text"),
                        "options": q.get("options", []),
                        "correct_answer": q.get("correct_answer", ""),
                        "max_words": q.get("max_words"),
                    }
                    for q in s.get("questions", [])
                ],
            }
            for s in sections
        ],
        "audio_references": ai_data.get("audio_references", []),
    }
```

---

## 4-bosqich: PDFImportLog modeli — quota tracking

### `apps/tests/models.py` ga qo'shing

```python
class PDFImportLog(models.Model):
    """Har bir PDF import urinishini logga yozadi — audit va quota uchun."""
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL, null=True,
        related_name="pdf_imports",
    )
    
    file_name = models.CharField(max_length=255)
    file_size_bytes = models.PositiveIntegerField()
    
    use_ai = models.BooleanField(default=False)
    section_type_hint = models.CharField(max_length=20, blank=True)
    
    class Status(models.TextChoices):
        PROCESSING = "processing", "Davom etmoqda"
        AI_PARSED = "ai_parsed", "AI parse qildi"
        SAVED = "saved", "Test saqlandi"
        FAILED = "failed", "Xato"
        COMPLETED_NO_AI = "completed_no_ai", "AI ishlatilmadi"
    
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PROCESSING)
    
    # AI usage
    model_used = models.CharField(max_length=50, blank=True)
    tokens_used = models.PositiveIntegerField(default=0)
    cost_usd = models.DecimalField(max_digits=10, decimal_places=6, default=0)
    
    error_message = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        ordering = ["-created_at"]
    
    def __str__(self):
        return f"{self.file_name} — {self.status} — {self.created_at:%Y-%m-%d %H:%M}"
```

Migration:
```bash
python manage.py makemigrations tests
python manage.py migrate
```

---

## 5-bosqich: Quota tracking endpoint

### Bugungi ishlatish

```python
# apps/super_admin/views.py
from datetime import date
from django.db.models import Sum, Count


class AIQuotaStatsView(APIView):
    def get(self, request):
        if request.user.user_type != "superadmin":
            return Response(status=403)
        
        today = date.today()
        today_logs = PDFImportLog.objects.filter(
            created_at__date=today, use_ai=True,
        )
        
        return Response({
            "today_requests": today_logs.count(),
            "today_tokens": today_logs.aggregate(s=Sum("tokens_used"))["s"] or 0,
            "today_cost_usd": float(today_logs.aggregate(s=Sum("cost_usd"))["s"] or 0),
            "daily_free_limit": 250,  # Gemini 2.5 Flash
            "remaining": max(0, 250 - today_logs.count()),
            "provider": get_ai_provider().info().__dict__,
        })
```

URL: `/api/v1/super/ai-quota/`

---

## 6-bosqich: Frontend — preview UI update

`SuperAdminPdfImportPage.tsx` (haqiqiy joyni moslang) — preview natija bilan birga AI usage'ni ham ko'rsatish:

```tsx
// Upload tugagandan keyin preview'da AI metadata
{preview?.ai_used && (
  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-xs flex items-center gap-3">
    <span>🤖</span>
    <div className="flex-1">
      <p className="font-medium">{preview.ai_provider} ({preview.ai_model})</p>
      <p className="text-blue-700">
        {preview.tokens_used.toLocaleString()} token ishlatildi
        {preview.cost_usd > 0 && ` · $${preview.cost_usd.toFixed(4)}`}
      </p>
    </div>
  </div>
)}
```

Va checkbox label'ini yangilang:
```tsx
<label className="flex items-center gap-2">
  <input type="checkbox" checked={useAI} onChange={(e) => setUseAI(e.target.checked)} />
  <span>Use AI to parse PDF (Gemini 2.5 Flash, free tier)</span>
</label>
```

---

## 7-bosqich: Quota indicator (sidebar yoki settings)

Superadmin sidebar'ga kichik widget — kunlik ishlatishni ko'rsatish:

```tsx
function AIQuotaBadge() {
  const [quota, setQuota] = useState<any>(null);
  useEffect(() => {
    fetch("/api/v1/super/ai-quota/").then(r => r.json()).then(setQuota);
  }, []);
  
  if (!quota) return null;
  
  const pct = (quota.today_requests / quota.daily_free_limit) * 100;
  
  return (
    <div className="px-3 py-2 text-xs text-gray-400">
      <p>AI bugun: {quota.today_requests} / {quota.daily_free_limit}</p>
      <div className="h-1 bg-gray-700 rounded-full mt-1">
        <div className={`h-full rounded-full ${pct > 80 ? 'bg-red-500' : 'bg-green-500'}`}
             style={{width: `${Math.min(100, pct)}%`}} />
      </div>
    </div>
  );
}
```

---

## 8-bosqich: Sinov

### Local test (Django shell)

```bash
python manage.py shell
```

```python
from apps.tests.services.ai_providers import get_ai_provider

provider = get_ai_provider()
print(provider.info())

# Sinov PDF
with open("/path/to/cambridge_9_test_1_reading.pdf", "rb") as f:
    pdf_bytes = f.read()

result = provider.parse_ielts_pdf(pdf_bytes, hint_section_type="reading")
print(f"Success: {result.success}")
print(f"Tokens: {result.tokens_used}")
print(f"Cost: ${result.cost_usd:.4f}")
if result.success:
    import json
    print(json.dumps(result.data, indent=2, ensure_ascii=False)[:2000])
else:
    print(f"Error: {result.error_message}")
```

### Manual test (UI)

- [ ] Superadmin sifatida `/super/global-tests/pdf-import` ga kirish
- [ ] "Use AI" checkbox yoqilgan
- [ ] Cambridge 9 Test 1 Reading PDF'ni yuklash
- [ ] Preview chiqadi — bo'limlar, passage, savollar to'g'ri ajratilgan
- [ ] AI metadata badge ko'rinadi (token, narx)
- [ ] Preview'da xatolarni qo'lda tuzatish mumkin
- [ ] Confirm bosgach, Test DB'ga saqlanadi
- [ ] Saqlangan testni `/super/global-tests/` ro'yxatida ko'rish
- [ ] B2C catalog'ga publish qilib, `/b2c/catalog/<id>/` orqali ko'rish
- [ ] `/api/v1/super/ai-quota/` endpoint to'g'ri statistika qaytaradi
- [ ] Listening PDF (audio script bilan) sinov
- [ ] Full mock test PDF sinov

---

## 9-bosqich: Git commit va push (MAJBURIY)

```bash
git add .
git commit -m "ETAP 16.7: PDF import AI pipeline — Gemini AI Studio + provider abstraction"
git push origin <branch-nomi>
```

---

## Yakuniy checklist

- [ ] Mavjud PDF AI parsing kodi auditdan o'tgan, mening promptga javob berilgan
- [ ] `google-genai` o'rnatilgan (`requirements.txt`'da)
- [ ] `.env`'da `GEMINI_API_KEY` va `AI_PROVIDER=gemini_aistudio`
- [ ] `ai_providers/` paket: `base.py`, `gemini_aistudio.py`, `claude_anthropic.py` (skeleton), `__init__.py`
- [ ] IELTS_SCHEMA aniq va to'liq IELTS turlarini qamrab oladi
- [ ] `PDFImportLog` modeli + migration
- [ ] Mavjud PDF import view yangi provider'ni ishlatadi
- [ ] `build_preview_from_ai_data` — AI schema'ni preview formatiga aylantiradi
- [ ] Frontend preview AI metadata ko'rsatadi (provider, model, token, narx)
- [ ] Quota endpoint va sidebar badge
- [ ] Shell sinov muvaffaqiyatli o'tgan (kamida 1 ta Cambridge test PDF)
- [ ] UI sinov muvaffaqiyatli o'tgan
- [ ] Git push muvaffaqiyatli

---

## Kelajak — ETAP 16.8 (Claude integratsiya)

Anthropic API key olganda:
1. `pip install anthropic`
2. `.env`: `ANTHROPIC_API_KEY=sk-ant-...` qo'shing
3. `ai_providers/claude_anthropic.py` ichida `ClaudeAnthropicProvider` to'liq implement qiling (Anthropic SDK bilan PDF document blok)
4. `.env`'da `AI_PROVIDER=claude_anthropic` ga o'zgartiring
5. Tamom — qolgan kod o'zgarmaydi

Provider abstraction shu uchun yaratildi — bitta env variable'ni almashtirib, butun pipeline yangi modelga o'tadi.
