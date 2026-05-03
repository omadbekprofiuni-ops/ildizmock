# CURSOR AGENT - COMPLETE ENGLISH MIGRATION

**CRITICAL TASK:** Convert entire platform from Uzbek/Uzbek Cyrillic to 100% English.

Remove ALL Uzbek text from:
- Frontend UI (buttons, labels, messages)
- Backend (verbose_name, help_text)
- Translation files
- Database content
- Comments and documentation

---

## 🎯 OBJECTIVE

**Complete English-only platform with ZERO Uzbek text anywhere.**

---

## 📋 EXECUTION PLAN

### PHASE 1: Frontend - Replace All Uzbek Text

**Scan all frontend files and replace Uzbek text with English:**

```bash
# Files to check:
frontend/src/**/*.tsx
frontend/src/**/*.ts
frontend/src/**/*.jsx
frontend/src/**/*.js
```

**Common Uzbek → English replacements:**

```typescript
// Buttons & Actions
"Nusxa olish" → "Copy"
"Yaratish" → "Create"
"Saqlash" → "Save"
"O'chirish" → "Delete"
"Tahrirlash" → "Edit"
"Bekor qilish" → "Cancel"
"Qo'shish" → "Add"
"Yuborish" → "Submit"
"Yuklash" → "Upload"
"Yuklab olish" → "Download"
"Chop etish" → "Print"
"Qidirish" → "Search"
"Filtrlash" → "Filter"
"Tartiblash" → "Sort"
"Ko'rish" → "View"
"Yopish" → "Close"
"Ochish" → "Open"

// Navigation & Sections
"Bosh sahifa" → "Home"
"Dashboard" → "Dashboard" (same)
"O'quvchilar" → "Students"
"Guruhlar" → "Groups"
"Ustozlar" → "Teachers"
"Testlar" → "Tests"
"Mock sessiyalar" → "Mock Sessions"
"Davomat" → "Attendance"
"Analytics" → "Analytics" (same)
"Sozlamalar" → "Settings"
"Chiqish" → "Logout"
"Profil" → "Profile"

// Form Labels
"Ism" → "Name"
"Familiya" → "Last Name"
"Email" → "Email"
"Telefon" → "Phone"
"Parol" → "Password"
"Tasdiqlash" → "Confirm"
"Sana" → "Date"
"Vaqt" → "Time"
"Holat" → "Status"
"Turi" → "Type"
"Modul" → "Module"
"Sarlavha" → "Title"
"Tavsif" → "Description"
"Davomiyligi" → "Duration"

// Status Messages
"Muvaffaqiyatli saqlandi" → "Saved successfully"
"Xatolik yuz berdi" → "An error occurred"
"Ma'lumot topilmadi" → "No data found"
"Yuklanmoqda..." → "Loading..."
"Kutib turing..." → "Please wait..."
"Tasdiqlaysizmi?" → "Are you sure?"

// Time & Dates
"daqiqa" → "minutes"
"soat" → "hours"
"kun" → "days"
"hafta" → "week"
"oy" → "month"
"yil" → "year"
"bugun" → "today"
"kecha" → "yesterday"
"ertaga" → "tomorrow"

// Mock Session Specific
"Boshqaruv" → "Control"
"Boshqa" → "Start"
"Tugatish" → "Finish"
"Davom etish" → "Continue"
"Sessiyani bekor qilish" → "Cancel Session"
"Talabalar uchun link" → "Student Link"
"Access code" → "Access Code"
"Yuborgan talabalar" → "Submitted Students"
"Jarayon" → "Progress"
"WRITING TAYMERI" → "WRITING TIMER"
"FINISH" → "FINISH" (same)

// Test Creation
"Yangi test" → "New Test"
"Test nomi" → "Test Name"
"Modul" → "Module"
"Qiyinlik darajasi" → "Difficulty"
"Published" → "Published" (same)
"Draft" → "Draft" (same)
"Passage" → "Passage" (same)
"Savol" → "Question"
"Javob" → "Answer"
"To'g'ri javob" → "Correct Answer"

// File Upload
"Fayl yuklash" → "Upload File"
"Rasm yuklash" → "Upload Image"
"Audio yuklash" → "Upload Audio"
"PDF yuklash" → "Upload PDF"
"Fayl tanlash" → "Choose File"

// Validation & Errors
"Majburiy maydon" → "Required field"
"Noto'g'ri format" → "Invalid format"
"Juda qisqa" → "Too short"
"Juda uzun" → "Too long"
"Noto'g'ri email" → "Invalid email"
"Parol mos kelmadi" → "Passwords don't match"
"Minimal" → "Minimum"
"Maksimal" → "Maximum"

// Tables & Lists
"Nomi" → "Name"
"Soni" → "Count"
"Jami" → "Total"
"Aktiv" → "Active"
"Nofaol" → "Inactive"
"Yangi" → "New"
"Eski" → "Old"
"Hammasi" → "All"
"Tanlangan" → "Selected"
"Bo'sh" → "Empty"

// Payment & Billing
"To'lov" → "Payment"
"Narx" → "Price"
"Summa" → "Amount"
"To'landi" → "Paid"
"To'lanmagan" → "Unpaid"
"Hisob" → "Invoice"
"Chegirma" → "Discount"
```

