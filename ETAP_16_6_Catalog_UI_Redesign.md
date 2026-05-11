# ETAP 16.6: B2C Catalog UI Redesign + Source Field

## Kontekst

ETAP 16 da B2C catalog ishga tushdi, lekin hozirgi UI **siyrak** — sahifada 12 ta test, 2-3 ustun. B2C foydalanuvchiga "platforma to'la kontent" hissi bermaydi. Konkurent IELTStation kabi **zich 4-ustunli grid**ga o'tkazamiz, va testlarni manbalar bo'yicha filtrlash imkonini qo'shamiz (Cambridge 9, Cambridge 10, Real Exam 2024 va h.k.).

**Bu ETAP-ning vazifasi:**
1. `Test.source` va `Test.source_custom_name` field'lari + migration
2. B2C catalog sahifasini dense 4-ustunli grid bilan qayta tuzish
3. Section tabs (Reading / Listening / Writing / Full Mock) tepada bo'lishi, har birida flat grid
4. Source filter (Cambridge 9, 10, ... / Real Exam / ILDIZ Original)
5. Difficulty filter va qidiruv saqlanadi
6. Test cards — minimal + difficulty + duration (zich, ortiqcha matnsiz)
7. Per page 12 → **24** ga ko'tarish
8. Super-admin B2C Catalog manage'da source belgilash
9. Kichik admin/data utility — mavjud testlarga source ulash uchun

**Bu ETAP ETAP 17 dan mustaqil** — kreditlar bo'lmasa ham UI yangilanadi. Card'da ⚡ credit badge ETAP 17 tugagach paydo bo'ladi (yoki shu ETAP-da placeholder qo'yib ketsa bo'ladi).

## Loyihaning hozirgi holati

- ETAP 16: `/b2c/catalog/` mavjud, `pages/b2c/CatalogPage.tsx` (React), `B2CCatalogListView` (Django)
- Test modeli: `available_for_b2c`, `b2c_published_at`, `b2c_display_name`, `b2c_description`, `section_type`, `difficulty`, `duration_minutes`
- Catalog API: `/api/v1/b2c/catalog` (paginatsiya + filter + meta)
- Catalog services: `apps/b2c/services/catalog.py` (filter_catalog, get_section_counts)

## ETAP yakunidagi natija

1. `Test.source` (TextChoices) va `source_custom_name` (CharField) qo'shilgan
2. Migration ishlagan, mavjud testlar default `OTHER` ga o'tgan
3. Super-admin'da source belgilash mumkin
4. `/b2c/catalog/` qayta tuzilgan: section tabs (counts bilan), source dropdown, dense 4-ustunli grid
5. Cards minimal + difficulty + duration ko'rinadi
6. 24 ta test per page
7. API source filter qabul qiladi
8. Git push muvaffaqiyatli

---

## 1-bosqich: `Test.source` field qo'shish

`apps/tests/models.py` ichida (haqiqiy joy):

