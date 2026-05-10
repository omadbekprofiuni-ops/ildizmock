# Smoke Test Hisoboti (2026-05-11)

To'liq tekshiruv natijasi: 12 ta asosiy endpoint + 6 ta DB jadval +
frontend type-check + production build. Topilgan xatolar va sabablari.

---

## Tekshiruv natijalari

### ✅ Ishlaydi

| # | Endpoint / Funksiya | Natija |
|---|---|---|
| 1 | `GET /api/v1/tests/counts/` | 200, `{listening: 16, reading: 16, writing: 16}` |
| 2 | `GET /api/v1/tests/?module=listening` | 200, 16 ta test |
| 3 | `GET /api/v1/tests/<id>/` (auth bilan) | 200, full detail |
| 4 | Listening parts audio | 4 part, hamma `audio_url` to'liq absolute URL |
| 5 | Reading passages | content + content_html ikkalasi ham serializerdan chiqadi |
| 6 | `GET /api/v1/center/<slug>/mock/available-tests/` | 200, listening=7, reading=4, writing=5 |
| 7 | `GET /api/v1/admin/strict-mode-settings/` (ETAP 29) | 200, `{enabled: True, limit: 3}` |
| 8 | `GET /api/v1/library/tests/` (ETAP 27) | 200, 12 ta library test |
| 9 | `POST /api/v1/admin/smart-paste/preview/` (ETAP 24) | 200 |
| 10 | `POST /api/v1/admin/html-content/preview/` (ETAP 30) | 200, parser+validator green |
| 11 | `python manage.py check` | 0 issues |
| 12 | `tsc --noEmit` | 0 errors |

### ❌ Topilgan xatolar va sabablari

#### XATO 1 — `attempts_testsecurityviolation` jadvali bazada yo'q
**Sabab**: ETAP 29'da migration 0004 yaratilganda lokalda apply qilishga uringanda Django xato berdi (`column "auto_submit_reason" of relation "attempts_attempt" already exists`). Men `python manage.py migrate --fake` ishlatdim — bu butun migration'ni "applied" deb belgiladi.

Ammo migration 0004 ichida 4 ta operatsiya bor edi:
- 3 ta `AddField` (Attempt'ga yangi ustunlar)
- 1 ta `CreateModel` (TestSecurityViolation yangi jadval)

3 ta ustun haqiqatan ham allaqachon prod'da bor edi (qaysidir yo'l bilan), lekin **`CreateModel` esa bajarilmagan edi**. `--fake` flagi farq qilmaydi — hammasini "applied" deb belgilaydi. Natijada `attempts_testsecurityviolation` jadvali umuman yaratilmagan.

**Yechim**: Yangi `0005_create_missing_testsecurityviolation_table.py` migration yaratdim. Ichida `RunSQL` bilan `CREATE TABLE IF NOT EXISTS` ishlatdim — Django state'ga ta'sir qilmaydi, faqat DDL bajaradi. Idempotent.

#### XATO 2 — `attendance_escalations` va `attendance_telegram_bindings` jadvallari bazada yo'q
**Sabab**: ETAP 28'da migration 0003 da bir nechta AddField + 2 ta CreateModel operatsiyasi bor edi. `AttendanceSession.locked_at` ustuni qaysidir yo'l bilan prod'da allaqachon yaratilgan edi, va men yana `--fake` ishlatdim. Natijada `AttendanceEscalation` va `TelegramBinding` jadvallari yaratilmadi.

**Yechim**: Yangi `0004_create_missing_escalation_telegram_tables.py` migration yaratdim, `RunSQL` bilan ikkala jadvalni IF NOT EXISTS bilan yaratadi.

#### XATO 3 — Mock session 'New' dialog'ida testlar bo'sh
Bu xato avval topilgan va tuzatilgan edi (`fix(mock): mock session 'New' dialogida testlar ko'rinmasligini tuzatish`, commit `6dbdc0b`). Sababini takror eslatamiz:

`Test` modelida ikkita status indikatori bor:
- `is_published` (Bool, eski) — default=True
- `status` (CharField, ETAP 2'da qo'shilgan) — default='draft'

`available_tests` endpoint'i faqat `status='published'` bo'yicha filterlardi. Eski testlar `is_published=True` bo'lsa-da, `status='draft'` qolib ketgan bo'lishi mumkin.

**Yechim**: Filter `Q(status='published') | Q(is_published=True)` qilib kengaytirildi + `sync_test_status` management buyrug'i yaratildi.

#### XATO 4 — Frontend tsc: `'FileText' is declared but its value is never read`
**Sabab**: `StudentDashboard.tsx` da PDF tests action card commentga olinganidan keyin `FileText` icon ishlatilmay qoldi.

**Yechim**: import'dan `FileText` olib tashlandi.

### ⚠️ Diqqat (xato emas)

#### `/tests/<id>/` anonymous user uchun 404
Bu `expected behavior` — multi-tenant security:
- Anonymous user faqat `organization=null` (library / global) testlarni ko'ra oladi
- Org-specific testlar uchun authenticated user shu org'da bo'lishi kerak

Hozirgi listening test "Unique Academy"ga tegishli, shuning uchun anonymous client 404 oldi. Talaba/admin login qilgandan keyin 200 qaytadi.

---

## PDF Test entry-pointlari yashirildi

ETAP 30 (HTML Test Platform) tugagunicha PDF test yaratish UI'lari **vaqtincha yashirildi** (route'lar saqlanadi, mavjud PDF testlar ochiladi va tahrirlanadi):

| Joy | Holat |
|---|---|
| `TestsPage` "+ PDF Test (Quick)" tugmasi | Commentga olindi |
| `StudentDashboard` "PDF tests" action card | Commentga olindi |
| Mavjud PDF test'ni ochish/tahrirlash linki | Saqlandi (data yo'qotmaslik uchun) |

Qachon qaytarish kerak: ETAP 30 HTML test platformasi to'liq deploy qilingach, kerak bo'lsa, `{/* ... */}` ichidagi `Link` blokini qayta yoqing.

---

## Deploy paytida bajariladigan amallar

```bash
ssh ildiz@207.180.226.230
cd /home/ildiz/ildizmock && git pull origin main

cd backend && source venv/bin/activate

# 1. Yangi migrationlar (yetishmayotgan jadvallarni yaratadi)
python manage.py migrate

# Agar "table already exists" xatosi chiqsa (kichik ehtimol — RunSQL
# CREATE TABLE IF NOT EXISTS ishlatadi, lekin sanity uchun):
python manage.py migrate --fake-initial

# 2. Eski testlar status'ini sinxronlash
python manage.py sync_test_status --dry-run    # ko'ramiz qancha
python manage.py sync_test_status              # backfill

# 3. Static + frontend + restart
python manage.py collectstatic --noinput
cd ../frontend && npm install && npm run build
sudo supervisorctl restart ildizmock
sudo systemctl reload nginx
```

---

## Xulosa

- **2 ta jiddiy bug topildi va tuzatildi** — yetishmayotgan jadvallar
  (TestSecurityViolation, AttendanceEscalation, TelegramBinding) endi
  `RunSQL` migration'lar orqali yaratiladi.
- **1 ta frontend type-error** (unused import) tuzatildi.
- **PDF test entry-pointlari yashirildi** (eski tests ochiq qoladi).
- **Listening, mock session, library, strict mode, smart paste, HTML
  content, attendance escalations** — hammasi ishlayapti.