**Example Fix:**

```typescript
// BEFORE (Uzbek):
<button className="bg-red-600 text-white px-4 py-2 rounded">
  Bekor qilish
</button>

// AFTER (English):
<button className="bg-red-600 text-white px-4 py-2 rounded">
  Cancel
</button>
```

---

### PHASE 2: Backend - English verbose_name & help_text

**Update all Django models:**

```bash
# Files to update:
backend/apps/*/models.py
```

**Example:**

```python
# BEFORE (Uzbek):
class MockSession(models.Model):
    name = models.CharField(
        max_length=200,
        verbose_name='Sessiya nomi'
    )
    
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='scheduled',
        verbose_name='Holat',
        help_text='Sessiya holati'
    )
    
    scheduled_time = models.DateTimeField(
        verbose_name='Rejalashtirilgan vaqt'
    )

# AFTER (English):
class MockSession(models.Model):
    name = models.CharField(
        max_length=200,
        verbose_name='Session Name'
    )
    
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='scheduled',
        verbose_name='Status',
        help_text='Session status'
    )
    
    scheduled_time = models.DateTimeField(
        verbose_name='Scheduled Time'
    )
```

**All models to update:**
- apps/users/models.py
- apps/organizations/models.py
- apps/tests/models.py
- apps/mock/models.py
- apps/students/models.py
- apps/groups/models.py
- apps/attendance/models.py
- apps/billing/models.py
- apps/certificates/models.py

---

### PHASE 3: Remove Uzbek Locale Files

```bash
# Delete Uzbek translation files:
rm -rf frontend/src/locales/uz/
rm -rf frontend/src/locales/oz/

# Keep only English:
frontend/src/locales/en/translation.json
```

**Update i18n config:**

```typescript
// frontend/src/i18n.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import only English
import en from './locales/en/translation.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en }  // Only English
    },
    lng: 'en',  // Default language
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
```

---

### PHASE 4: Remove Language Switcher

**Find and remove language switcher components:**

```typescript
// Search for:
grep -r "language" frontend/src/components/
grep -r "locale" frontend/src/components/
grep -r "i18n.changeLanguage" frontend/src/

// Remove components like:
<LanguageSwitcher />
<LocaleSelector />
```

---

### PHASE 5: Update Django Admin

**Set English as default in Django:**

```python
# backend/backend/settings.py

LANGUAGE_CODE = 'en-us'  # Change from 'uz' to 'en-us'

TIME_ZONE = 'UTC'  # or 'Asia/Tashkent' if needed

USE_I18N = True
USE_TZ = True

# Remove Uzbek from LANGUAGES if exists
LANGUAGES = [
    ('en', 'English'),
]
```

---

### PHASE 6: Database Content

**Update existing database records with Uzbek text:**

```bash
python manage.py shell
```

```python
# Update status choices display names
from apps.mock.models import MockSession

# If you have custom status display in database
# (Usually not needed as choices are in code)

# Update any user-facing content
from apps.tests.models import Test

tests_with_uzbek = Test.objects.filter(
    name__icontains='test'  # Find Uzbek names
)

# Manually update or provide translation mapping
```

---

### PHASE 7: Update All Components

**Specific components to check:**

