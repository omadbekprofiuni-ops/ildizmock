# ETAP 16: B2C Test Catalog (ildiz-testing.uz)

## Kontekst

ETAP 14-15 da B2C foundation va Google OAuth qurildi. Endi **test katalogi** qo'shilmoqda — B2C foydalanuvchilar **superadmin (Jasmina) tomonidan B2C uchun chiqarilgan testlarni** ko'ra olishlari kerak.

**Bu ETAP-ning vazifasi:**
- `Test` modeliga `available_for_b2c` flag va B2C metadata qo'shish
- `/b2c/catalog/` — section tabs (Listening / Reading / Writing / Full Mock), filterlar, qidiruv bilan katalog sahifa
- `/b2c/catalog/<test_id>/` — test detail/preview sahifa
- **Super-admin'da B2C catalog curation paneli** — Jasmina testlarini katalogga publish/unpublish qila oladi
- Sidebar'dagi "Katalog [SOON]" → real aktiv link
- Dashboard'dagi section overview kartochkalar real test sonlarini ko'rsatishi

**Bu ETAP-da YO'Q:** Kredit tizimi (ETAP 17), to'lov (ETAP 18), test boshlash flow (ETAP 17 bilan), natija/history (ETAP 17+). Hozircha "Boshlash" tugmasi modal ochib **"Kredit tizimi tez orada ishga tushadi"** xabarini ko'rsatadi.

**Muhim qoida:** B2C foydalanuvchi faqat `available_for_b2c=True` bo'lgan testlarni ko'radi. B2B o'qituvchilar yaratgan testlar (defaultda `available_for_b2c=False`) B2C katalogida ko'rinmaydi.

## Loyihaning hozirgi holati (ETAP 14-15 dan keyin)

- Django 5.x + PostgreSQL + Tailwind + Alpine.js + Chart.js
- ETAP 14-15 yakunlangan: `apps.b2c` mavjud (B2CProfile, B2CActivityEvent, Google OAuth, rich dashboard)
- B2C URL'lar: `/b2c/signup/`, `/b2c/login/`, `/b2c/dashboard/`, `/b2c/profile/`
- `UserTypeRouteMiddleware` ulangan
- Mavjud Test modeli — loyihaning haqiqiy strukturasini tekshiring (taxminan `apps/tests/models.py`)
- Mavjud super-admin paneli: `/super-admin/`

## ETAP yakunidagi natija

1. `Test` modelida `available_for_b2c` BooleanField va B2C metadata mavjud
2. `/b2c/catalog/` ishlaydi — section tabs, qidiruv, difficulty/duration filter, paginatsiya
3. `/b2c/catalog/<id>/` ishlaydi — test preview va "Boshlash" tugmasi (modal bilan)
4. Super-admin'da `/super-admin/b2c-catalog/` — testlarni B2C katalogga publish/unpublish qilish
5. Sidebar'dagi "Katalog [SOON]" → real link
6. Dashboard section kartochkalar real test sonlarini ko'rsatadi
7. Git push muvaffaqiyatli bajarilgan

---

## 1-bosqich: `Test` modelini kengaytirish

**Avval mavjud Test modelini ko'rib chiqing** (`apps/tests/models.py` yoki haqiqiy joy). Quyidagi field'lar mavjudligini tekshiring:

