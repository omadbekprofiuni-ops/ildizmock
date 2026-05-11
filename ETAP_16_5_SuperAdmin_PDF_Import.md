# ETAP 16.5: Super-Admin PDF Import (qisqa ETAP)

## Kontekst

ETAP 16-da B2C Test Catalog tayyor bo'ldi, lekin **katalogga test quyish sekin** — chunki super-admin testlarni faqat Wizard orqali yaratadi. Loyihada **PDF import allaqachon mavjud**, lekin faqat `center/admin` darajada:

| Marshrut | Joy | Komponent |
|---|---|---|
| `/<slug>/admin/tests/pdf-create` | Center | `PDFTestCreate` |
| `/<slug>/admin/tests/import/listening` | Center | `ListeningPdfImportPage` |
| `/<slug>/admin/tests/new/pdf-import` | Center | `PdfImportPage` (ETAP 31 Smart PDF) |
| `/admin/tests/new/pdf-import` | Org-admin | `PdfImportPage` |
| `/super/tests/...` | **Super-admin** | **PDF varianti yo'q — faqat Wizard** |

Backend endpoint'lar (`/api/v1/admin/tests/import-pdf/preview/` va `/confirm/`) `IsCenterAdmin` (yoki `IsCenterOrOrgAdmin`) permission'iga sozlangan.

**Vazifa:** Super-admin'da ham PDF import bo'lsin, Jasmina B2C katalogi uchun Cambridge kitoblardan testlarni tez qo'sha olsin.

## Maqsad