```bash
# MockControlPage.tsx
"Talabalar uchun link:" → "Student Link:"
"Access code:" → "Access Code:"
"Boshqaruv" → "Control"
"Yuborgan talabalar:" → "Submitted Students:"
"WRITING TAYMERI" → "WRITING TIMER"
"FINISH" → "FINISH"
"Sessiyani bekor qilish" → "Cancel Session"

# CreateSessionDialog.tsx
"Yangi sessiya" → "New Session"
"Sessiya nomi" → "Session Name"
"Guruh" → "Group"
"Listening test" → "Listening Test"
"Reading test" → "Reading Test"
"Writing test" → "Writing Test"

# TestsList.tsx
"Testlar" → "Tests"
"Yangi test" → "New Test"
"Izlash..." → "Search..."

# StudentsList.tsx
"O'quvchilar" → "Students"
"Yangi o'quvchi" → "New Student"

# And ALL other components...
```

---

## 🔍 AUTOMATED SEARCH & REPLACE

**Create a mapping file:**

```typescript
// uzbek-to-english-map.json
{
  // Buttons
  "Yaratish": "Create",
  "Saqlash": "Save",
  "O'chirish": "Delete",
  "Bekor qilish": "Cancel",
  "Tahrirlash": "Edit",
  
  // Navigation
  "Bosh sahifa": "Home",
  "O'quvchilar": "Students",
  "Guruhlar": "Groups",
  "Ustozlar": "Teachers",
  "Testlar": "Tests",
  "Mock sessiyalar": "Mock Sessions",
  "Davomat": "Attendance",
  "Sozlamalar": "Settings",
  
  // Mock Session
  "Talabalar uchun link:": "Student Link:",
  "Access code:": "Access Code:",
  "Yuborgan talabalar:": "Submitted Students:",
  "WRITING TAYMERI": "WRITING TIMER",
  "Sessiyani bekor qilish": "Cancel Session",
  
  // Add ALL mappings...
}
```

**Run automated replacement:**

```bash
# Use find & replace script
node scripts/replace-uzbek-with-english.js
```

---

## ✅ VERIFICATION CHECKLIST

After migration, verify:

```bash
# 1. No Uzbek text in frontend
grep -r "qilish" frontend/src/
grep -r "uchun" frontend/src/
grep -r "dan" frontend/src/
grep -r "lar" frontend/src/
# Should return NOTHING

# 2. No Uzbek in backend
grep -r "verbose_name='.*[а-я]" backend/apps/
# Should return NOTHING

# 3. Only English locale exists
ls frontend/src/locales/
# Should show: en/

# 4. Default language is English
grep "LANGUAGE_CODE" backend/backend/settings.py
# Should show: LANGUAGE_CODE = 'en-us'
```

---

## 🎯 EXPECTED RESULT

**BEFORE:**
```
Interface: Mixed Uzbek/English ❌
Backend: Uzbek verbose_name ❌
Locales: uz, oz, en ❌
```

**AFTER:**
```
Interface: 100% English ✅
Backend: English verbose_name ✅
Locales: en only ✅
Language Switcher: Removed ✅
```

---

## 🚀 IMPLEMENTATION STEPS

**CURSOR AGENT - EXECUTE THIS:**

1. **Scan all frontend files**
   - Find all Uzbek text patterns
   - Replace with English equivalents
   - Use mapping file for consistency

2. **Update backend models**
   - Change all verbose_name to English
   - Update help_text to English
   - Update choices display names

3. **Clean up locales**
   - Remove uz/ and oz/ directories
   - Keep only en/
   - Update i18n config

4. **Remove language switcher**
   - Find and delete components
   - Remove from layouts

5. **Update settings**
   - LANGUAGE_CODE = 'en-us'
   - Remove Uzbek from LANGUAGES

6. **Test thoroughly**
   - Check every page
   - Verify no Uzbek text remains
   - Confirm functionality works

---

## 📊 FILES TO UPDATE (Estimated)

```
Frontend: ~150 files
Backend: ~30 files
Config: ~5 files
Total: ~185 files

Time: 2-4 hours (automated)
```

---

**START COMPLETE ENGLISH MIGRATION NOW.**

**Report progress and any Uzbek text that needs manual translation.**