- `section_type` (Listening / Reading / Writing / Full Mock yoki shunga o'xshash)
- `difficulty` (Easy / Medium / Hard yoki Beginner / Intermediate / Advanced)
- `duration_minutes` (yoki shunga o'xshash)
- `num_questions` yoki related Question model orqali count

Agar bu field'lar mavjud bo'lmasa, B2C uchun kerakli minimumni qo'shing.

**B2C uchun yangi field'lar** — Test modeliga qo'shing:

```python
class Test(models.Model):
    # ... mavjud field'lar ...
    
    available_for_b2c = models.BooleanField(
        default=False,
        db_index=True,
        help_text="B2C katalogida ko'rinishi uchun belgilang. Faqat sifatli, tekshirilgan testlar uchun.",
    )
    b2c_published_at = models.DateTimeField(
        null=True, blank=True,
        help_text="B2C katalogga birinchi marta chiqarilgan vaqt.",
    )
    b2c_display_name = models.CharField(
        max_length=200, blank=True,
        help_text="B2C foydalanuvchilar uchun ko'rsatiladigan nom. Bo'sh bo'lsa, asosiy nomi ishlatiladi.",
    )
    b2c_description = models.TextField(
        blank=True,
        help_text="B2C foydalanuvchilar uchun qisqacha tavsif (test haqida, kim uchun mosligi).",
    )
    
    @property
    def b2c_name(self):
        return self.b2c_display_name or self.name  # asosiy field nomini moslang
```

Migration:
```bash
python manage.py makemigrations tests
python manage.py migrate
```

**Cursor Agent eslatma:** Agar `Test` modeli `name` o'rniga `title` yoki boshqa field nomini ishlatsa, `b2c_name` property'sini moslang. Section type, difficulty va boshqalarni mavjud field'larga moslab ishlating.

---

## 2-bosqich: Catalog services

### `apps/b2c/services/catalog.py`

```python
from django.db.models import Q, Count
from apps.tests.models import Test  # haqiqiy import yo'lini ishlating


SECTION_CHOICES = [
    ("all", "Barchasi"),
    ("listening", "Listening"),
    ("reading", "Reading"),
    ("writing", "Writing"),
    ("full", "Full Mock"),
]

DIFFICULTY_CHOICES = [
    ("all", "Barcha darajalar"),
    ("easy", "Oson"),
    ("medium", "O'rta"),
    ("hard", "Qiyin"),
]


def get_published_tests():
    """Faqat B2C uchun chiqarilgan testlar."""
    return Test.objects.filter(available_for_b2c=True)


def filter_catalog(section=None, difficulty=None, query=None):
    """
    Catalog uchun filter qilingan queryset.
    Mavjud Test modeli field'lariga moslang.
    """
    qs = get_published_tests()
    
    if section and section != "all":
        # Test modelidagi section_type field nomini ishlating
        qs = qs.filter(section_type=section)
    
    if difficulty and difficulty != "all":
        qs = qs.filter(difficulty=difficulty)
    
    if query:
        qs = qs.filter(
            Q(name__icontains=query) |
            Q(b2c_display_name__icontains=query) |
            Q(b2c_description__icontains=query)
        )
    
    return qs.order_by("-b2c_published_at", "-id")


def get_section_counts():
    """Dashboard section kartochkalar uchun sonlar."""
    qs = get_published_tests()
    counts = {row["section_type"]: row["c"] for row in qs.values("section_type").annotate(c=Count("id"))}
    return {
        "listening": counts.get("listening", 0),
        "reading": counts.get("reading", 0),
        "writing": counts.get("writing", 0),
        "full": counts.get("full", 0),
        "total": qs.count(),
    }
```

**Eslatma:** Cursor Agent loyihadagi haqiqiy `section_type` va `difficulty` field nomlari va choice qiymatlarini tekshirib mos keladigan qilib o'zgartirsin.

---

## 3-bosqich: Catalog views

### `apps/b2c/views.py` ga qo'shing

```python
from django.core.paginator import Paginator
from django.shortcuts import get_object_or_404
from django.views.generic import ListView, DetailView
from apps.tests.models import Test  # haqiqiy import

from .services import catalog as catalog_service


class B2CCatalogView(B2CUserRequiredMixin, TemplateView):
    template_name = "b2c/catalog.html"
    paginate_by = 12
    
    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        section = self.request.GET.get("section", "all")
        difficulty = self.request.GET.get("difficulty", "all")
        query = self.request.GET.get("q", "").strip()
        
        qs = catalog_service.filter_catalog(section=section, difficulty=difficulty, query=query)
        paginator = Paginator(qs, self.paginate_by)
        page_number = self.request.GET.get("page", 1)
        page = paginator.get_page(page_number)
        
        ctx.update({
            "tests": page.object_list,
            "page": page,
            "paginator": paginator,
            "active_section": section,
            "active_difficulty": difficulty,
            "query": query,
            "section_choices": catalog_service.SECTION_CHOICES,
            "difficulty_choices": catalog_service.DIFFICULTY_CHOICES,
            "section_counts": catalog_service.get_section_counts(),
        })
        return ctx


class B2CCatalogDetailView(B2CUserRequiredMixin, DetailView):
    template_name = "b2c/catalog_detail.html"
    context_object_name = "test"
    
    def get_queryset(self):
        # Faqat published testlarga kirish
        return catalog_service.get_published_tests()
    
    def get_object(self, queryset=None):
        return get_object_or_404(
            self.get_queryset(),
            pk=self.kwargs["pk"],
        )
```

### `apps/b2c/urls.py` ga qo'shing

```python
urlpatterns = [
    # ... mavjud yo'llar ...
    path("catalog/", views.B2CCatalogView.as_view(), name="catalog"),
    path("catalog/<int:pk>/", views.B2CCatalogDetailView.as_view(), name="catalog_detail"),
]
```

---

## 4-bosqich: Dashboard view'ni yangilash (section counts)

`apps/b2c/views.py` da `B2CDashboardView.get_context_data` ichidagi `sections` ni yangilang — endi real ma'lumotlar:

```python
from .services import catalog as catalog_service

class B2CDashboardView(B2CUserRequiredMixin, TemplateView):
    template_name = "b2c/dashboard.html"
    
    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        user = self.request.user
        ctx["profile"] = user.b2c_profile
        ctx["kpi"] = activity_service.get_kpi_stats(user)
        ctx["streak"] = activity_service.get_streak_stats(user)
        ctx["weekly"] = activity_service.get_weekly_progress(user)
        ctx["heatmap"] = activity_service.get_heatmap_data(user, weeks=12)
        ctx["getting_started"] = activity_service.get_getting_started(user)
        
        counts = catalog_service.get_section_counts()
        ctx["sections"] = [
            {"key": "listening", "name": "Listening", "count": counts["listening"], "accent": "blue", "ready": counts["listening"] > 0},
            {"key": "reading", "name": "Reading", "count": counts["reading"], "accent": "rose", "ready": counts["reading"] > 0},
            {"key": "writing", "name": "Writing", "count": counts["writing"], "accent": "emerald", "ready": counts["writing"] > 0},
            {"key": "full", "name": "Full Mock", "count": counts["full"], "accent": "violet", "ready": counts["full"] > 0},
        ]
        return ctx
```

---

## 5-bosqich: Catalog list template

### `apps/b2c/templates/b2c/catalog.html`

```html
{% extends "b2c/base_b2c.html" %}
{% block title %}Test Katalogi — ILDIZ Mock{% endblock %}
{% block content %}
<div class="flex gap-6">
  {% include "b2c/_sidebar.html" with active="catalog" %}

  <div class="flex-1 space-y-5 min-w-0">

    {# Header #}
    <div class="bg-white border border-gray-200 rounded-2xl p-6">
      <h1 class="text-2xl font-bold mb-1">Test Katalogi</h1>
      <p class="text-sm text-gray-500">
        Jami {{ section_counts.total }} ta test tayyor — bo'lim bo'yicha tanlang yoki qidiring
      </p>
    </div>

    {# Section tabs #}
    <div class="bg-white border border-gray-200 rounded-2xl p-2 overflow-x-auto">
      <nav class="flex gap-1 min-w-max">
        {% for key, label in section_choices %}
          <a href="?section={{ key }}{% if active_difficulty != 'all' %}&difficulty={{ active_difficulty }}{% endif %}{% if query %}&q={{ query }}{% endif %}"
             class="px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap
                    {% if active_section == key %}bg-rose-50 text-rose-600{% else %}text-gray-600 hover:bg-gray-50{% endif %}">
            {{ label }}
            {% if key != "all" %}
              <span class="text-xs ml-1 text-gray-400">({{ section_counts|get_item:key }})</span>
            {% endif %}
          </a>
        {% endfor %}
      </nav>
    </div>

    {# Filters + Search #}
    <div class="bg-white border border-gray-200 rounded-2xl p-4">
      <form method="get" class="flex flex-col md:flex-row gap-3">
        <input type="hidden" name="section" value="{{ active_section }}">
        <div class="flex-1 relative">
          <input type="text" name="q" value="{{ query }}" placeholder="Test nomi bo'yicha qidirish..."
                 class="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500">
          <svg class="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"/></svg>
        </div>
        <select name="difficulty" class="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500">
          {% for key, label in difficulty_choices %}
            <option value="{{ key }}" {% if active_difficulty == key %}selected{% endif %}>{{ label }}</option>
          {% endfor %}
        </select>
        <button type="submit" class="bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium px-5 py-2 rounded-lg">
          Qidirish
        </button>
      </form>
    </div>

    {# Test cards grid #}
    {% if tests %}
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {% for test in tests %}
          <a href="{% url 'b2c:catalog_detail' pk=test.pk %}"
             class="group bg-white border border-gray-200 hover:border-rose-300 hover:shadow-sm rounded-2xl p-5 transition flex flex-col">
            <div class="flex items-start justify-between mb-3">
              {% if test.section_type == "listening" %}
                <span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">Listening</span>
              {% elif test.section_type == "reading" %}
                <span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700">Reading</span>
              {% elif test.section_type == "writing" %}
                <span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">Writing</span>
              {% else %}
                <span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-violet-50 text-violet-700">Full Mock</span>
              {% endif %}
              {% if test.difficulty == "easy" %}
                <span class="text-[10px] font-bold text-green-600">OSON</span>
              {% elif test.difficulty == "medium" %}
                <span class="text-[10px] font-bold text-amber-600">O'RTA</span>
              {% else %}
                <span class="text-[10px] font-bold text-red-600">QIYIN</span>
              {% endif %}
            </div>
            
            <h3 class="font-bold text-gray-900 mb-2 group-hover:text-rose-600 transition">
              {{ test.b2c_name }}
            </h3>
            
            {% if test.b2c_description %}
              <p class="text-xs text-gray-500 mb-3 line-clamp-2">{{ test.b2c_description }}</p>
            {% endif %}
            
            <div class="flex items-center gap-4 text-xs text-gray-500 mt-auto pt-3 border-t border-gray-100">
              <span class="flex items-center gap-1">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 8v4l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                {{ test.duration_minutes|default:"--" }} daqiqa
              </span>
              <span class="flex items-center gap-1">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                {{ test.num_questions|default:"--" }} savol
              </span>
            </div>
          </a>
        {% endfor %}
      </div>

      {# Pagination #}
      {% if page.has_other_pages %}
        <div class="flex items-center justify-center gap-2 pt-2">
          {% if page.has_previous %}
            <a href="?section={{ active_section }}&difficulty={{ active_difficulty }}{% if query %}&q={{ query }}{% endif %}&page={{ page.previous_page_number }}"
               class="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">← Oldingi</a>
          {% endif %}
          <span class="text-sm text-gray-500">{{ page.number }} / {{ paginator.num_pages }}</span>
          {% if page.has_next %}
            <a href="?section={{ active_section }}&difficulty={{ active_difficulty }}{% if query %}&q={{ query }}{% endif %}&page={{ page.next_page_number }}"
               class="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Keyingi →</a>
          {% endif %}
        </div>
      {% endif %}

    {% else %}
      {# Empty state #}
      <div class="bg-white border border-gray-200 rounded-2xl p-12 text-center">
        <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-50 flex items-center justify-center text-3xl">📚</div>
        <h3 class="font-bold text-gray-900 mb-1">Hech narsa topilmadi</h3>
        <p class="text-sm text-gray-500">
          {% if query or active_difficulty != "all" %}
            Filtrlarni o'zgartirib qaytadan urinib ko'ring.
          {% else %}
            Bu bo'limda hozircha testlar yo'q. Yangilari tez orada qo'shiladi.
          {% endif %}
        </p>
      </div>
    {% endif %}

  </div>
</div>
{% endblock %}
```

**Eslatma — `get_item` template filter:** Section tabs'da `section_counts|get_item:key` ishlatildi. Agar loyihada bunday filter mavjud bo'lmasa, `apps/b2c/templatetags/b2c_extras.py` yarating:

```python
from django import template

register = template.Library()

@register.filter
def get_item(d, key):
    if isinstance(d, dict):
        return d.get(key, 0)
    return ""
```

Va template tepasiga `{% load b2c_extras %}` qo'shing.

---

## 6-bosqich: Catalog detail template

### `apps/b2c/templates/b2c/catalog_detail.html`

```html
{% extends "b2c/base_b2c.html" %}
{% block title %}{{ test.b2c_name }} — ILDIZ Mock{% endblock %}
{% block content %}
<div class="flex gap-6">
  {% include "b2c/_sidebar.html" with active="catalog" %}

  <div class="flex-1 max-w-3xl min-w-0 space-y-5">

    <a href="{% url 'b2c:catalog' %}" class="text-sm text-gray-500 hover:text-rose-600 inline-flex items-center gap-1">
      ← Katalogga qaytish
    </a>

    {# Hero #}
    <div class="bg-white border border-gray-200 rounded-2xl p-6">
      <div class="flex items-start justify-between gap-4 mb-4">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-2">
            {% if test.section_type == "listening" %}
              <span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">Listening</span>
            {% elif test.section_type == "reading" %}
              <span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700">Reading</span>
            {% elif test.section_type == "writing" %}
              <span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">Writing</span>
            {% else %}
              <span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-violet-50 text-violet-700">Full Mock</span>
            {% endif %}
            
            {% if test.difficulty == "easy" %}
              <span class="text-xs font-medium text-green-600">Oson</span>
            {% elif test.difficulty == "medium" %}
              <span class="text-xs font-medium text-amber-600">O'rta</span>
            {% else %}
              <span class="text-xs font-medium text-red-600">Qiyin</span>
            {% endif %}
          </div>
          <h1 class="text-2xl font-bold">{{ test.b2c_name }}</h1>
        </div>
      </div>

      {# Meta info #}
      <div class="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
        <div class="border border-gray-200 rounded-xl p-3">
          <p class="text-xs text-gray-500">Davomiyligi</p>
          <p class="font-semibold">{{ test.duration_minutes|default:"--" }} daqiqa</p>
        </div>
        <div class="border border-gray-200 rounded-xl p-3">
          <p class="text-xs text-gray-500">Savollar</p>
          <p class="font-semibold">{{ test.num_questions|default:"--" }} ta</p>
        </div>
        <div class="border border-gray-200 rounded-xl p-3">
          <p class="text-xs text-gray-500">Bo'lim</p>
          <p class="font-semibold">{{ test.get_section_type_display }}</p>
        </div>
      </div>

      {# Description #}
      {% if test.b2c_description %}
        <div class="mb-5">
          <h3 class="text-sm font-semibold text-gray-700 mb-2">Test haqida</h3>
          <p class="text-sm text-gray-600 whitespace-pre-line">{{ test.b2c_description }}</p>
        </div>
      {% endif %}

      {# Start button (placeholder for ETAP 17) #}
      <div x-data="{ open: false }">
        <button type="button" @click="open = true"
                class="w-full bg-rose-600 hover:bg-rose-700 text-white font-semibold py-3 rounded-xl transition">
          Testni boshlash
        </button>
        
        <div x-show="open" x-cloak
             class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4"
             @click.self="open = false">
          <div class="bg-white rounded-2xl p-6 max-w-sm w-full">
            <div class="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center mb-3 text-2xl">⏳</div>
            <h3 class="text-lg font-bold mb-1">Kredit tizimi tez orada</h3>
            <p class="text-sm text-gray-600 mb-4">
              Testlarni boshlash uchun kreditlar kerak bo'ladi. Kredit tizimi va to'lov integratsiyasi yaqin orada ishga tushadi. Ro'yxatdan o'tganligingiz uchun rahmat — birinchilardan bo'lib xabardor bo'lasiz.
            </p>
            <button @click="open = false" class="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 rounded-xl">
              Tushunarli
            </button>
          </div>
        </div>
      </div>
      
      <p class="text-xs text-gray-400 text-center mt-3">
        Hozir bepul ro'yxatdan o'ting va kredit tizimi ochilganda birinchilardan bo'ling
      </p>
    </div>

  </div>
</div>

<style>[x-cloak] { display: none !important; }</style>
{% endblock %}
```

---

## 7-bosqich: Sidebar va Dashboard yangilash

### `apps/b2c/templates/b2c/_sidebar.html` — "Katalog" bo'limini aktivlashtirish

`Katalog [SOON]` bo'lagini quyidagi bilan almashtiring:

```html
<a href="{% url 'b2c:catalog' %}"
   class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium {% if active == 'catalog' %}bg-rose-50 text-rose-600{% else %}text-gray-700 hover:bg-gray-50{% endif %}">
  <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h7"/></svg>
  Katalog
</a>
```

### Dashboard section kartochkalar — bosiladigan link

`dashboard.html` ichidagi Section overview blokini yangilang — kartochkalar endi katalog filter'iga bog'lanadi:

```html
<div class="grid grid-cols-2 md:grid-cols-4 gap-3">
  {% for s in sections %}
    {% if s.accent == "blue" %}
      <a href="{% url 'b2c:catalog' %}?section={{ s.key }}" class="border-l-4 border-blue-500 bg-blue-50/40 hover:bg-blue-50 rounded-xl p-4 transition block">
    {% elif s.accent == "rose" %}
      <a href="{% url 'b2c:catalog' %}?section={{ s.key }}" class="border-l-4 border-rose-500 bg-rose-50/40 hover:bg-rose-50 rounded-xl p-4 transition block">
    {% elif s.accent == "emerald" %}
      <a href="{% url 'b2c:catalog' %}?section={{ s.key }}" class="border-l-4 border-emerald-500 bg-emerald-50/40 hover:bg-emerald-50 rounded-xl p-4 transition block">
    {% else %}
      <a href="{% url 'b2c:catalog' %}?section={{ s.key }}" class="border-l-4 border-violet-500 bg-violet-50/40 hover:bg-violet-50 rounded-xl p-4 transition block">
    {% endif %}
      <p class="text-sm font-semibold text-gray-800">{{ s.name }}</p>
      <p class="text-xs text-gray-500 mt-1">
        {% if s.ready %}{{ s.count }} ta test{% else %}Tez orada{% endif %}
      </p>
    </a>
  {% endfor %}
</div>
```

### Getting Started checklist — "Birinchi testni boshlang" link

`apps/b2c/services/activity.py` ichidagi `get_getting_started` funksiyasida `first_test` qadami uchun `href`'ni `/b2c/catalog/` ga yo'naltiring:

```python
items = [
    {"key": "profile", "label": "Profilni to'ldiring (telefon va maqsad)", "done": has_phone and has_target, "href": "/b2c/profile/"},
    {"key": "first_test", "label": "Birinchi testni boshlang", "done": has_first_event, "href": "/b2c/catalog/"},
    {"key": "credits", "label": "Kredit balansini tekshiring", "done": profile.has_completed_onboarding, "href": "#"},
    {"key": "results", "label": "Natijalaringizni ko'ring", "done": has_first_event, "href": "#"},
]
```

---

## 8-bosqich: Super-admin B2C catalog curation paneli

Bu Jasmina (superadmin) o'z testlarini B2C katalogga publish/unpublish qiladigan panel.

### `apps/super_admin/views.py` (yoki haqiqiy super-admin app) ga qo'shing

```python
from django.contrib import messages
from django.shortcuts import redirect
from django.utils import timezone
from django.views.generic import ListView, View
from apps.tests.models import Test


class SuperadminRequiredMixin:
    """Loyihadagi mavjud superadmin tekshiruv mixin'iga moslang."""
    def dispatch(self, request, *args, **kwargs):
        if not request.user.is_authenticated or request.user.user_type != "superadmin":
            return redirect("/")
        return super().dispatch(request, *args, **kwargs)


class B2CCatalogManageView(SuperadminRequiredMixin, ListView):
    template_name = "super_admin/b2c_catalog_manage.html"
    paginate_by = 30
    context_object_name = "tests"
    
    def get_queryset(self):
        qs = Test.objects.all().order_by("-id")
        
        # Filter
        status = self.request.GET.get("status", "all")
        if status == "published":
            qs = qs.filter(available_for_b2c=True)
        elif status == "unpublished":
            qs = qs.filter(available_for_b2c=False)
        
        section = self.request.GET.get("section", "all")
        if section != "all":
            qs = qs.filter(section_type=section)
        
        query = self.request.GET.get("q", "").strip()
        if query:
            qs = qs.filter(name__icontains=query)
        
        return qs
    
    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["active_status"] = self.request.GET.get("status", "all")
        ctx["active_section"] = self.request.GET.get("section", "all")
        ctx["query"] = self.request.GET.get("q", "")
        ctx["published_count"] = Test.objects.filter(available_for_b2c=True).count()
        ctx["total_count"] = Test.objects.count()
        return ctx


class B2CCatalogToggleView(SuperadminRequiredMixin, View):
    """Bitta testni publish/unpublish qilish."""
    
    def post(self, request, pk):
        test = Test.objects.get(pk=pk)
        test.available_for_b2c = not test.available_for_b2c
        if test.available_for_b2c and not test.b2c_published_at:
            test.b2c_published_at = timezone.now()
        test.save(update_fields=["available_for_b2c", "b2c_published_at"])
        
        status = "katalogga chiqarildi" if test.available_for_b2c else "katalogdan olib tashlandi"
        messages.success(request, f"\"{test.name}\" {status}.")
        return redirect(request.META.get("HTTP_REFERER", "/super-admin/b2c-catalog/"))


class B2CCatalogEditView(SuperadminRequiredMixin, View):
    """B2C metadata tahrirlash (display name, description)."""
    
    def post(self, request, pk):
        test = Test.objects.get(pk=pk)
        test.b2c_display_name = request.POST.get("b2c_display_name", "").strip()
        test.b2c_description = request.POST.get("b2c_description", "").strip()
        test.save(update_fields=["b2c_display_name", "b2c_description"])
        messages.success(request, "B2C ma'lumotlari saqlandi.")
        return redirect(request.META.get("HTTP_REFERER", "/super-admin/b2c-catalog/"))
```

### `apps/super_admin/urls.py` ga qo'shing

```python
urlpatterns = [
    # ... mavjud yo'llar ...
    path("b2c-catalog/", views.B2CCatalogManageView.as_view(), name="b2c_catalog_manage"),
    path("b2c-catalog/<int:pk>/toggle/", views.B2CCatalogToggleView.as_view(), name="b2c_catalog_toggle"),
    path("b2c-catalog/<int:pk>/edit/", views.B2CCatalogEditView.as_view(), name="b2c_catalog_edit"),
]
```

### Template: `templates/super_admin/b2c_catalog_manage.html`

Loyihaning mavjud super-admin base template'iga extendni moslang.

```html
{% extends "super_admin/base.html" %}  {# loyihadagi haqiqiy base #}
{% block title %}B2C Catalog — Superadmin{% endblock %}
{% block content %}
<div class="space-y-5">

  <div class="bg-white border border-gray-200 rounded-2xl p-6">
    <div class="flex items-start justify-between mb-2">
      <div>
        <h1 class="text-2xl font-bold">B2C Catalog boshqaruvi</h1>
        <p class="text-sm text-gray-500 mt-1">
          Individual foydalanuvchilarga ochiq testlarni nazorat qiling
        </p>
      </div>
      <div class="text-right">
        <p class="text-3xl font-bold text-rose-600">{{ published_count }}</p>
        <p class="text-xs text-gray-500">{{ total_count }} testdan publish qilingan</p>
      </div>
    </div>
  </div>

  {# Filters #}
  <form method="get" class="bg-white border border-gray-200 rounded-2xl p-4 flex flex-col md:flex-row gap-3">
    <div class="flex-1">
      <input type="text" name="q" value="{{ query }}" placeholder="Test nomi bo'yicha qidirish..."
             class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
    </div>
    <select name="status" class="border border-gray-300 rounded-lg px-3 py-2 text-sm">
      <option value="all" {% if active_status == "all" %}selected{% endif %}>Hammasi</option>
      <option value="published" {% if active_status == "published" %}selected{% endif %}>Katalogda</option>
      <option value="unpublished" {% if active_status == "unpublished" %}selected{% endif %}>Katalogda emas</option>
    </select>
    <select name="section" class="border border-gray-300 rounded-lg px-3 py-2 text-sm">
      <option value="all" {% if active_section == "all" %}selected{% endif %}>Barcha bo'limlar</option>
      <option value="listening" {% if active_section == "listening" %}selected{% endif %}>Listening</option>
      <option value="reading" {% if active_section == "reading" %}selected{% endif %}>Reading</option>
      <option value="writing" {% if active_section == "writing" %}selected{% endif %}>Writing</option>
      <option value="full" {% if active_section == "full" %}selected{% endif %}>Full Mock</option>
    </select>
    <button type="submit" class="bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium px-5 py-2 rounded-lg">Filter</button>
  </form>

  {# Test list #}
  <div class="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100">
    {% for test in tests %}
      <div class="p-4 hover:bg-gray-50 transition" x-data="{ editing: false }">
        <div class="flex items-start gap-4">
          {# Toggle #}
          <form method="post" action="{% url 'super_admin:b2c_catalog_toggle' pk=test.pk %}" class="pt-1">
            {% csrf_token %}
            <button type="submit" class="block">
              {% if test.available_for_b2c %}
                <span class="w-11 h-6 bg-rose-500 rounded-full relative inline-flex items-center">
                  <span class="w-5 h-5 bg-white rounded-full ml-5 shadow"></span>
                </span>
              {% else %}
                <span class="w-11 h-6 bg-gray-200 rounded-full relative inline-flex items-center">
                  <span class="w-5 h-5 bg-white rounded-full ml-0.5 shadow"></span>
                </span>
              {% endif %}
            </button>
          </form>
          
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <h3 class="font-semibold text-gray-900">{{ test.name }}</h3>
              {% if test.available_for_b2c %}
                <span class="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">B2C</span>
              {% endif %}
            </div>
            <p class="text-xs text-gray-500">
              {{ test.get_section_type_display|default:test.section_type }} ·
              {{ test.duration_minutes|default:"--" }} daqiqa ·
              {% if test.b2c_published_at %}{{ test.b2c_published_at|date:"d M Y" }} chiqarilgan{% else %}Hali chiqarilmagan{% endif %}
            </p>
            
            {# Edit B2C metadata #}
            <button @click="editing = !editing" type="button" class="text-xs text-rose-600 mt-2 hover:underline">
              B2C ma'lumotlarini tahrirlash
            </button>
            <div x-show="editing" x-cloak class="mt-3 space-y-2">
              <form method="post" action="{% url 'super_admin:b2c_catalog_edit' pk=test.pk %}" class="space-y-2">
                {% csrf_token %}
                <input type="text" name="b2c_display_name" value="{{ test.b2c_display_name }}"
                       placeholder="B2C uchun ko'rsatiladigan nom (ixtiyoriy)"
                       class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
                <textarea name="b2c_description" rows="3" placeholder="B2C foydalanuvchilar uchun tavsif (ixtiyoriy)"
                          class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm">{{ test.b2c_description }}</textarea>
                <button type="submit" class="bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg">Saqlash</button>
                <button type="button" @click="editing = false" class="text-xs text-gray-500 ml-2">Bekor qilish</button>
              </form>
            </div>
          </div>
        </div>
      </div>
    {% empty %}
      <div class="p-12 text-center text-gray-500">Hech narsa topilmadi.</div>
    {% endfor %}
  </div>

  {# Pagination #}
  {% if is_paginated %}
    <div class="flex items-center justify-center gap-2">
      {% if page_obj.has_previous %}
        <a href="?page={{ page_obj.previous_page_number }}&status={{ active_status }}&section={{ active_section }}{% if query %}&q={{ query }}{% endif %}"
           class="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">← Oldingi</a>
      {% endif %}
      <span class="text-sm text-gray-500">{{ page_obj.number }} / {{ paginator.num_pages }}</span>
      {% if page_obj.has_next %}
        <a href="?page={{ page_obj.next_page_number }}&status={{ active_status }}&section={{ active_section }}{% if query %}&q={{ query }}{% endif %}"
           class="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Keyingi →</a>
      {% endif %}
    </div>
  {% endif %}

</div>

<style>[x-cloak] { display: none !important; }</style>
{% endblock %}
```

**Super-admin sidebar/menu'siga "B2C Catalog" linki qo'shing** — loyihadagi haqiqiy menu strukturasiga moslab.

---

## 9-bosqich: Tailwind safelist (kerak bo'lsa)

`tailwind.config.js` safelist'iga catalog'da ishlatilgan ranglarni qo'shing (agar JIT purge'da topilmasa):

```js
safelist: [
  // ETAP 14 dan
  "border-blue-500", "bg-blue-50/40", "hover:bg-blue-50",
  "border-rose-500", "bg-rose-50/40", "hover:bg-rose-50",
  "border-emerald-500", "bg-emerald-50/40", "hover:bg-emerald-50",
  "border-violet-500", "bg-violet-50/40", "hover:bg-violet-50",
  "bg-rose-200", "bg-rose-400", "bg-rose-600", "bg-rose-800",
  // ETAP 16
  "bg-blue-50", "text-blue-700",
  "bg-rose-50", "text-rose-700",
  "bg-emerald-50", "text-emerald-700",
  "bg-violet-50", "text-violet-700",
],
```

---

## 10-bosqich: Sample data (sinash uchun)

```bash
python manage.py shell
```

```python
from django.utils import timezone
from apps.tests.models import Test  # haqiqiy import

# Loyihadagi mavjud testlardan bir nechtasini B2C ga chiqaramiz
for t in Test.objects.all()[:5]:
    t.available_for_b2c = True
    t.b2c_published_at = timezone.now()
    t.b2c_display_name = f"{t.name} — Individual"
    t.b2c_description = "Sinov uchun katalogga chiqarilgan test. Real foydalanish uchun ETAP 17 da kreditlar kerak bo'ladi."
    t.save()

print(f"B2C katalogda: {Test.objects.filter(available_for_b2c=True).count()} ta test")
```

---

## 11-bosqich: Manual test checklist

- [ ] B2C user `/b2c/dashboard/` da Section overview kartochkalarda real test sonlari ko'rinadi (0 emas, agar sample data qo'shilgan bo'lsa)
- [ ] Kartochkani bossangiz `/b2c/catalog/?section=<key>` ga o'tadi
- [ ] Sidebar'dagi "Katalog" linki ishlaydi va active state ko'rsatadi
- [ ] `/b2c/catalog/` — section tabs (All / Listening / Reading / Writing / Full Mock) ishlaydi
- [ ] Difficulty filter va qidiruv to'g'ri filterlaydi
- [ ] Test card bossa `/b2c/catalog/<id>/` ga o'tadi
- [ ] Detail sahifada: meta info (duration, questions, section), description, "Boshlash" tugmasi
- [ ] "Boshlash" → modal ochiladi: "Kredit tizimi tez orada"
- [ ] Empty state — agar filtrlash natijasi bo'sh bo'lsa to'g'ri xabar chiqadi
- [ ] Paginatsiya 12 dan ortiq test bo'lsa ishlaydi
- [ ] Getting Started checklist'dagi "Birinchi testni boshlang" linki katalogga olib boradi
- [ ] **Superadmin** `/super-admin/b2c-catalog/` ga kirib:
  - Toggle bilan testni publish/unpublish qila oladi
  - "B2C ma'lumotlarini tahrirlash" orqali display name va description saqlay oladi
  - Filter status (all/published/unpublished) ishlaydi
  - Section bo'yicha filter ishlaydi
  - Qidiruv ishlaydi
- [ ] **`available_for_b2c=False`** bo'lgan test `/b2c/catalog/<id>/` orqali ochilsa 404 qaytaradi
- [ ] B2B teacher'lar yaratgan testlar (defaultda `available_for_b2c=False`) B2C katalogida ko'rinmaydi
- [ ] B2B user `/b2c/catalog/` ga kirsa — middleware orqali bloklanadi (mavjud)

---

## 12-bosqich: Git commit va push (MAJBURIY)

```bash
git add .
git commit -m "ETAP 16: B2C Test Catalog — available_for_b2c flag, catalog browse/detail, super-admin curation panel"
git push origin <branch-nomi>
```

---

## Yakuniy checklist

- [ ] `Test.available_for_b2c`, `b2c_published_at`, `b2c_display_name`, `b2c_description` field'lari
- [ ] `apps/b2c/services/catalog.py` (filter_catalog, get_section_counts, get_published_tests)
- [ ] `B2CCatalogView`, `B2CCatalogDetailView` view'lari
- [ ] `/b2c/catalog/` va `/b2c/catalog/<id>/` URL'lari
- [ ] `catalog.html` va `catalog_detail.html` template'lari
- [ ] Section tabs + difficulty filter + qidiruv + paginatsiya
- [ ] "Boshlash" tugmasi modal bilan (Alpine.js)
- [ ] Sidebar'dagi "Katalog" aktivlashtirilgan
- [ ] Dashboard section kartochkalari real son va link bilan
- [ ] Getting Started checklist'dagi first_test href katalogga
- [ ] Super-admin `/super-admin/b2c-catalog/` paneli
- [ ] Toggle, metadata edit, filter, qidiruv super-admin'da
- [ ] Tailwind safelist (kerak bo'lsa)
- [ ] Sample data shell snippet ishlatildi
- [ ] Migration fayllar git'da
- [ ] `git push origin <branch>` muvaffaqiyatli

---

## ETAP 17 oldidan eslatma

Keyingi ETAP'da **kredit tizimi** qo'shiladi:
- `CreditBalance`, `CreditTransaction`, `CreditPackage` modellari
- Sidebar'dagi "Kreditlar [SOON]" aktivlashtiriladi
- Signup bonusi (yangi B2C user'ga avtomatik bepul kreditlar)
- Test detail sahifadagi "Boshlash" modal'i kredit pricing ko'rsatadi va kredit yetarli bo'lsa real test boshlash flow'iga ulanadi
- Super-admin'da test pricing (full test cost, section cost) sozlash
- Test History sahifa (yechilgan testlar, natijalar)

Hozirgi modal va "Tez orada" tugmalar shu uchun saqlangan — ETAP 17-da o'rni keladi.