1. Super-admin `/super/tests/new/pdf-import` orqali PDF import sahifasiga kira oladi
2. `SuperTestsListPage` da "+ Import PDF" tugmasi
3. PDF preview → confirm flow ishlaydi (org-admin variantidagidek)
4. Yaratilgan test super-admin testlari sifatida saqlanadi (center FK yo'q, yoki "global" sifatida)
5. Confirm'dan keyin user `SuperTestsListPage` ga (yoki yaratilgan test detail/edit sahifasiga) yo'naltiriladi, u yerdan keyin `B2C Catalog manage` orqali B2C ga publish qila oladi

---

## 1-bosqich: Backend — permission va endpoint

**Mavjud endpoint'larni tekshiring:**
- `/api/v1/admin/tests/import-pdf/preview/`
- `/api/v1/admin/tests/import-pdf/confirm/`

Ulardagi `IsCenterAdmin` permission'ni nima qilish kerakligi loyiha strukturasiga bog'liq:

### Variant A — Mavjud endpoint'ga super-admin'ni qo'shish (tavsiya etilgan)

Permission class'ni kengaytiring: super-admin'ga ham ruxsat bering, lekin **super-admin uchun `center` parametri kerak emas/null bo'lishi** kerak.

```python
# apps/tests/permissions.py (yoki haqiqiy joy)
from rest_framework.permissions import BasePermission

class IsCenterOrSuperAdmin(BasePermission):
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        return (
            request.user.user_type == "superadmin"
            or getattr(request.user, "is_center_admin", False)
            or request.user.user_type == "b2b_admin"
        )
```

View ichida — agar super-admin bo'lsa, center FK'ni null qoldiring (yoki "global" maxsus center'ga bog'lang, loyiha modeliga moslang):

```python
# import-pdf confirm view ichida
def perform_create(self, serializer):
    if self.request.user.user_type == "superadmin":
        # Super-admin testlari uchun center yo'q (yoki global center)
        serializer.save(center=None, created_by=self.request.user)
    else:
        # Mavjud center logikasi
        serializer.save(center=self.request.user.center, created_by=self.request.user)
```

### Variant B — Yangi super-admin endpoint

Agar mavjud endpoint center-only logikaga juda bog'langan bo'lsa, alohida endpoint yarating:

- `POST /api/v1/super/tests/import-pdf/preview/`
- `POST /api/v1/super/tests/import-pdf/confirm/`

Logikaning ko'p qismi takrorlanmasligi uchun shared service function'ga ajrating (`apps/tests/services/pdf_import.py`).

**Cursor Agent:** Loyihaning haqiqiy permission strukturasi va `Test` modelining center bilan munosabatini ko'rib, qaysi variant qulayligini tanlang. Variant A oddiyroq bo'lsa shu yaxshi.

---

## 2-bosqich: Frontend — sahifa va route

### Yangi sahifa: `pages/superadmin/SuperAdminPdfImportPage.tsx`

Mavjud `PdfImportPage` komponentini iloji boricha qayta ishlatishga harakat qiling. Ikki variant:

**Variant A — Mavjud komponentni props orqali sozlash:**

Agar `PdfImportPage` allaqachon `mode` yoki `apiBase` propini qabul qilsa, super-admin uchun shuni o'zgartiring:

```tsx
import { PdfImportPage } from "@/pages/admin/PdfImportPage";

export function SuperAdminPdfImportPage() {
  return (
    <SuperAdminLayout>
      <PdfImportPage
        mode="super"
        apiBase="/api/v1/admin/tests/import-pdf"  // yoki /super/...
        onSuccess={(testId) => navigate(`/super/tests/${testId}`)}
        backUrl="/super/tests"
      />
    </SuperAdminLayout>
  );
}
```

**Variant B — Alohida yupqa wrapper:**

Agar `PdfImportPage` ichida hard-coded admin context bo'lsa, yangi sahifani uning logikasini reusable hook (`usePdfImport`) ga ajratib, ikkalasini bittadan iste'mol qilish.

### Route — `App.tsx` ga qo'shish

```tsx
<Route
  path="/super/tests/new/pdf-import"
  element={
    <SuperAdminProtectedRoute>
      <SuperAdminPdfImportPage />
    </SuperAdminProtectedRoute>
  }
/>
```

Loyihadagi haqiqiy super-admin protected route komponentiga moslang.

---

## 3-bosqich: `SuperTestsListPage` da "+ Import PDF" tugmasi

Hozirgi "+ New Test" yoki "Wizard" tugmasi yonida ikkinchi tugma qo'shing. Tipik joylashuv — page header'da, o'ngda:

```tsx
// pages/superadmin/SuperTestsListPage.tsx
<div className="flex items-center gap-2">
  <Link
    to="/super/tests/new/pdf-import"
    className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-medium"
  >
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M9 13h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V20a2 2 0 01-2 2z" />
    </svg>
    Import PDF
  </Link>
  
  <Link
    to="/super/tests/new"
    className="inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
  >
    + Yangi test
  </Link>
</div>
```

---

## 4-bosqich: Yaratilgandan keyingi flow

PDF confirm muvaffaqiyatli bo'lganda super-admin'ga aniq keyingi qadam ko'rinsin:

1. Test yaratildi → `SuperTestsListPage` ga redirect (yangi test tepada)
   yoki
2. Test detail/edit sahifasiga redirect, u yerda **"B2C katalogga chiqarish"** tugmasi (bu testning `available_for_b2c` ni toggle qiladi)

Eng qulay variant: test detail sahifasida (yoki test edit'da) "B2C ga chiqarish" toggle tugmasi bo'lsin — `SuperAdminB2CCatalogPage` da kabi, lekin individual test sahifasida ham qisqartirilgan ko'rinishda. Bu user'ni `B2C Catalog manage` sahifasiga alohida o'tmasdan amalni bajara olish imkonini beradi.

Agar test detail sahifasida hozircha bunday toggle bo'lmasa, success xabarda link qo'shing:

```tsx
toast.success(
  <>
    Test yaratildi.{" "}
    <Link to={`/super/b2c-catalog?q=${encodeURIComponent(test.name)}`} className="underline">
      B2C katalogga chiqarish
    </Link>
  </>
);
```

---

## 5-bosqich: Manual test checklist

- [ ] Super-admin sifatida login bo'ling
- [ ] `/super/tests` sahifasida "+ Import PDF" tugmasi ko'rinadi
- [ ] Tugma `/super/tests/new/pdf-import` ga olib boradi
- [ ] PDF yuklash → preview → confirm flow ishlaydi
- [ ] Yaratilgan test super-admin testlari ro'yxatida ko'rinadi
- [ ] Test'ni `B2C Catalog manage` orqali toggle qilib publish qilish mumkin
- [ ] Center admin sifatida ham PDF import sahifasi avvalgidek ishlaydi (regression yo'q)
- [ ] B2C user va B2B teacher `/super/tests/new/pdf-import` ga kirsa — 403/redirect bo'ladi

---

## 6-bosqich: Git commit va push (MAJBURIY)

```bash
git add .
git commit -m "ETAP 16.5: Super-admin PDF import — endpoint permission, route, SuperTestsListPage tugmasi"
git push origin <branch-nomi>
```

---

## Yakuniy checklist

- [ ] Backend permission super-admin uchun kengaytirilgan (yoki yangi endpoint)
- [ ] Super-admin uchun PDF import test yaratganda center=null (yoki global)
- [ ] `SuperAdminPdfImportPage.tsx` mavjud
- [ ] `/super/tests/new/pdf-import` route ishlaydi
- [ ] `SuperTestsListPage` da "+ Import PDF" tugmasi
- [ ] Success flow — yaratilgan testdan B2C ga publish qilish oson
- [ ] Center admin variantida regression yo'q
- [ ] Git push muvaffaqiyatli

---

## Keyingi qadam — ETAP 17 oldidan

Bu ETAP'dan keyin **katalog uchun 10-20 ta test qo'shing** (PDF importdan foydalanib). Keyin ETAP 17 (Kredit tizimi) ga o'tamiz. ETAP 17 promptidan oldin men sizdan bir necha biznes qarorlarini so'rayman:

- Signup bonus nechta credit?
- Section narxi vs full test narxi (global yoki per-test)?
- Credit muddati bormi?
- Yarim yechilgan testdan chiqilsa refund qilinadimi?

Shu javoblar bilan ETAP 17 to'g'ri tuziladi.