```python
class Test(models.Model):
    # ... mavjud field'lar (ETAP 16 dan: available_for_b2c, b2c_published_at, b2c_display_name, b2c_description) ...
    
    class Source(models.TextChoices):
        CAMBRIDGE_7 = "cambridge_7", "Cambridge 7"
        CAMBRIDGE_8 = "cambridge_8", "Cambridge 8"
        CAMBRIDGE_9 = "cambridge_9", "Cambridge 9"
        CAMBRIDGE_10 = "cambridge_10", "Cambridge 10"
        CAMBRIDGE_11 = "cambridge_11", "Cambridge 11"
        CAMBRIDGE_12 = "cambridge_12", "Cambridge 12"
        CAMBRIDGE_13 = "cambridge_13", "Cambridge 13"
        CAMBRIDGE_14 = "cambridge_14", "Cambridge 14"
        CAMBRIDGE_15 = "cambridge_15", "Cambridge 15"
        CAMBRIDGE_16 = "cambridge_16", "Cambridge 16"
        CAMBRIDGE_17 = "cambridge_17", "Cambridge 17"
        CAMBRIDGE_18 = "cambridge_18", "Cambridge 18"
        CAMBRIDGE_19 = "cambridge_19", "Cambridge 19"
        CAMBRIDGE_20 = "cambridge_20", "Cambridge 20"
        REAL_EXAM_2024 = "real_exam_2024", "Real Exam 2024"
        REAL_EXAM_2025 = "real_exam_2025", "Real Exam 2025"
        REAL_EXAM_2026 = "real_exam_2026", "Real Exam 2026"
        ILDIZ_ORIGINAL = "ildiz_original", "ILDIZ Original"
        OTHER = "other", "Boshqa"
    
    source = models.CharField(
        max_length=30,
        choices=Source.choices,
        default=Source.OTHER,
        db_index=True,
    )
    source_custom_name = models.CharField(
        max_length=100, blank=True,
        help_text="source=OTHER bo'lsa, erkin nom yozish mumkin (masalan, 'IELTS Original 2026')",
    )
    
    @property
    def source_display(self):
        if self.source == self.Source.OTHER and self.source_custom_name:
            return self.source_custom_name
        return self.get_source_display()
```

Migration:
```bash
python manage.py makemigrations tests
python manage.py migrate
```

**Cursor Agent:** Cambridge yillari kelajakda kengayishi mumkin (Cambridge 21, 22...). Yangi qiymat qo'shish uchun TextChoices'ni yangilash va migration kerak. Bu konsentlangan ro'yxat — Jasmina yangi kitob chiqsa modelga qo'shadi.

---

## 2-bosqich: Catalog service'ni yangilash

`apps/b2c/services/catalog.py`:

```python
from django.db.models import Q, Count
from apps.tests.models import Test


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
    return Test.objects.filter(available_for_b2c=True)


def filter_catalog(section=None, difficulty=None, source=None, query=None):
    qs = get_published_tests()
    
    if section and section != "all":
        qs = qs.filter(section_type=section)
    
    if difficulty and difficulty != "all":
        qs = qs.filter(difficulty=difficulty)
    
    if source and source != "all":
        qs = qs.filter(source=source)
    
    if query:
        qs = qs.filter(
            Q(name__icontains=query) |
            Q(b2c_display_name__icontains=query) |
            Q(b2c_description__icontains=query) |
            Q(source_custom_name__icontains=query)
        )
    
    return qs.order_by("source", "-b2c_published_at", "-id")


def get_section_counts():
    """Section tabs uchun sonlar."""
    qs = get_published_tests()
    counts = {row["section_type"]: row["c"] for row in qs.values("section_type").annotate(c=Count("id"))}
    return {
        "all": qs.count(),
        "listening": counts.get("listening", 0),
        "reading": counts.get("reading", 0),
        "writing": counts.get("writing", 0),
        "full": counts.get("full", 0),
    }


def get_available_sources():
    """Faqat testlari mavjud source'larni qaytaradi (bo'sh source'lar dropdown'da yo'q)."""
    used = (
        get_published_tests()
        .exclude(source="")
        .values_list("source", flat=True)
        .distinct()
    )
    used_set = set(used)
    
    sources = [{"key": "all", "label": "Barcha manbalar"}]
    for choice_key, choice_label in Test.Source.choices:
        if choice_key in used_set:
            sources.append({"key": choice_key, "label": choice_label})
    
    return sources
```

---

## 3-bosqich: Catalog API'ni yangilash

`B2CCatalogListView` (DRF) ichida `source` parametri va `available_sources` ni response'ga qo'shing:

```python
class B2CCatalogListView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        if not request.user.is_b2c:
            return Response(status=403)
        
        section = request.query_params.get("section", "all")
        difficulty = request.query_params.get("difficulty", "all")
        source = request.query_params.get("source", "all")
        query = request.query_params.get("q", "").strip()
        page = int(request.query_params.get("page", 1))
        per_page = 24  # 12 dan ko'tarildi
        
        qs = catalog_service.filter_catalog(
            section=section, difficulty=difficulty, source=source, query=query
        )
        paginator = Paginator(qs, per_page)
        page_obj = paginator.get_page(page)
        
        return Response({
            "tests": B2CCatalogListSerializer(page_obj.object_list, many=True).data,
            "meta": {
                "page": page_obj.number,
                "total_pages": paginator.num_pages,
                "total": paginator.count,
                "per_page": per_page,
            },
            "filters": {
                "section_counts": catalog_service.get_section_counts(),
                "sources": catalog_service.get_available_sources(),
                "section_choices": catalog_service.SECTION_CHOICES,
                "difficulty_choices": catalog_service.DIFFICULTY_CHOICES,
            },
        })
```

Serializer'ga `source` va `source_display` qo'shing:

```python
class B2CCatalogListSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="b2c_name")
    section = serializers.CharField(source="section_type")
    section_display = serializers.CharField(source="get_section_type_display")
    difficulty_display = serializers.CharField(source="get_difficulty_display")
    source_display = serializers.CharField(read_only=True)
    questions_count = serializers.IntegerField(read_only=True)
    # ETAP 17 da credits_cost qo'shiladi:
    credits_cost = serializers.IntegerField(source="b2c_credits_cost_effective", read_only=True, default=None)
    
    class Meta:
        model = Test
        fields = [
            "id", "name", "section", "section_display",
            "difficulty", "difficulty_display",
            "duration_minutes", "questions_count",
            "source", "source_display",
            "credits_cost",
        ]
```

**Eslatma:** `credits_cost` ETAP 17 dan keyin to'g'ri qaytadi. Hozir `None` yoki default berishi mumkin — UI bunga moslab placeholder ko'rsatadi.

---

## 4-bosqich: Catalog page redesign (`CatalogPage.tsx`)

To'liq qayta yozing — dense 4-ustunli grid bilan:

```tsx
// pages/b2c/CatalogPage.tsx
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { B2CLayout } from "@/components/B2CLayout";

interface Test {
  id: number;
  name: string;
  section: string;
  section_display: string;
  difficulty: string;
  difficulty_display: string;
  duration_minutes: number | null;
  questions_count: number | null;
  source: string;
  source_display: string;
  credits_cost: number | null;
}

interface CatalogResponse {
  tests: Test[];
  meta: { page: number; total_pages: number; total: number };
  filters: {
    section_counts: Record<string, number>;
    sources: { key: string; label: string }[];
    section_choices: [string, string][];
    difficulty_choices: [string, string][];
  };
}

const SECTION_ACCENT: Record<string, string> = {
  listening: "blue",
  reading: "rose",
  writing: "emerald",
  full: "violet",
};

const DIFFICULTY_COLOR: Record<string, string> = {
  easy: "text-green-600",
  medium: "text-amber-600",
  hard: "text-red-600",
};

export function CatalogPage() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<CatalogResponse | null>(null);
  const [loading, setLoading] = useState(false);
  
  const activeSection = params.get("section") || "all";
  const activeDifficulty = params.get("difficulty") || "all";
  const activeSource = params.get("source") || "all";
  const query = params.get("q") || "";
  const page = parseInt(params.get("page") || "1");
  
  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams({
      section: activeSection,
      difficulty: activeDifficulty,
      source: activeSource,
      q: query,
      page: String(page),
    }).toString();
    fetch(`/api/v1/b2c/catalog?${qs}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, [activeSection, activeDifficulty, activeSource, query, page]);
  
  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value === "all" || !value) next.delete(key);
    else next.set(key, value);
    if (key !== "page") next.delete("page");
    setParams(next);
  };
  
  if (!data) {
    return <B2CLayout active="catalog"><div className="py-20 text-center text-gray-500">Yuklanmoqda...</div></B2CLayout>;
  }
  
  const counts = data.filters.section_counts;
  
  return (
    <B2CLayout active="catalog">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-4">
        <h1 className="text-2xl font-bold mb-1">Test Katalogi</h1>
        <p className="text-sm text-gray-500">
          Jami {counts.all} ta test tayyor — bo'lim, manba va daraja bo'yicha tanlang
        </p>
      </div>
      
      {/* Section tabs */}
      <div className="bg-white border border-gray-200 rounded-2xl p-2 mb-4 overflow-x-auto">
        <nav className="flex gap-1 min-w-max">
          {data.filters.section_choices.map(([key, label]) => (
            <button
              key={key}
              onClick={() => updateParam("section", key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                activeSection === key
                  ? "bg-rose-50 text-rose-600"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {label}
              <span className="text-xs ml-1.5 text-gray-400">
                ({counts[key] ?? 0})
              </span>
            </button>
          ))}
        </nav>
      </div>
      
      {/* Filters row */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-4">
        <div className="flex flex-col md:flex-row gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              defaultValue={query}
              placeholder="Test nomi bo'yicha qidirish..."
              onKeyDown={(e) => {
                if (e.key === "Enter") updateParam("q", (e.target as HTMLInputElement).value);
              }}
              className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
            <svg className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
            </svg>
          </div>
          <select
            value={activeSource}
            onChange={(e) => updateParam("source", e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 min-w-[140px]"
          >
            {data.filters.sources.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
          <select
            value={activeDifficulty}
            onChange={(e) => updateParam("difficulty", e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 min-w-[140px]"
          >
            {data.filters.difficulty_choices.map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
      </div>
      
      {/* Tests dense grid */}
      {data.tests.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-50 flex items-center justify-center text-3xl">📚</div>
          <h3 className="font-bold text-gray-900 mb-1">Hech narsa topilmadi</h3>
          <p className="text-sm text-gray-500">Filtrlarni o'zgartirib qaytadan urinib ko'ring</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {data.tests.map((test) => <TestCard key={test.id} test={test} />)}
          </div>
          
          {/* Pagination */}
          {data.meta.total_pages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => updateParam("page", String(page - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-30"
              >
                ← Oldingi
              </button>
              <span className="text-sm text-gray-500">{page} / {data.meta.total_pages}</span>
              <button
                onClick={() => updateParam("page", String(page + 1))}
                disabled={page >= data.meta.total_pages}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-30"
              >
                Keyingi →
              </button>
            </div>
          )}
        </>
      )}
    </B2CLayout>
  );
}


function TestCard({ test }: { test: Test }) {
  const sectionClass = {
    listening: "bg-blue-50 text-blue-700",
    reading: "bg-rose-50 text-rose-700",
    writing: "bg-emerald-50 text-emerald-700",
    full: "bg-violet-50 text-violet-700",
  }[test.section] || "bg-gray-50 text-gray-700";
  
  return (
    <Link
      to={`/b2c/catalog/${test.id}`}
      className="group bg-white border border-gray-200 hover:border-rose-300 hover:shadow-sm rounded-xl p-4 transition flex flex-col"
    >
      {/* Top — section + source */}
      <div className="flex items-center gap-2 mb-2 text-[11px]">
        <span className={`font-semibold px-2 py-0.5 rounded-full ${sectionClass}`}>
          {test.section_display}
        </span>
        <span className="text-gray-400 truncate">{test.source_display}</span>
      </div>
      
      {/* Title */}
      <h3 className="font-bold text-gray-900 text-sm mb-2 group-hover:text-rose-600 transition line-clamp-2 leading-tight">
        {test.name}
      </h3>
      
      {/* Meta — duration + questions */}
      <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
        {test.duration_minutes && (
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 8v4l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {test.duration_minutes}m
          </span>
        )}
        {test.questions_count != null && (
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {test.questions_count}
          </span>
        )}
        <span className={`font-semibold ${DIFFICULTY_COLOR[test.difficulty] || ""}`}>
          {test.difficulty_display}
        </span>
      </div>
      
      {/* Footer — credit + Start */}
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-100">
        {test.credits_cost != null ? (
          <span className="text-xs font-bold text-amber-600 flex items-center gap-0.5">
            ⚡ {test.credits_cost}
          </span>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
        <span className="text-xs font-medium text-rose-600 group-hover:underline">
          Start →
        </span>
      </div>
    </Link>
  );
}
```

**Mobil/responsiv breakpoints:**
- `grid-cols-1` — mobil (xs)
- `sm:grid-cols-2` — kichik planshet (640px+)
- `lg:grid-cols-3` — planshet (1024px+)
- `xl:grid-cols-4` — desktop (1280px+)

Bu IELTStation kabi zich grid.

---

## 5-bosqich: Super-admin B2C Catalog manage — source field

`SuperAdminB2CCatalogPage.tsx` da har bir test uchun source dropdown qo'shing:

```tsx
const SOURCE_OPTIONS = [
  { value: "cambridge_7", label: "Cambridge 7" },
  { value: "cambridge_8", label: "Cambridge 8" },
  { value: "cambridge_9", label: "Cambridge 9" },
  { value: "cambridge_10", label: "Cambridge 10" },
  { value: "cambridge_11", label: "Cambridge 11" },
  { value: "cambridge_12", label: "Cambridge 12" },
  { value: "cambridge_13", label: "Cambridge 13" },
  { value: "cambridge_14", label: "Cambridge 14" },
  { value: "cambridge_15", label: "Cambridge 15" },
  { value: "cambridge_16", label: "Cambridge 16" },
  { value: "cambridge_17", label: "Cambridge 17" },
  { value: "cambridge_18", label: "Cambridge 18" },
  { value: "cambridge_19", label: "Cambridge 19" },
  { value: "cambridge_20", label: "Cambridge 20" },
  { value: "real_exam_2024", label: "Real Exam 2024" },
  { value: "real_exam_2025", label: "Real Exam 2025" },
  { value: "real_exam_2026", label: "Real Exam 2026" },
  { value: "ildiz_original", label: "ILDIZ Original" },
  { value: "other", label: "Boshqa" },
];

// Edit form ichida:
<div className="grid grid-cols-2 gap-2 mb-2">
  <select
    name="source"
    value={test.source || "other"}
    onChange={(e) => updateTestField(test.id, "source", e.target.value)}
    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
  >
    {SOURCE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
  </select>
  
  {test.source === "other" && (
    <input
      type="text"
      name="source_custom_name"
      value={test.source_custom_name || ""}
      onChange={(e) => updateTestField(test.id, "source_custom_name", e.target.value)}
      placeholder="Erkin manba nomi"
      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
    />
  )}
</div>
```

Backend `b2c-meta` action serializer'ga `source` va `source_custom_name` ni qabul qilish uchun yangilang.

---

## 6-bosqich: Mavjud testlarga source ulash — yordamchi shell

Yangi field default `OTHER` ga o'rnatilgan. Mavjud testlarni to'g'ri source'larga ko'chirish uchun shell:

```bash
python manage.py shell
```

```python
from apps.tests.models import Test

# Misol: Test nomida "Cambridge 9" bo'lsa, source ni avtomatik aniqlash
for t in Test.objects.filter(available_for_b2c=True):
    name = t.name.lower()
    if "cambridge 7" in name or "cambridge_7" in name:
        t.source = Test.Source.CAMBRIDGE_7
    elif "cambridge 8" in name or "cambridge_8" in name:
        t.source = Test.Source.CAMBRIDGE_8
    elif "cambridge 9" in name or "cambridge_9" in name:
        t.source = Test.Source.CAMBRIDGE_9
    # ... va h.k.
    elif "real exam" in name:
        t.source = Test.Source.REAL_EXAM_2025
    t.save(update_fields=["source"])

print(f"Updated: {Test.objects.exclude(source='other').count()} ta test")
```

Yoki super-admin'da qo'lda har biriga belgilang — testlar ko'p emas hozircha.

---

## 7-bosqich: Catalog detail sahifani moslashtirish

`CatalogDetailPage.tsx` da source ko'rsatish (kichik o'zgarish — hero section'da):

```tsx
<div className="flex items-center gap-2 mb-2 text-xs">
  <span className={`font-semibold px-2.5 py-1 rounded-full ${sectionClass}`}>
    {test.section_display}
  </span>
  <span className="text-gray-500">·</span>
  <span className="text-gray-600 font-medium">{test.source_display}</span>
</div>
```

---

## 8-bosqich: Manual test checklist

- [ ] Migration ishlagan, `Test.source` mavjud, defaultda barcha testlar `OTHER`
- [ ] Super-admin B2C Catalog manage'da source dropdown ishlaydi
- [ ] `source=OTHER` tanlanganda `source_custom_name` input ko'rinadi va saqlanadi
- [ ] Bir nechta testga turli sourcelar belgilang (Cambridge 9, Cambridge 10, ILDIZ Original)
- [ ] `/b2c/catalog/` ochiladi — header, section tabs (counts bilan), filterlar, dense 4-ustun grid
- [ ] **Desktop**: 4 ustun ko'rinadi
- [ ] **Tablet (lg)**: 3 ustun
- [ ] **Phone (mobile)**: 1-2 ustun
- [ ] Section tab bossangiz URL `?section=...` ga o'zgaradi va testlar filterlanadi
- [ ] Counts har section tab'da to'g'ri (masalan, "Reading (12)")
- [ ] Source dropdown faqat testlari mavjud bo'lgan source'larni ko'rsatadi (bo'sh source'lar yo'q)
- [ ] Source filter bo'yicha to'g'ri filterlash
- [ ] Difficulty filter ishlaydi
- [ ] Qidiruv Enter bossa filterlanadi
- [ ] URL parametrlari saqlanib turadi (refresh qilsangiz filter qoladi)
- [ ] Per page 24 ta test
- [ ] 24+ test bo'lsa paginatsiya ko'rinadi
- [ ] Card'da: section badge, source matni, test nomi, davomiyligi/savol soni/difficulty, credit (yoki "—"), Start
- [ ] Card bossa detail sahifaga o'tadi
- [ ] Empty state to'g'ri ko'rinadi (filter natijasi bo'sh bo'lsa)
- [ ] Catalog detail sahifada source ko'rinadi
- [ ] Mavjud testlarga shell orqali source ulash ishladi

---

## 9-bosqich: Git commit va push (MAJBURIY)

```bash
git add .
git commit -m "ETAP 16.6: B2C Catalog UI redesign — Test.source field, dense 4-column grid, section tabs with counts, source filter"
git push origin <branch-nomi>
```

---

## Yakuniy checklist

- [ ] `Test.source` (TextChoices) va `source_custom_name` (CharField) field'lari
- [ ] `Test.source_display` property
- [ ] Migration ishlagan
- [ ] `catalog_service.filter_catalog` source parametri qabul qiladi
- [ ] `catalog_service.get_available_sources()` — faqat ishlatilgan source'lar
- [ ] `B2CCatalogListView` source filter qaytaradi, per_page 24
- [ ] Serializer'da source, source_display
- [ ] `CatalogPage.tsx` to'liq qayta yozilgan (dense grid, tabs with counts, source dropdown)
- [ ] `TestCard` minimal + difficulty + duration + credit + Start
- [ ] Responsive: 1/2/3/4 ustun
- [ ] URL params saqlanadi
- [ ] Super-admin Catalog manage'da source dropdown va custom name
- [ ] CatalogDetailPage'da source ko'rinadi
- [ ] Migration fayllar git'da
- [ ] `git push origin <branch>` muvaffaqiyatli

---

## Keyingi qadam

Bu ETAP'dan keyin:
1. Mavjud testlaringizga qo'lda yoki shell orqali source belgilang
2. PDF import (ETAP 16.5) orqali Cambridge kitoblardan ko'proq test qo'shing
3. Source belgilash bilan zich grid endi haqiqiy "to'la" ko'rinadi

Keyin ETAP 17 (kreditlar) bilan davom etamiz — card'dagi `⚡ —` placeholder real narxga aylanadi.
