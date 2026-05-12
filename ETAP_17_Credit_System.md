# ETAP 17: B2C Credit System (ildiz-testing.uz)

## Kontekst

ETAP 14-16 da B2C foundation, OAuth, dashboard va catalog tayyor bo'ldi. Hozir foydalanuvchi katalogni ko'ra oladi, lekin "Boshlash" tugmasi modal'da "Kredit tizimi tez orada" deydi. Ushbu ETAP **kreditni real ishga tushiradi**.

**Bu ETAP-ning vazifasi:**
1. Credit infrastructure (balance, transactions, packages) modellari
2. Signup bonus avtomatik berilishi
3. Test detail sahifadagi "Boshlash" tugmasi real kredit gate ishlatishi
4. `B2CTestAttempt` modeli — kredit sarflanganda test sessiyasini yaratish va kuzatish
5. `/b2c/credits/` sahifa — balans, tarix, paketlar (paketlar ETAP 18 to'lov bilan ulanadi)
6. Header'da kredit balans badge
7. Test detail'da real narx ko'rsatish
8. Super-admin'da: foydalanuvchiga kredit grant qilish, tranzaksiya tarixini ko'rish, global pricing settings, per-test pricing override
9. Test runner integratsiyasi (mavjud runner'ni B2C uchun moslashtirish yoki yangi yengil runner yaratish)
10. Test yakunlanganda → `B2CActivityEvent` yaratish + (kerak bo'lsa) refund

**Bu ETAP-da YO'Q:** Real to'lov (Click/Payme) — ETAP 18. Hozircha credit paketlari sahifada ko'rinadi, lekin "Sotib olish" tugmasi "Tez orada" modal'i.

## Business defaults (sozlanishi mumkin)

`settings.py` ga qo'shamiz:

```python
# B2C Credit defaults
B2C_SIGNUP_BONUS_CREDITS = 3
B2C_DEFAULT_SECTION_CREDITS = 2    # Listening/Reading/Writing
B2C_DEFAULT_FULL_TEST_CREDITS = 5  # Full Mock
B2C_REFUND_WINDOW_MINUTES = 5      # Sessiya boshlanganidan keyin shu vaqt ichida bekor qilsa refund
B2C_REFUND_REQUIRES_ZERO_ANSWERS = True
```

Jasmina keyinroq bu qiymatlarni o'zgartira oladi (yoki super-admin paneldagi settings sahifasi orqali).

## Loyihaning hozirgi holati

- ETAP 14-16 yakunlangan (PR merge bo'lgan deb taxmin qilamiz)
- `apps.b2c`: `B2CProfile`, `B2CActivityEvent`, dashboard, profile, catalog, catalog detail
- `apps.tests`: `Test` modeli `available_for_b2c`, `b2c_published_at`, `b2c_display_name`, `b2c_description` field'lari bilan
- Frontend: React SPA — `B2CLayout`, `CatalogPage`, `CatalogDetailPage`, `DashboardPage`, super-admin paneli
- Mavjud test runner B2B kontekstida ishlaydi (sessions/groups orqali)

## ETAP yakunidagi natija

1. Yangi B2C user ro'yxatdan o'tganda avtomatik **3 credit bonus** oladi
2. Test detail sahifada **real narx** ko'rsatiladi (global default yoki per-test override)
3. "Boshlash" tugmasi — kredit yetarli bo'lsa confirm modal → kredit yechiladi → B2C test attempt yaratiladi → test runner ochiladi
4. Kredit yetmasa "Kreditlar yetarli emas — paket sotib oling" xabari (paket sahifaga link)
5. `/b2c/credits/` sahifa: balans, oxirgi 50 ta tranzaksiya, paketlar grid (Sotib olish tugmalari "SOON")
6. Header'da `⚡ 5 credit` badge har sahifada
7. Test yakunlanganda — `B2CActivityEvent` yoziladi, dashboard heatmap'da ko'rinadi
8. Super-admin `/super/credits/` — user qidirib kredit grant qila oladi, har bir userning to'liq tranzaksiya tarixini ko'radi
9. Super-admin `B2CCatalogManage` sahifada har bir testga per-test narx belgilay oladi (yoki global default'ga qoldira oladi)
10. Git push muvaffaqiyatli

---

## 1-bosqich: Credit modellari

### `apps/b2c/models.py` ga qo'shing

```python
from decimal import Decimal
from django.conf import settings
from django.db import models, transaction
from django.utils import timezone


class CreditBalance(models.Model):
    """
    Denormalized cache. Source of truth — CreditTransaction.
    Har bir spend/grant CreditTransaction yaratadi va shu balance'ni atomic ravishda yangilaydi.
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="credit_balance",
    )
    balance = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.user.email}: {self.balance}"


class CreditTransaction(models.Model):
    """
    Har bir credit harakati — immutable audit log.
    Bu model balance'ning haqiqiy manbasi: balansni qayta hisoblash mumkin
    `sum(amount for tx in transactions)` orqali (lekin amalda CreditBalance ishlatamiz tezlik uchun).
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="credit_transactions",
    )
    
    class Kind(models.TextChoices):
        SIGNUP_BONUS = "signup_bonus", "Signup bonus"
        PURCHASE = "purchase", "Sotib olish (to'lov)"
        SPEND = "spend", "Sarflash (test)"
        REFUND = "refund", "Qaytarish"
        ADMIN_GRANT = "admin_grant", "Admin tomonidan berildi"
        ADMIN_DEDUCT = "admin_deduct", "Admin tomonidan olib tashlandi"
        EXPIRY = "expiry", "Muddati tugadi"  # kelajakda
    
    kind = models.CharField(max_length=20, choices=Kind.choices)
    amount = models.IntegerField(help_text="Musbat = kirim, manfiy = chiqim")
    balance_after = models.PositiveIntegerField(help_text="Bu tranzaksiyadan keyingi balans (audit uchun)")
    
    # Bog'liq ob'ektlar (ixtiyoriy)
    related_attempt = models.ForeignKey(
        "B2CTestAttempt", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="credit_transactions",
    )
    related_package = models.ForeignKey(
        "CreditPackage", on_delete=models.SET_NULL, null=True, blank=True,
    )
    
    # Audit
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL, null=True, blank=True,
        related_name="created_credit_transactions",
        help_text="Admin grant uchun — qaysi superadmin amalga oshirdi",
    )
    note = models.CharField(max_length=255, blank=True, help_text="Admin grant uchun izoh")
    
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        indexes = [models.Index(fields=["user", "-created_at"])]
        ordering = ["-created_at"]
    
    def __str__(self):
        sign = "+" if self.amount > 0 else ""
        return f"{self.user.email} {sign}{self.amount} ({self.get_kind_display()})"


class CreditPackage(models.Model):
    """
    Sotuv uchun paketlar (ETAP 18 to'lov bilan ulanadi).
    Hozircha CRUD bor, lekin "Sotib olish" tugmasi UI da "SOON".
    """
    name = models.CharField(max_length=100)  # "Boshlovchi", "Standart", "Mukammal"
    credits = models.PositiveIntegerField()
    price_uzs = models.PositiveIntegerField(help_text="UZS so'mda")
    is_active = models.BooleanField(default=True)
    is_popular = models.BooleanField(default=False, help_text="UI da ajratib ko'rsatish uchun")
    sort_order = models.PositiveSmallIntegerField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ["sort_order", "credits"]
    
    def __str__(self):
        return f"{self.name} ({self.credits} credit / {self.price_uzs} UZS)"


class B2CTestAttempt(models.Model):
    """
    B2C foydalanuvchi testni boshlaganda yaratiladi.
    Kredit shu yerda atomic ravishda yechiladi.
    Test yakunlanganda B2CActivityEvent yaratiladi.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="b2c_test_attempts",
    )
    test = models.ForeignKey(
        "tests.Test",  # haqiqiy app/model yo'lini ishlatang
        on_delete=models.PROTECT,
        related_name="b2c_attempts",
    )
    credits_spent = models.PositiveIntegerField()
    
    class Status(models.TextChoices):
        IN_PROGRESS = "in_progress", "Davom etmoqda"
        COMPLETED = "completed", "Yakunlangan"
        ABANDONED = "abandoned", "Tashlab ketilgan"
        REFUNDED = "refunded", "Bekor qilingan"
    
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.IN_PROGRESS, db_index=True)
    
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    refunded_at = models.DateTimeField(null=True, blank=True)
    
    score = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    answers_count = models.PositiveSmallIntegerField(default=0, help_text="Refund eligibility uchun")
    minutes_spent = models.PositiveSmallIntegerField(default=0)
    
    class Meta:
        indexes = [models.Index(fields=["user", "-started_at"])]
        ordering = ["-started_at"]
    
    def __str__(self):
        return f"{self.user.email} — {self.test_id} — {self.status}"
    
    @property
    def is_refund_eligible(self):
        if self.status != self.Status.IN_PROGRESS:
            return False
        if self.answers_count > 0 and settings.B2C_REFUND_REQUIRES_ZERO_ANSWERS:
            return False
        delta = timezone.now() - self.started_at
        return delta.total_seconds() <= settings.B2C_REFUND_WINDOW_MINUTES * 60
```

### `apps/tests/models.py` — Test modeliga pricing field qo'shing

```python
class Test(models.Model):
    # ... mavjud field'lar ...
    # ETAP 16 dan: available_for_b2c, b2c_published_at, b2c_display_name, b2c_description
    
    # ETAP 17 — per-test pricing override
    b2c_credits_cost = models.PositiveSmallIntegerField(
        null=True, blank=True,
        help_text="Kredit narxi. Bo'sh qoldirilsa, global default qiymatga qaytadi (section uchun 2, full uchun 5).",
    )
    
    @property
    def b2c_credits_cost_effective(self):
        """Aslidagi narx — override yoki global default."""
        from django.conf import settings
        if self.b2c_credits_cost is not None:
            return self.b2c_credits_cost
        if self.section_type == "full":  # haqiqiy field nomini ishlating
            return settings.B2C_DEFAULT_FULL_TEST_CREDITS
        return settings.B2C_DEFAULT_SECTION_CREDITS
```

Migration:
```bash
python manage.py makemigrations b2c tests
python manage.py migrate
```

---

## 2-bosqich: Credit services (core logic)

### `apps/b2c/services/credits.py`

```python
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from ..models import CreditBalance, CreditTransaction, B2CTestAttempt


class InsufficientCreditsError(Exception):
    pass


def get_or_create_balance(user):
    balance, _ = CreditBalance.objects.get_or_create(user=user)
    return balance


def get_balance(user):
    return get_or_create_balance(user).balance


@transaction.atomic
def grant_credits(user, amount, kind, *, note="", created_by=None, related_attempt=None, related_package=None):
    """Krediti qo'shish (signup bonus, purchase, refund, admin grant)."""
    assert amount > 0, "grant amount musbat bo'lishi shart"
    balance = CreditBalance.objects.select_for_update().get_or_create(user=user)[0]
    balance.balance += amount
    balance.save(update_fields=["balance", "updated_at"])
    
    return CreditTransaction.objects.create(
        user=user,
        kind=kind,
        amount=amount,
        balance_after=balance.balance,
        note=note,
        created_by=created_by,
        related_attempt=related_attempt,
        related_package=related_package,
    )


@transaction.atomic
def spend_credits(user, amount, *, related_attempt=None, note=""):
    """Kredit sarflash (test boshlanganda)."""
    assert amount > 0, "spend amount musbat bo'lishi shart"
    balance = CreditBalance.objects.select_for_update().get_or_create(user=user)[0]
    if balance.balance < amount:
        raise InsufficientCreditsError(
            f"Kredit yetarli emas: kerak {amount}, mavjud {balance.balance}"
        )
    balance.balance -= amount
    balance.save(update_fields=["balance", "updated_at"])
    
    return CreditTransaction.objects.create(
        user=user,
        kind=CreditTransaction.Kind.SPEND,
        amount=-amount,
        balance_after=balance.balance,
        related_attempt=related_attempt,
        note=note,
    )


@transaction.atomic
def deduct_credits(user, amount, *, created_by=None, note=""):
    """Admin tomonidan kredit olib tashlash (xato to'g'rilash uchun)."""
    assert amount > 0
    balance = CreditBalance.objects.select_for_update().get_or_create(user=user)[0]
    actual = min(amount, balance.balance)
    balance.balance -= actual
    balance.save(update_fields=["balance", "updated_at"])
    
    return CreditTransaction.objects.create(
        user=user,
        kind=CreditTransaction.Kind.ADMIN_DEDUCT,
        amount=-actual,
        balance_after=balance.balance,
        created_by=created_by,
        note=note,
    )


@transaction.atomic
def refund_attempt(attempt):
    """B2C test attempt'ni bekor qilish va kreditni qaytarish (agar eligible bo'lsa)."""
    if not attempt.is_refund_eligible:
        raise ValueError("Refund eligible emas (yoki muddat o'tib ketgan, yoki javob berilgan)")
    
    attempt.status = B2CTestAttempt.Status.REFUNDED
    attempt.refunded_at = timezone.now()
    attempt.save(update_fields=["status", "refunded_at"])
    
    return grant_credits(
        user=attempt.user,
        amount=attempt.credits_spent,
        kind=CreditTransaction.Kind.REFUND,
        related_attempt=attempt,
        note=f"Refund: attempt #{attempt.pk}",
    )


def grant_signup_bonus(user):
    """Yangi B2C user'ga signup bonusi (faqat bir marta)."""
    already = CreditTransaction.objects.filter(
        user=user, kind=CreditTransaction.Kind.SIGNUP_BONUS
    ).exists()
    if already:
        return None
    return grant_credits(
        user=user,
        amount=settings.B2C_SIGNUP_BONUS_CREDITS,
        kind=CreditTransaction.Kind.SIGNUP_BONUS,
        note="Ro'yxatdan o'tish bonusi",
    )


def get_history(user, limit=50):
    return user.credit_transactions.all()[:limit]
```

---

## 3-bosqich: Signup bonus signal

### `apps/b2c/signals.py`

```python
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import B2CProfile
from .services.credits import grant_signup_bonus


@receiver(post_save, sender=B2CProfile)
def trigger_signup_bonus(sender, instance, created, **kwargs):
    if created:
        grant_signup_bonus(instance.user)
```

### `apps/b2c/apps.py`

```python
from django.apps import AppConfig


class B2cConfig(AppConfig):
    name = "apps.b2c"
    default_auto_field = "django.db.models.BigAutoField"
    
    def ready(self):
        from . import signals  # noqa
```

**Eslatma:** Agar Google OAuth orqali user yaratishda B2CProfile boshqa joyda yaratilsa, bonus avtomatik beriladi (signal har holatda ishlaydi). Lekin mavjud B2C userlarga bonus bo'lmaydi — agar kerak bo'lsa, data migration orqali qo'lda berib chiqing yoki shell command yozing.

---

## 4-bosqich: Test runner integratsiya rejasi

**MUHIM:** Mavjud test runner (B2B kontekstida ishlatiladigan) avval o'rganib chiqing. Quyidagi 3 variant:

### Variant A — Mavjud runner'ni B2C uchun moslashtirish (tavsiya etilgan)

Mavjud `apps/sessions/` yoki `apps/practice/` ichidagi runner view'lari `Session` modeliga bog'langan bo'lishi mumkin. Buni shunday kengaytiring:

- Runner kirish nuqtasi yangi parametr qabul qiladi: `attempt_type` (b2b_session / b2c_attempt) va `attempt_id`
- Runner ichida — javoblarni saqlash, score hisoblash va completion handler ikkala holatda ham mos modelga yozadi
- B2C uchun completion → `B2CTestAttempt.status = COMPLETED`, `score`, `minutes_spent` yozish + `B2CActivityEvent` yaratish

### Variant B — Yangi yengil B2C runner

Agar B2B runner juda guruh-spetsifik bo'lsa, alohida yengil runner yarating:

- `/b2c/test/<attempt_id>/` — savol-javob UI
- `/b2c/test/<attempt_id>/submit/` — finalize endpoint
- Test rendering komponentlarini reuse qiling (savol render React komponentlari shared bo'lishi kerak)

### Variant C — Hybrid

Test rendering komponentlari shared, lekin attempt state management va completion logic alohida. Eng moslashuvchan, lekin biroz ko'p kod.

**Tavsiya:** Variant A ni avval ko'rib chiqing. Agar mavjud runner Session/Group ga juda chuqur bog'langan bo'lsa, Variant C ga o'ting.

### Test completion hook

Qaysi variant tanlansa ham, B2C test yakunlanganda quyidagi happen bo'lishi shart:

```python
@transaction.atomic
def complete_b2c_attempt(attempt, *, score, minutes_spent, answers_count):
    """Test runner completion handler."""
    from ..models import B2CActivityEvent
    
    attempt.status = B2CTestAttempt.Status.COMPLETED
    attempt.completed_at = timezone.now()
    attempt.score = score
    attempt.minutes_spent = minutes_spent
    attempt.answers_count = answers_count
    attempt.save()
    
    # Activity event — dashboard heatmap/streak uchun
    B2CActivityEvent.objects.create(
        user=attempt.user,
        section=attempt.test.section_type,  # haqiqiy field
        minutes_spent=minutes_spent,
        score=score,
        activity_date=timezone.now().date(),
    )
```

Buni `apps/b2c/services/attempts.py` ichida joylashtiring.

---

## 5-bosqich: Boshlash flow — credit gate

### `apps/b2c/services/attempts.py`

```python
from django.db import transaction
from ..models import B2CTestAttempt
from . import credits as credit_service


@transaction.atomic
def start_attempt(user, test):
    """
    Test attempt yaratish + kredit yechish (atomic).
    Yetarli kredit bo'lmasa InsufficientCreditsError ko'taradi.
    """
    cost = test.b2c_credits_cost_effective
    
    attempt = B2CTestAttempt.objects.create(
        user=user,
        test=test,
        credits_spent=cost,
    )
    
    credit_service.spend_credits(
        user=user,
        amount=cost,
        related_attempt=attempt,
        note=f"Test boshlash: {test.b2c_name}",
    )
    
    return attempt
```

### View — `apps/b2c/views.py` ga qo'shing

```python
from django.http import JsonResponse
from django.views import View
from .services import attempts as attempt_service
from .services.credits import InsufficientCreditsError
from apps.tests.models import Test


class B2CStartAttemptView(B2CUserRequiredMixin, View):
    """POST /b2c/catalog/<test_id>/start/"""
    
    def post(self, request, pk):
        try:
            test = Test.objects.get(pk=pk, available_for_b2c=True)
        except Test.DoesNotExist:
            return JsonResponse({"error": "not_found"}, status=404)
        
        try:
            attempt = attempt_service.start_attempt(request.user, test)
        except InsufficientCreditsError as e:
            return JsonResponse({
                "error": "insufficient_credits",
                "message": str(e),
                "required": test.b2c_credits_cost_effective,
                "balance": request.user.credit_balance.balance,
            }, status=402)
        
        # Test runner URL'ga yo'naltirish
        # Variant A: mavjud runner — runner URL'ini moslang
        runner_url = f"/b2c/test/{attempt.pk}/"  # yoki mavjud runner pattern
        
        return JsonResponse({
            "attempt_id": attempt.pk,
            "redirect_url": runner_url,
            "credits_spent": attempt.credits_spent,
            "new_balance": request.user.credit_balance.balance,
        })
```

URL:
```python
path("catalog/<int:pk>/start/", views.B2CStartAttemptView.as_view(), name="catalog_start"),
```

### Frontend — `CatalogDetailPage.tsx` yangilash

Hozirgi "Boshlash" tugmasi modali "Kredit tizimi tez orada" deydi. Buni real flow bilan almashtiring:

```tsx
// CatalogDetailPage.tsx
const [showConfirm, setShowConfirm] = useState(false);
const [starting, setStarting] = useState(false);
const balance = useBalance();  // hook for credit balance

const handleStart = async () => {
  setStarting(true);
  try {
    const res = await fetch(`/api/v1/b2c/catalog/${test.id}/start`, {
      method: "POST",
      headers: { "X-CSRFToken": csrf, "Content-Type": "application/json" },
    });
    
    if (res.status === 402) {
      const data = await res.json();
      toast.error(`Kreditlar yetarli emas (kerak ${data.required}, mavjud ${data.balance})`);
      navigate("/b2c/credits");
      return;
    }
    
    if (!res.ok) throw new Error("start failed");
    const data = await res.json();
    navigate(data.redirect_url);
  } catch (e) {
    toast.error("Xatolik yuz berdi");
  } finally {
    setStarting(false);
  }
};

// Render — confirm modal:
<Modal open={showConfirm} onClose={() => setShowConfirm(false)}>
  <h3 className="text-lg font-bold mb-2">Testni boshlash</h3>
  <p className="text-sm text-gray-600 mb-4">
    Ushbu testni boshlash uchun <b>{test.credits_cost} credit</b> sarflanadi.
    Hozirgi balansingiz: <b>{balance} credit</b>.
  </p>
  {balance < test.credits_cost && (
    <p className="text-sm text-red-600 mb-3">Kreditlar yetarli emas. Avval kredit sotib oling.</p>
  )}
  <div className="flex gap-2">
    <button onClick={() => setShowConfirm(false)} className="flex-1 border border-gray-300 rounded-lg py-2">
      Bekor qilish
    </button>
    <button
      onClick={handleStart}
      disabled={starting || balance < test.credits_cost}
      className="flex-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg py-2 disabled:opacity-50"
    >
      {starting ? "..." : "Boshlash"}
    </button>
  </div>
</Modal>
```

**Catalog serializer'ga `b2c_credits_cost_effective` ni `credits_cost` deb qo'shing.**

---

## 6-bosqich: `/b2c/credits/` sahifa

### Backend — `apps/b2c/views.py`

```python
class B2CCreditsView(B2CUserRequiredMixin, TemplateView):
    template_name = "b2c/credits.html"
    
    def get_context_data(self, **kwargs):
        from .services import credits as credit_service
        from .models import CreditPackage
        
        ctx = super().get_context_data(**kwargs)
        ctx["balance"] = credit_service.get_balance(self.request.user)
        ctx["history"] = credit_service.get_history(self.request.user, limit=50)
        ctx["packages"] = CreditPackage.objects.filter(is_active=True)
        return ctx
```

URL:
```python
path("credits/", views.B2CCreditsView.as_view(), name="credits"),
```

### Frontend — `pages/b2c/CreditsPage.tsx`

```tsx
import { B2CLayout } from "@/components/B2CLayout";
import { useCredits } from "@/hooks/useCredits";

export function CreditsPage() {
  const { balance, history, packages } = useCredits();
  
  return (
    <B2CLayout active="credits">
      {/* Balance hero */}
      <div className="bg-gradient-to-br from-rose-500 to-amber-500 rounded-2xl p-8 text-white mb-5">
        <p className="text-sm opacity-90 mb-1">Joriy balans</p>
        <p className="text-5xl font-bold mb-2">{balance} <span className="text-xl">credit</span></p>
        <p className="text-xs opacity-80">1 section ≈ 2 credit · 1 full test ≈ 5 credit</p>
      </div>
      
      {/* Packages */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-5">
        <h2 className="text-lg font-bold mb-1">Kredit paketlar</h2>
        <p className="text-sm text-gray-500 mb-4">Tez orada to'lov tizimi ulanadi</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {packages.map((p) => (
            <div key={p.id} className={`border-2 rounded-xl p-5 ${p.is_popular ? "border-rose-500 bg-rose-50/30" : "border-gray-200"}`}>
              {p.is_popular && <span className="text-[10px] font-bold text-rose-600 bg-rose-100 px-2 py-0.5 rounded-full mb-2 inline-block">POPULAR</span>}
              <h3 className="font-bold text-lg">{p.name}</h3>
              <p className="text-3xl font-bold my-2">{p.credits} <span className="text-sm font-medium text-gray-500">credit</span></p>
              <p className="text-sm text-gray-600 mb-3">{p.price_uzs.toLocaleString()} UZS</p>
              <button disabled className="w-full bg-gray-100 text-gray-400 rounded-lg py-2 text-sm font-medium cursor-not-allowed">
                Sotib olish (SOON)
              </button>
            </div>
          ))}
        </div>
      </div>
      
      {/* History */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h2 className="text-lg font-bold mb-4">Tranzaksiya tarixi</h2>
        {history.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">Hozircha tranzaksiya yo'q</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {history.map((tx) => (
              <div key={tx.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800">{tx.kind_display}</p>
                  {tx.note && <p className="text-xs text-gray-500">{tx.note}</p>}
                  <p className="text-[11px] text-gray-400">{new Date(tx.created_at).toLocaleString("uz")}</p>
                </div>
                <p className={`text-lg font-bold ${tx.amount > 0 ? "text-green-600" : "text-red-600"}`}>
                  {tx.amount > 0 ? "+" : ""}{tx.amount}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </B2CLayout>
  );
}
```

API endpoint `/api/v1/b2c/credits` — balance, history, packages bitta JSON'da qaytaradi.

Route — `App.tsx`:
```tsx
<Route path="/b2c/credits" element={<B2CProtected><CreditsPage /></B2CProtected>} />
```

---

## 7-bosqich: Header'da kredit badge

### `components/B2CLayout.tsx` — header'ga badge qo'shing

```tsx
import { useBalance } from "@/hooks/useBalance";

function CreditBadge() {
  const balance = useBalance();
  return (
    <Link to="/b2c/credits" className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 hover:border-amber-400 rounded-full px-3 py-1.5 text-sm font-semibold text-amber-700 transition">
      <span>⚡</span>
      <span>{balance}</span>
    </Link>
  );
}

// Header ichida (user email yonida):
<div className="flex items-center gap-3">
  <CreditBadge />
  <Link to="/b2c/profile">{user.full_name}</Link>
  <button onClick={logout}>Chiqish</button>
</div>
```

### `hooks/useBalance.ts`

Global state (Zustand yoki Context) orqali balansni kuzating va kredit operatsiyalaridan keyin yangilang. Yoki `/api/v1/b2c/me/balance` ni periodically chaqirish.

```tsx
import { useEffect } from "react";
import { create } from "zustand";

interface BalanceState {
  balance: number;
  refresh: () => Promise<void>;
}

export const useBalanceStore = create<BalanceState>((set) => ({
  balance: 0,
  refresh: async () => {
    const res = await fetch("/api/v1/b2c/me/balance");
    if (res.ok) {
      const data = await res.json();
      set({ balance: data.balance });
    }
  },
}));

export function useBalance() {
  const { balance, refresh } = useBalanceStore();
  useEffect(() => { refresh(); }, [refresh]);
  return balance;
}
```

Kredit yechilgandan keyin (start_attempt'dan keyin) `refresh()` chaqiring.

---

## 8-bosqich: Sidebar va Dashboard yangilash

### Sidebar — `Kreditlar [SOON]` → real link

```tsx
// B2CLayout.tsx sidebar
<NavItem to="/b2c/credits" icon="💎" active={active === "credits"}>
  Kreditlar
</NavItem>
```

### Dashboard Getting Started — "Kreditlarni ko'rish" real

`activity.py::get_getting_started`:
```python
items = [
    {"key": "profile", "label": "Profilni to'ldiring", "done": has_phone and has_target, "href": "/b2c/profile/"},
    {"key": "first_test", "label": "Birinchi testni boshlang", "done": has_first_event, "href": "/b2c/catalog/"},
    {"key": "credits", "label": "Kreditlarni ko'ring", "done": balance > 0, "href": "/b2c/credits/"},
    {"key": "results", "label": "Natijalaringizni ko'ring", "done": has_first_event, "href": "/b2c/history/"},  # ETAP 17.5+
]
```

`balance > 0` — signup bonusdan keyin avtomatik ✓ bo'ladi.

---

## 9-bosqich: Super-admin — kredit boshqaruvi

### Backend — `apps/super_admin/views.py`

```python
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth import get_user_model
from apps.b2c.services import credits as credit_service
from apps.b2c.models import CreditTransaction

User = get_user_model()


class SuperAdminCreditUsersView(APIView):
    """B2C userlar ro'yxati balans bilan."""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        if request.user.user_type != "superadmin":
            return Response(status=403)
        
        q = request.query_params.get("q", "").strip()
        qs = User.objects.filter(user_type="b2c_user").select_related("credit_balance")
        if q:
            qs = qs.filter(
                models.Q(email__icontains=q) |
                models.Q(first_name__icontains=q) |
                models.Q(last_name__icontains=q)
            )
        qs = qs.order_by("-date_joined")[:100]
        
        return Response([
            {
                "id": u.id,
                "email": u.email,
                "full_name": u.get_full_name(),
                "balance": u.credit_balance.balance if hasattr(u, "credit_balance") else 0,
                "joined_at": u.date_joined,
            }
            for u in qs
        ])


class SuperAdminCreditGrantView(APIView):
    """Userga kredit grant qilish."""
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        if request.user.user_type != "superadmin":
            return Response(status=403)
        
        user_id = request.data.get("user_id")
        amount = int(request.data.get("amount", 0))
        note = request.data.get("note", "")
        action = request.data.get("action", "grant")  # grant yoki deduct
        
        if amount <= 0:
            return Response({"error": "amount must be positive"}, status=400)
        
        user = User.objects.get(pk=user_id)
        
        if action == "grant":
            tx = credit_service.grant_credits(
                user=user, amount=amount,
                kind=CreditTransaction.Kind.ADMIN_GRANT,
                created_by=request.user, note=note,
            )
        else:
            tx = credit_service.deduct_credits(
                user=user, amount=amount,
                created_by=request.user, note=note,
            )
        
        return Response({"new_balance": user.credit_balance.balance, "transaction_id": tx.id})


class SuperAdminCreditHistoryView(APIView):
    """Bitta foydalanuvchining tranzaksiya tarixi."""
    permission_classes = [IsAuthenticated]
    
    def get(self, request, user_id):
        if request.user.user_type != "superadmin":
            return Response(status=403)
        
        user = User.objects.get(pk=user_id)
        history = user.credit_transactions.select_related("created_by", "related_attempt__test")[:200]
        
        return Response({
            "user": {"id": user.id, "email": user.email, "balance": user.credit_balance.balance},
            "transactions": [
                {
                    "id": tx.id,
                    "kind": tx.kind,
                    "kind_display": tx.get_kind_display(),
                    "amount": tx.amount,
                    "balance_after": tx.balance_after,
                    "note": tx.note,
                    "created_by": tx.created_by.email if tx.created_by else None,
                    "created_at": tx.created_at,
                    "related_test_id": tx.related_attempt.test_id if tx.related_attempt else None,
                }
                for tx in history
            ],
        })
```

### Frontend — `pages/superadmin/SuperAdminCreditsPage.tsx`

```tsx
import { useState } from "react";

export function SuperAdminCreditsPage() {
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [history, setHistory] = useState([]);
  
  const [grantAmount, setGrantAmount] = useState(0);
  const [grantNote, setGrantNote] = useState("");
  
  const loadUsers = async () => {
    const res = await fetch(`/api/v1/super/b2c/credit-users?q=${encodeURIComponent(search)}`);
    setUsers(await res.json());
  };
  
  const loadHistory = async (userId: number) => {
    const res = await fetch(`/api/v1/super/b2c/credit-users/${userId}/history`);
    const data = await res.json();
    setSelectedUser(data.user);
    setHistory(data.transactions);
  };
  
  const grant = async (action: "grant" | "deduct") => {
    if (!selectedUser || grantAmount <= 0) return;
    const res = await fetch(`/api/v1/super/b2c/credit-grant`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: selectedUser.id, amount: grantAmount, note: grantNote, action,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      toast.success(`Yangi balans: ${data.new_balance}`);
      setGrantAmount(0); setGrantNote("");
      loadHistory(selectedUser.id);
    }
  };
  
  return (
    <SuperAdminLayout>
      <h1 className="text-2xl font-bold mb-5">B2C Kreditlar</h1>
      
      <div className="grid grid-cols-3 gap-5">
        {/* Users list */}
        <div className="col-span-1 bg-white border rounded-2xl p-4">
          <div className="flex gap-2 mb-3">
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Email yoki ism..."
              className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            />
            <button onClick={loadUsers} className="bg-rose-600 text-white px-3 py-1.5 rounded-lg text-sm">
              Qidirish
            </button>
          </div>
          <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
            {users.map((u) => (
              <button key={u.id} onClick={() => loadHistory(u.id)}
                      className="w-full text-left py-2 hover:bg-gray-50 px-2 -mx-2 rounded">
                <p className="text-sm font-medium">{u.full_name || u.email}</p>
                <p className="text-xs text-gray-500">{u.email} · ⚡ {u.balance}</p>
              </button>
            ))}
          </div>
        </div>
        
        {/* User detail */}
        <div className="col-span-2 bg-white border rounded-2xl p-6">
          {selectedUser ? (
            <>
              <h2 className="text-lg font-bold">{selectedUser.email}</h2>
              <p className="text-sm text-gray-500 mb-4">Balans: <b className="text-rose-600">⚡ {selectedUser.balance}</b></p>
              
              {/* Grant form */}
              <div className="bg-gray-50 rounded-xl p-4 mb-5">
                <h3 className="font-semibold mb-3">Kredit operatsiya</h3>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <input type="number" value={grantAmount} onChange={(e) => setGrantAmount(parseInt(e.target.value) || 0)}
                         placeholder="Miqdor" className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
                  <input type="text" value={grantNote} onChange={(e) => setGrantNote(e.target.value)}
                         placeholder="Izoh (majburiy)" className="col-span-2 border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => grant("grant")} disabled={!grantNote}
                          className="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50">
                    + Qo'shish
                  </button>
                  <button onClick={() => grant("deduct")} disabled={!grantNote}
                          className="bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50">
                    − Olib tashlash
                  </button>
                </div>
              </div>
              
              {/* History */}
              <h3 className="font-semibold mb-2">Tarix</h3>
              <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                {history.map((tx) => (
                  <div key={tx.id} className="py-2 flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium">{tx.kind_display}</p>
                      {tx.note && <p className="text-xs text-gray-500">{tx.note}</p>}
                      <p className="text-[11px] text-gray-400">
                        {new Date(tx.created_at).toLocaleString("uz")}
                        {tx.created_by && ` · admin: ${tx.created_by}`}
                      </p>
                    </div>
                    <span className={`font-bold ${tx.amount > 0 ? "text-green-600" : "text-red-600"}`}>
                      {tx.amount > 0 ? "+" : ""}{tx.amount}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-gray-500">User tanlang</p>
          )}
        </div>
      </div>
    </SuperAdminLayout>
  );
}
```

URLs:
```python
# apps/super_admin/urls.py
path("b2c/credit-users", views.SuperAdminCreditUsersView.as_view()),
path("b2c/credit-users/<int:user_id>/history", views.SuperAdminCreditHistoryView.as_view()),
path("b2c/credit-grant", views.SuperAdminCreditGrantView.as_view()),
```

Frontend route:
```tsx
<Route path="/super/credits" element={<SuperAdminProtected><SuperAdminCreditsPage /></SuperAdminProtected>} />
```

Super-admin sidebar'ga "B2C Kreditlar" link.

---

## 10-bosqich: Per-test pricing — Super-admin Catalog manage'da

`SuperAdminB2CCatalogPage` ga har bir test uchun `b2c_credits_cost` input qo'shing:

```tsx
<div className="grid grid-cols-3 gap-2">
  <input type="text" name="b2c_display_name" value={test.b2c_display_name || ""} placeholder="Ko'rsatma nomi" />
  <input
    type="number"
    name="b2c_credits_cost"
    value={test.b2c_credits_cost ?? ""}
    placeholder={`Default: ${test.section_type === "full" ? 5 : 2}`}
    min="1" max="50"
    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
  />
  <input type="text" name="b2c_description" value={test.b2c_description || ""} placeholder="Tavsif" />
</div>
```

Backend `b2c-meta` action'ga `b2c_credits_cost` ni qabul qilishi uchun yangilang. `null`/`""` qabul qilinsa, default'ga qaytadi.

---

## 11-bosqich: Credit paketlar — Django admin va initial data

### `apps/b2c/admin.py` ga qo'shing

```python
from .models import CreditBalance, CreditTransaction, CreditPackage, B2CTestAttempt


@admin.register(CreditPackage)
class CreditPackageAdmin(admin.ModelAdmin):
    list_display = ("name", "credits", "price_uzs", "is_active", "is_popular", "sort_order")
    list_filter = ("is_active", "is_popular")
    ordering = ("sort_order", "credits")


@admin.register(CreditBalance)
class CreditBalanceAdmin(admin.ModelAdmin):
    list_display = ("user", "balance", "updated_at")
    search_fields = ("user__email",)
    readonly_fields = ("balance", "updated_at")  # faqat service orqali o'zgartirish


@admin.register(CreditTransaction)
class CreditTransactionAdmin(admin.ModelAdmin):
    list_display = ("user", "kind", "amount", "balance_after", "created_by", "created_at")
    list_filter = ("kind", "created_at")
    search_fields = ("user__email", "note")
    readonly_fields = ("user", "kind", "amount", "balance_after", "created_by", "note", "related_attempt", "related_package", "created_at")
    date_hierarchy = "created_at"


@admin.register(B2CTestAttempt)
class B2CTestAttemptAdmin(admin.ModelAdmin):
    list_display = ("user", "test", "status", "credits_spent", "score", "started_at", "completed_at")
    list_filter = ("status", "started_at")
    search_fields = ("user__email",)
    date_hierarchy = "started_at"
```

### Initial paketlar — data migration

```bash
python manage.py makemigrations --empty b2c --name initial_credit_packages
```

```python
def create_packages(apps, schema_editor):
    CreditPackage = apps.get_model("b2c", "CreditPackage")
    CreditPackage.objects.bulk_create([
        CreditPackage(name="Boshlovchi", credits=10, price_uzs=50_000, sort_order=1),
        CreditPackage(name="Standart", credits=30, price_uzs=120_000, is_popular=True, sort_order=2),
        CreditPackage(name="Mukammal", credits=80, price_uzs=280_000, sort_order=3),
    ])

def reverse(apps, schema_editor):
    apps.get_model("b2c", "CreditPackage").objects.all().delete()

class Migration(migrations.Migration):
    dependencies = [("b2c", "<oldingi migration>")]
    operations = [migrations.RunPython(create_packages, reverse)]
```

Narxlar va miqdorlarni Jasmina admin orqali keyinroq sozlashi mumkin.

---

## 12-bosqich: Smoke test + manual checklist

### Shell sinov

```bash
python manage.py shell
```

```python
from django.contrib.auth import get_user_model
from apps.b2c.services import credits, attempts
from apps.b2c.models import CreditTransaction
from apps.tests.models import Test

User = get_user_model()

# 1. Signup bonus
u = User.objects.get(email="test@example.com")
print(f"Balance: {credits.get_balance(u)}")  # 3 bo'lishi kerak

# 2. Spend
t = Test.objects.filter(available_for_b2c=True).first()
attempt = attempts.start_attempt(u, t)
print(f"Spent {attempt.credits_spent}, new balance: {credits.get_balance(u)}")

# 3. Insufficient
from apps.b2c.services.credits import InsufficientCreditsError
try:
    for _ in range(10):
        attempts.start_attempt(u, t)
except InsufficientCreditsError as e:
    print(f"Caught: {e}")

# 4. Admin grant
credits.grant_credits(u, 50, CreditTransaction.Kind.ADMIN_GRANT, note="Test grant")
print(f"After grant: {credits.get_balance(u)}")

# 5. Refund
attempt = attempts.start_attempt(u, t)
credits.refund_attempt(attempt)
print(f"After refund: {credits.get_balance(u)}")
```

### Manual test checklist

- [ ] Yangi B2C user signup qilsa — avtomatik 3 credit oladi (header'da `⚡ 3`)
- [ ] Dashboard'da Getting Started "Kreditlarni ko'ring" ✓ bo'ladi
- [ ] `/b2c/credits/` sahifa — balance, history (signup bonus tranzaksiya), 3 ta paket ko'rinadi
- [ ] Paket "Sotib olish" tugmasi disabled, "SOON" ko'rsatadi
- [ ] Catalog detail sahifada test narxi real ko'rsatiladi (default 2 yoki 5)
- [ ] "Boshlash" → confirm modal kerakli narx va balansni ko'rsatadi
- [ ] Yetarli balans → spend → redirect to runner → kredit kamayadi
- [ ] Header badge avtomatik yangilanadi
- [ ] Yetmagan balans → "Kreditlar yetarli emas" → kreditlar sahifasiga redirect
- [ ] Test yakunlanganda — Activity event yaratiladi, dashboard heatmap'da ko'rinadi, streak hisoblanadi
- [ ] Super-admin `/super/credits/` — user qidirish, history ko'rish, grant/deduct ishlaydi
- [ ] Super-admin grant izohsiz qabul qilmaydi (validation)
- [ ] Super-admin Catalog manage'da test narxini override qila oladi, bo'sh qoldirilsa default'ga qaytadi
- [ ] Refund eligible attempt (0 javob + 5 daqiqa ichida) — shell orqali bekor qilinadi, kredit qaytadi
- [ ] Concurrent spend (race condition) — `select_for_update` himoya qiladi
- [ ] B2B user `/b2c/credits/` ga kirsa — middleware bloklaydi
- [ ] B2C user `/super/credits/` ga kirsa — 403
- [ ] Credit paketlar `is_active=False` bo'lsa, sahifada ko'rinmaydi

---

## 13-bosqich: Git commit va push (MAJBURIY)

```bash
git add .
git commit -m "ETAP 17: B2C Credit System — balance, transactions, signup bonus, test gate, super-admin grants, per-test pricing"
git push origin <branch-nomi>
```

---

## Yakuniy checklist

- [ ] Modellar: `CreditBalance`, `CreditTransaction`, `CreditPackage`, `B2CTestAttempt`
- [ ] `Test.b2c_credits_cost` field + `b2c_credits_cost_effective` property
- [ ] Settings: `B2C_SIGNUP_BONUS_CREDITS`, `B2C_DEFAULT_SECTION_CREDITS`, `B2C_DEFAULT_FULL_TEST_CREDITS`, `B2C_REFUND_WINDOW_MINUTES`, `B2C_REFUND_REQUIRES_ZERO_ANSWERS`
- [ ] `services/credits.py`: grant, spend, deduct, refund, get_balance, get_history
- [ ] `services/attempts.py`: start_attempt, complete_b2c_attempt
- [ ] Signup signal — `B2CProfile` yaratilganda bonus avtomatik
- [ ] `apps.py` da `ready()` signal'ni yuklaydi
- [ ] `/api/v1/b2c/catalog/<id>/start/` endpoint
- [ ] `/api/v1/b2c/me/balance` endpoint (header badge uchun)
- [ ] `/api/v1/b2c/credits` endpoint (balance + history + packages)
- [ ] `/b2c/credits/` sahifa — balance hero, packages, history
- [ ] Header'da `<CreditBadge>` har sahifada
- [ ] Catalog detail — real narx, confirm modal, start flow
- [ ] Sidebar "Kreditlar [SOON]" → aktiv
- [ ] Getting Started "Kreditlarni ko'ring" real
- [ ] Test runner integratsiya — completion'da `complete_b2c_attempt` chaqiriladi
- [ ] Super-admin `/super/credits/` — search, grant/deduct, history
- [ ] Super-admin Catalog manage'da `b2c_credits_cost` input
- [ ] Initial 3 ta CreditPackage data migration
- [ ] Django admin'da barcha modellar
- [ ] Migration fayllar git'da
- [ ] Smoke test shell snippet ishlatildi
- [ ] `git push origin <branch>` muvaffaqiyatli

---

## ETAP 18 oldidan eslatma

Keyingi ETAP'da **to'lov integratsiyasi**:
- `/b2c/credits/` dagi paket "Sotib olish (SOON)" tugmalari Click yoki Payme ga ulanadi
- `Payment` model — `CreditPackage`, `user`, `amount`, `provider`, `status`, `external_id`
- Webhook handler — to'lov tasdiqlangach `grant_credits(kind=PURCHASE)` chaqiradi
- ETAP 18 promptida sizdan **provayder tanlovi** so'raladi: Click, Payme, yoki ikkalasi ham

Hozirgi `CreditPackage` modeli va "SOON" tugmalar shu uchun saqlangan.
