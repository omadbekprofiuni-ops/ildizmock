# ETAP 19: Super Admin Panel — Centers, B2C Users, Credits, Promo Codes

## Kontekst

Super-admin paneli kengayib boryapti, lekin uzilgan bo'laklar bilan:
- Markazlar (centers) ro'yxati va boshqaruvi yo'q yoki to'liq emas
- B2C foydalanuvchilar boshqaruvi yo'q (ETAP 17'da skeleton bor edi, lekin ko'rinmagan)
- Kredit operatsiyalari yo'q yoki yashirin
- Promo kod tizimi yo'q

**Bu ETAP-ning vazifasi:** Super-admin paneliga uchta katta bo'lim qo'shish va sidebar'ni guruhlash:

1. **Markazlar admin** — ro'yxat, drill-down detail (KPI'lar + trend chart + guruhlar), suspend/activate, edit, soft-delete, admin qayta tayinlash
2. **B2C foydalanuvchilar admin** — ro'yxat, drill-down detail (profil + kredit tarix + test tarix), kredit grant/deduct/refund
3. **Kreditlar** — bulk grant, promo kod CRUD, tranzaksiya qidiruv
4. **Sidebar restructuring** — guruhlangan kategoriyalar

Hammasi bitta katta ETAP — chunki sidebar restructure ikkalasiga ham kerak, va credit operatsiyalari ikki sahifa orasida bo'lib ketadi.

## Loyihaning hozirgi holati

- ETAP 14-17 dan: B2C foundation, OAuth, catalog, credit system (model'lar bor)
- ETAP 17 da `SuperAdminCreditsPage` yozilgan edi, lekin sidebar'da ko'rinmaganligi mumkin yoki to'liq emas — bu ETAP'da **batafsil qayta yozamiz**
- Mavjud Center modeli (slug-based URLs `/<slug>/admin/...` ishlatadi)
- `B2CProfile`, `CreditBalance`, `CreditTransaction`, `CreditPackage`, `B2CTestAttempt`, `B2CActivityEvent` modellari mavjud
- Chart.js ulangan

## ETAP yakunidagi natija

1. Sidebar 5 ta kategoriyaga guruhlangan
2. `/super/centers/` — markazlar ro'yxati + filter + status badge'lar
3. `/super/centers/<slug>/` — markaz drill-down: KPI tile'lar + 6 oylik trend chart + guruhlar ro'yxati
4. Markazni suspend/activate, edit, soft-delete qila olish
5. Markaz admin'ini qayta tayinlash (yangi user'ga rol berish)
6. `/super/b2c-users/` — B2C user ro'yxati + qidiruv + filter
7. `/super/b2c-users/<id>/` — user drill-down: profil + kredit balansi va to'liq tarix + test tarix
8. Kredit operatsiyalari user detail sahifasidan: grant, deduct (izoh majburiy), refund (ma'lum attempt'ga)
9. `/super/credits/` — barcha tranzaksiyalar qidiruv (umumiy ro'yxat), **bulk grant** wizard, **promo kodlar**
10. `CreditPromoCode` va `CreditPromoCodeRedemption` modellari
11. Promo kod CRUD UI
12. Promo kod qabul qilish endpoint (B2C user `/b2c/promo-codes/` orqali)
13. Super-admin dashboard 4 ta yangi KPI bilan yangilangan
14. Git push muvaffaqiyatli

---

## 1-bosqich: Sidebar restructure

### `components/SuperAdminLayout.tsx` — sidebar qismi

Hozirgi tekis ro'yxat o'rniga, kategoriyalarga guruhlanadi. Har kategoriyaning kichik bosh harfli label'i va NavItem'lar:

```tsx
const SIDEBAR_GROUPS = [
  {
    label: null,  // header yo'q
    items: [
      { key: "dashboard", to: "/super/dashboard", icon: "📊", label: "Dashboard" },
    ],
  },
  {
    label: "Tashkilotlar",
    items: [
      { key: "centers", to: "/super/centers", icon: "🏫", label: "Markazlar" },
      { key: "b2b-stats", to: "/super/b2b-stats", icon: "📈", label: "B2B Statistika" },
    ],
  },
  {
    label: "B2C",
    items: [
      { key: "b2c-users", to: "/super/b2c-users", icon: "👥", label: "Foydalanuvchilar" },
      { key: "b2c-catalog", to: "/super/b2c-catalog", icon: "📚", label: "Katalog" },
      { key: "credits", to: "/super/credits", icon: "⚡", label: "Kreditlar" },
      { key: "promo-codes", to: "/super/promo-codes", icon: "🎁", label: "Promo kodlar" },
      { key: "packages", to: "/super/packages", icon: "📦", label: "Paketlar" },
    ],
  },
  {
    label: "Testlar",
    items: [
      { key: "global-tests", to: "/super/global-tests", icon: "📝", label: "Global testlar" },
    ],
  },
  {
    label: "Tizim",
    items: [
      { key: "ai-providers", to: "/super/settings/ai-providers", icon: "🤖", label: "AI Providers" },
      { key: "audio-files", to: "/super/audio-files", icon: "🎵", label: "Audio fayllar" },
      { key: "settings", to: "/super/settings", icon: "⚙️", label: "Sozlamalar" },
    ],
  },
];

// Render:
<aside className="...">
  {SIDEBAR_GROUPS.map((group, i) => (
    <div key={i} className={i > 0 ? "mt-5" : ""}>
      {group.label && (
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-3 mb-2">
          {group.label}
        </p>
      )}
      <nav className="space-y-0.5">
        {group.items.map((item) => (
          <NavItem key={item.key} {...item} active={active === item.key} />
        ))}
      </nav>
    </div>
  ))}
  
  {/* Pastda AI Quota badge mavjud — saqlanadi */}
</aside>
```

**Eslatma:** Cursor Agent loyihadagi mavjud `SuperAdminLayout` strukturasiga moslab integratsiya qilsin. Agar ba'zi sahifalar (B2B Stats, Audio files, Packages) hali mavjud bo'lmasa, link'ni qoldiring va `[SOON]` badge qo'shing.

---

## 2-bosqich: Markazlar admin

### Backend — `apps/centers/models.py` ga qo'shish (yoki haqiqiy joy)

Mavjud Center modeliga (agar yo'q bo'lsa) `is_suspended` va `suspended_reason` field'lari kerak:

```python
class Center(models.Model):  # yoki haqiqiy nom
    # ... mavjud field'lar (name, slug, admin, va h.k.) ...
    
    is_suspended = models.BooleanField(default=False, db_index=True)
    suspended_at = models.DateTimeField(null=True, blank=True)
    suspended_reason = models.TextField(blank=True)
    suspended_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="suspended_centers",
    )
    
    # Soft-delete (agar mavjud `SoftDeleteModel`'dan inherit qilinmasa)
    deleted_at = models.DateTimeField(null=True, blank=True, db_index=True)
    
    @property
    def is_active(self):
        return not self.is_suspended and self.deleted_at is None
```

Migration ishlatish kerak. Agar Center allaqachon `SoftDeleteModel`'dan inherit qilingan bo'lsa, `deleted_at` qo'shish shart emas.

### `apps/super_admin/services/centers.py`

```python
from datetime import date, timedelta
from django.db.models import Count, Q
from django.utils import timezone


def get_centers_list(*, search=None, status=None):
    """
    status: "all" | "active" | "suspended" | "deleted"
    """
    from apps.centers.models import Center  # haqiqiy import
    
    qs = Center.objects.all()
    
    if status == "active":
        qs = qs.filter(is_suspended=False, deleted_at__isnull=True)
    elif status == "suspended":
        qs = qs.filter(is_suspended=True, deleted_at__isnull=True)
    elif status == "deleted":
        qs = qs.filter(deleted_at__isnull=False)
    
    if search:
        qs = qs.filter(Q(name__icontains=search) | Q(slug__icontains=search))
    
    # Annotate counts (har row uchun ekstra so'rov yubormaslik)
    return qs.annotate(
        students_count=Count("groups__students", distinct=True),  # haqiqiy rel'larga moslang
        teachers_count=Count("teachers", distinct=True),
        groups_count=Count("groups", distinct=True),
    ).order_by("-created_at")


def get_center_detail(center):
    """Drill-down sahifa uchun KPI va statistika."""
    from apps.attendance.models import Session  # ETAP 20 dan
    
    today = date.today()
    month_ago = today - timedelta(days=30)
    
    # Asosiy KPI
    students_count = center.groups.aggregate(c=Count("students", distinct=True))["c"] or 0  # haqiqiy rel
    teachers_count = center.teachers.count() if hasattr(center, "teachers") else 0
    groups_count = center.groups.count() if hasattr(center, "groups") else 0
    
    # Oxirgi 30 kun sessiyalar
    recent_sessions = Session.objects.filter(
        group__center=center, date__gte=month_ago,
    ).exclude(status="cancelled")
    sessions_count = recent_sessions.count()
    
    # Faol talabalar (oxirgi 30 kunda davomat'da bo'lgan)
    from apps.attendance.models import AttendanceRecord
    active_students = (
        AttendanceRecord.objects
        .filter(session__group__center=center, session__date__gte=month_ago, status__in=["present", "late"])
        .values("student_id")
        .distinct()
        .count()
    )
    
    # 6 oylik trend
    from collections import defaultdict
    six_months_ago = today - timedelta(days=180)
    
    new_students_by_month = defaultdict(int)
    sessions_by_month = defaultdict(int)
    
    # Yangi talabalar — haqiqiy User modeliga moslang
    from django.contrib.auth import get_user_model
    User = get_user_model()
    
    new_students = User.objects.filter(
        user_type="b2b_student",
        # markazga tegishlilik — haqiqiy rel'ga moslang (masalan studentgroup__center)
        date_joined__gte=six_months_ago,
    ).values_list("date_joined", flat=True)
    
    for dt in new_students:
        key = dt.strftime("%Y-%m")
        new_students_by_month[key] += 1
    
    all_sessions = Session.objects.filter(
        group__center=center, date__gte=six_months_ago,
    ).values_list("date", flat=True)
    
    for d in all_sessions:
        key = d.strftime("%Y-%m")
        sessions_by_month[key] += 1
    
    # 6 oylik label'lar
    months = []
    cursor = today.replace(day=1)
    for _ in range(6):
        months.insert(0, cursor.strftime("%Y-%m"))
        cursor = (cursor - timedelta(days=1)).replace(day=1)
    
    trend = [
        {
            "month": m,
            "new_students": new_students_by_month.get(m, 0),
            "sessions": sessions_by_month.get(m, 0),
        }
        for m in months
    ]
    
    # Guruhlar
    groups_data = []
    for g in center.groups.all().select_related():  # haqiqiy rel
        group_students = g.students.count() if hasattr(g, "students") else 0
        # Davomat % (oxirgi 30 kun)
        records = AttendanceRecord.objects.filter(
            session__group=g, session__date__gte=month_ago, status__isnull=False,
        )
        marked = records.count()
        attended = records.filter(status__in=["present", "late"]).count()
        percent = round(attended / marked * 100, 1) if marked else None
        
        groups_data.append({
            "id": g.id,
            "name": g.name,
            "students_count": group_students,
            "attendance_percent": percent,
        })
    
    return {
        "kpi": {
            "students": students_count,
            "teachers": teachers_count,
            "groups": groups_count,
            "active_students_30d": active_students,
            "sessions_30d": sessions_count,
        },
        "trend": trend,
        "groups": groups_data,
        "has_activity": sessions_count > 0 or len(groups_data) > 0,
    }


def suspend_center(center, *, by_user, reason):
    center.is_suspended = True
    center.suspended_at = timezone.now()
    center.suspended_by = by_user
    center.suspended_reason = reason or ""
    center.save(update_fields=["is_suspended", "suspended_at", "suspended_by", "suspended_reason"])


def activate_center(center, *, by_user):
    center.is_suspended = False
    center.suspended_at = None
    center.suspended_reason = ""
    center.save(update_fields=["is_suspended", "suspended_at", "suspended_reason"])


def soft_delete_center(center, *, by_user):
    center.deleted_at = timezone.now()
    center.save(update_fields=["deleted_at"])
```

### `apps/super_admin/views_centers.py`

```python
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db import transaction

from .services.centers import (
    get_centers_list, get_center_detail,
    suspend_center, activate_center, soft_delete_center,
)


def _superadmin(request):
    return request.user.is_authenticated and request.user.user_type == "superadmin"


class CentersListView(APIView):
    """GET /api/v1/super/centers/"""
    
    def get(self, request):
        if not _superadmin(request):
            return Response(status=403)
        
        qs = get_centers_list(
            search=request.query_params.get("q", "").strip(),
            status=request.query_params.get("status", "all"),
        )
        
        # KPI yuqorida
        from apps.centers.models import Center
        total = Center.objects.filter(deleted_at__isnull=True).count()
        active = Center.objects.filter(is_suspended=False, deleted_at__isnull=True).count()
        suspended = Center.objects.filter(is_suspended=True, deleted_at__isnull=True).count()
        
        return Response({
            "summary": {
                "total": total,
                "active": active,
                "suspended": suspended,
            },
            "centers": [
                {
                    "id": c.id,
                    "name": c.name,
                    "slug": c.slug,
                    "admin_email": c.admin.email if c.admin else None,
                    "admin_name": c.admin.get_full_name() if c.admin else None,
                    "students_count": c.students_count,
                    "teachers_count": c.teachers_count,
                    "groups_count": c.groups_count,
                    "is_suspended": c.is_suspended,
                    "is_deleted": c.deleted_at is not None,
                    "suspended_reason": c.suspended_reason,
                    "created_at": c.created_at,
                }
                for c in qs[:200]  # max 200, paginatsiya keyinroq
            ],
        })


class CenterDetailView(APIView):
    """GET /api/v1/super/centers/<slug>/"""
    
    def get(self, request, slug):
        if not _superadmin(request):
            return Response(status=403)
        
        from apps.centers.models import Center
        center = get_object_or_404(Center, slug=slug)
        
        detail = get_center_detail(center)
        
        return Response({
            "center": {
                "id": center.id,
                "name": center.name,
                "slug": center.slug,
                "admin": {
                    "id": center.admin.id, "email": center.admin.email,
                    "name": center.admin.get_full_name(),
                } if center.admin else None,
                "is_suspended": center.is_suspended,
                "is_deleted": center.deleted_at is not None,
                "suspended_reason": center.suspended_reason,
                "suspended_at": center.suspended_at,
                "created_at": center.created_at,
            },
            **detail,
        })


class CenterSuspendView(APIView):
    """POST /api/v1/super/centers/<slug>/suspend/"""
    
    def post(self, request, slug):
        if not _superadmin(request):
            return Response(status=403)
        
        from apps.centers.models import Center
        center = get_object_or_404(Center, slug=slug)
        
        reason = request.data.get("reason", "").strip()
        if not reason:
            return Response({"error": "Sabab kiritish majburiy"}, status=400)
        
        suspend_center(center, by_user=request.user, reason=reason)
        return Response({"status": "suspended"})


class CenterActivateView(APIView):
    """POST /api/v1/super/centers/<slug>/activate/"""
    
    def post(self, request, slug):
        if not _superadmin(request):
            return Response(status=403)
        
        from apps.centers.models import Center
        center = get_object_or_404(Center, slug=slug)
        activate_center(center, by_user=request.user)
        return Response({"status": "activated"})


class CenterUpdateView(APIView):
    """PATCH /api/v1/super/centers/<slug>/"""
    
    def patch(self, request, slug):
        if not _superadmin(request):
            return Response(status=403)
        
        from apps.centers.models import Center
        center = get_object_or_404(Center, slug=slug)
        
        # Faqat ruxsat etilgan field'lar
        if "name" in request.data:
            center.name = request.data["name"]
        if "slug" in request.data:
            # Slug o'zgartirish — xavfli, mavjud URL'lar buziladi
            new_slug = request.data["slug"].strip()
            if new_slug != center.slug:
                if Center.objects.filter(slug=new_slug).exclude(pk=center.pk).exists():
                    return Response({"error": "Bu slug allaqachon ishlatilgan"}, status=400)
                center.slug = new_slug
        
        center.save()
        return Response({"status": "updated", "slug": center.slug})


class CenterReassignAdminView(APIView):
    """POST /api/v1/super/centers/<slug>/reassign-admin/"""
    
    def post(self, request, slug):
        if not _superadmin(request):
            return Response(status=403)
        
        from apps.centers.models import Center
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        center = get_object_or_404(Center, slug=slug)
        
        new_admin_email = request.data.get("email", "").strip().lower()
        if not new_admin_email:
            return Response({"error": "Email kiriting"}, status=400)
        
        with transaction.atomic():
            try:
                new_admin = User.objects.get(email__iexact=new_admin_email)
            except User.DoesNotExist:
                return Response({"error": "Foydalanuvchi topilmadi"}, status=404)
            
            # Eski admin'dan rol'ni olib tashlash (yoki maintained holatda qoldirish)
            # Logikani loyihaga moslang
            
            new_admin.user_type = "b2b_admin"
            new_admin.center = center  # haqiqiy rel
            new_admin.save(update_fields=["user_type", "center"])
            
            center.admin = new_admin
            center.save(update_fields=["admin"])
        
        return Response({"status": "reassigned", "admin_email": new_admin.email})


class CenterDeleteView(APIView):
    """POST /api/v1/super/centers/<slug>/delete/"""
    
    def post(self, request, slug):
        if not _superadmin(request):
            return Response(status=403)
        
        confirm = request.data.get("confirm_text", "")
        from apps.centers.models import Center
        center = get_object_or_404(Center, slug=slug)
        
        # Tasdiqlash uchun foydalanuvchi markaz nomini terib bersin
        if confirm != center.name:
            return Response(
                {"error": f"Tasdiqlash matni mos kelmaydi. Markaz nomini aniq tering: \"{center.name}\""},
                status=400,
            )
        
        soft_delete_center(center, by_user=request.user)
        return Response({"status": "deleted"})
```

### URLs

```python
# apps/super_admin/urls.py
from . import views_centers as vc

urlpatterns = [
    # ... mavjud ...
    path("centers/", vc.CentersListView.as_view()),
    path("centers/<slug:slug>/", vc.CenterDetailView.as_view()),
    path("centers/<slug:slug>/suspend/", vc.CenterSuspendView.as_view()),
    path("centers/<slug:slug>/activate/", vc.CenterActivateView.as_view()),
    path("centers/<slug:slug>/update/", vc.CenterUpdateView.as_view()),
    path("centers/<slug:slug>/reassign-admin/", vc.CenterReassignAdminView.as_view()),
    path("centers/<slug:slug>/delete/", vc.CenterDeleteView.as_view()),
]
```

### Frontend — `pages/superadmin/SuperAdminCentersPage.tsx`

```tsx
import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";

export function SuperAdminCentersPage() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<any>(null);
  
  const search = params.get("q") || "";
  const status = params.get("status") || "all";
  
  useEffect(() => {
    fetch(`/api/v1/super/centers/?q=${encodeURIComponent(search)}&status=${status}`)
      .then((r) => r.json()).then(setData);
  }, [search, status]);
  
  if (!data) return <SuperAdminLayout><div className="py-12 text-center text-gray-500">Yuklanmoqda...</div></SuperAdminLayout>;
  
  return (
    <SuperAdminLayout active="centers">
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Markazlar</h1>
        <p className="text-sm text-gray-500 mt-1">O'quv markazlarining faolligi va boshqaruvi</p>
      </div>
      
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <p className="text-xs text-gray-500">Jami</p>
          <p className="text-2xl font-bold">{data.summary.total}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <p className="text-xs text-green-700">Faol</p>
          <p className="text-2xl font-bold text-green-700">{data.summary.active}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <p className="text-xs text-amber-700">To'xtatilgan</p>
          <p className="text-2xl font-bold text-amber-700">{data.summary.suspended}</p>
        </div>
      </div>
      
      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-2xl p-3 mb-4 flex gap-2">
        <input
          type="text" defaultValue={search}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const next = new URLSearchParams(params);
              next.set("q", (e.target as HTMLInputElement).value);
              setParams(next);
            }
          }}
          placeholder="Markaz nomi yoki slug..."
          className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
        />
        <select
          value={status}
          onChange={(e) => {
            const next = new URLSearchParams(params);
            next.set("status", e.target.value);
            setParams(next);
          }}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
        >
          <option value="all">Barcha holatlar</option>
          <option value="active">Faol</option>
          <option value="suspended">To'xtatilgan</option>
          <option value="deleted">O'chirilgan</option>
        </select>
      </div>
      
      {/* List */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="px-4 py-2 text-left">Markaz</th>
              <th className="px-4 py-2 text-left">Admin</th>
              <th className="px-4 py-2 text-center">Guruhlar</th>
              <th className="px-4 py-2 text-center">Talabalar</th>
              <th className="px-4 py-2 text-center">O'qituvchi</th>
              <th className="px-4 py-2 text-center">Holat</th>
              <th className="px-4 py-2 text-left">Ro'yxat</th>
            </tr>
          </thead>
          <tbody>
            {data.centers.map((c: any) => (
              <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link to={`/super/centers/${c.slug}`} className="font-medium hover:text-rose-600">
                    {c.name}
                  </Link>
                  <p className="text-xs text-gray-400">{c.slug}</p>
                </td>
                <td className="px-4 py-3 text-gray-600">{c.admin_email || "—"}</td>
                <td className="px-4 py-3 text-center">{c.groups_count}</td>
                <td className="px-4 py-3 text-center">{c.students_count}</td>
                <td className="px-4 py-3 text-center">{c.teachers_count}</td>
                <td className="px-4 py-3 text-center">
                  {c.is_deleted ? (
                    <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">O'CHIRILGAN</span>
                  ) : c.is_suspended ? (
                    <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full" title={c.suspended_reason}>
                      TO'XTATILGAN
                    </span>
                  ) : (
                    <span className="text-xs font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">FAOL</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {new Date(c.created_at).toLocaleDateString("uz")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {data.centers.length === 0 && (
          <div className="py-12 text-center text-gray-500 text-sm">
            Hech qanday markaz topilmadi
          </div>
        )}
      </div>
    </SuperAdminLayout>
  );
}
```

### Frontend — `pages/superadmin/SuperAdminCenterDetailPage.tsx`

```tsx
import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Line } from "react-chartjs-2";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import toast from "react-hot-toast";

export function SuperAdminCenterDetailPage() {
  const { slug } = useParams();
  const [data, setData] = useState<any>(null);
  
  const load = () => {
    fetch(`/api/v1/super/centers/${slug}/`).then((r) => r.json()).then(setData);
  };
  useEffect(load, [slug]);
  
  const suspend = async () => {
    const reason = prompt("To'xtatish sababini yozing:");
    if (!reason) return;
    const res = await fetch(`/api/v1/super/centers/${slug}/suspend/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrf() },
      body: JSON.stringify({ reason }),
    });
    if (res.ok) { toast.success("Markaz to'xtatildi"); load(); }
  };
  
  const activate = async () => {
    if (!confirm("Markazni qaytadan faol qilamiz?")) return;
    const res = await fetch(`/api/v1/super/centers/${slug}/activate/`, {
      method: "POST", headers: { "X-CSRFToken": getCsrf() },
    });
    if (res.ok) { toast.success("Markaz faol"); load(); }
  };
  
  const softDelete = async () => {
    const text = prompt(`O'chirishni tasdiqlash uchun markaz nomini aniq tering:\n"${data.center.name}"`);
    if (text !== data.center.name) {
      if (text !== null) toast.error("Matn mos kelmadi");
      return;
    }
    const res = await fetch(`/api/v1/super/centers/${slug}/delete/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrf() },
      body: JSON.stringify({ confirm_text: text }),
    });
    if (res.ok) { toast.success("Markaz arxivga o'tdi"); load(); }
  };
  
  const reassign = async () => {
    const email = prompt("Yangi admin email'i:");
    if (!email) return;
    const res = await fetch(`/api/v1/super/centers/${slug}/reassign-admin/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrf() },
      body: JSON.stringify({ email }),
    });
    const result = await res.json();
    if (res.ok) { toast.success(`Yangi admin: ${result.admin_email}`); load(); }
    else { toast.error(result.error || "Xatolik"); }
  };
  
  if (!data) return <SuperAdminLayout><div className="py-12 text-center">Yuklanmoqda...</div></SuperAdminLayout>;
  
  const { center, kpi, trend, groups, has_activity } = data;
  
  return (
    <SuperAdminLayout active="centers">
      <Link to="/super/centers" className="text-sm text-gray-500 hover:text-rose-600">← Markazlarga qaytish</Link>
      
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 mt-3 mb-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold">{center.name}</h1>
              {center.is_deleted ? (
                <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">O'CHIRILGAN</span>
              ) : center.is_suspended ? (
                <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full">TO'XTATILGAN</span>
              ) : (
                <span className="text-xs font-semibold bg-green-100 text-green-700 px-2.5 py-1 rounded-full">FAOL</span>
              )}
            </div>
            <p className="text-sm text-gray-500">/{center.slug}/ · ro'yxatdan o'tgan: {new Date(center.created_at).toLocaleDateString("uz")}</p>
            {center.admin && (
              <p className="text-sm text-gray-600 mt-2">
                Admin: <b>{center.admin.name}</b> ({center.admin.email})
              </p>
            )}
            {center.is_suspended && center.suspended_reason && (
              <div className="mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                <b>Sabab:</b> {center.suspended_reason}
              </div>
            )}
          </div>
          
          {!center.is_deleted && (
            <div className="flex flex-col gap-2 items-end">
              {center.is_suspended ? (
                <button onClick={activate} className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
                  Faol qilish
                </button>
              ) : (
                <button onClick={suspend} className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
                  To'xtatish
                </button>
              )}
              <button onClick={reassign} className="border border-gray-300 hover:bg-gray-50 text-sm px-4 py-2 rounded-lg">
                Admin qayta tayinlash
              </button>
              <button onClick={softDelete} className="text-sm text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg">
                Arxivga
              </button>
            </div>
          )}
        </div>
      </div>
      
      {!has_activity ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <p className="text-gray-500">Bu markaz hali sessiya o'tkazmagan</p>
        </div>
      ) : (
        <>
          {/* KPI */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
            <KPI label="Jami talaba" value={kpi.students} />
            <KPI label="O'qituvchi" value={kpi.teachers} />
            <KPI label="Guruhlar" value={kpi.groups} />
            <KPI label="30 kunda faol" value={kpi.active_students_30d} accent="rose" />
            <KPI label="30 kunda sessiya" value={kpi.sessions_30d} />
          </div>
          
          {/* Trend chart */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-5">
            <h2 className="font-bold mb-4">O'sish trendi (oxirgi 6 oy)</h2>
            <Line
              data={{
                labels: trend.map((t: any) => t.month),
                datasets: [
                  {
                    label: "Yangi talabalar",
                    data: trend.map((t: any) => t.new_students),
                    borderColor: "rgb(225, 29, 72)",
                    backgroundColor: "rgba(225, 29, 72, 0.1)",
                    tension: 0.3,
                  },
                  {
                    label: "Sessiyalar",
                    data: trend.map((t: any) => t.sessions),
                    borderColor: "rgb(59, 130, 246)",
                    backgroundColor: "rgba(59, 130, 246, 0.1)",
                    tension: 0.3,
                  },
                ],
              }}
              options={{ responsive: true }}
            />
          </div>
          
          {/* Groups */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <h2 className="font-bold mb-4">Guruhlar</h2>
            <div className="divide-y divide-gray-100">
              {groups.map((g: any) => (
                <div key={g.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{g.name}</p>
                    <p className="text-xs text-gray-500">{g.students_count} talaba</p>
                  </div>
                  <div className="text-right">
                    {g.attendance_percent !== null ? (
                      <p className={`font-bold ${g.attendance_percent < 70 ? "text-red-600" : "text-rose-600"}`}>
                        {g.attendance_percent}%
                      </p>
                    ) : (
                      <p className="text-gray-400 text-sm">—</p>
                    )}
                    <p className="text-xs text-gray-500">davomat (30 kun)</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </SuperAdminLayout>
  );
}


function KPI({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent === "rose" ? "text-rose-600" : ""}`}>{value}</p>
    </div>
  );
}
```

Route: `/super/centers` va `/super/centers/:slug`

---

## 3-bosqich: B2C foydalanuvchilar admin

### `apps/super_admin/services/b2c_users.py`

```python
from django.contrib.auth import get_user_model
from django.db.models import Q, Sum

User = get_user_model()


def get_b2c_users_list(*, search=None, min_balance=None, max_balance=None,
                       signup_source=None, limit=100):
    qs = User.objects.filter(user_type="b2c_user").select_related(
        "b2c_profile", "credit_balance"
    )
    
    if search:
        qs = qs.filter(
            Q(email__icontains=search) |
            Q(first_name__icontains=search) |
            Q(last_name__icontains=search) |
            Q(b2c_profile__phone_number__icontains=search)
        )
    
    if signup_source and signup_source != "all":
        qs = qs.filter(b2c_profile__signup_source=signup_source)
    
    qs = qs.order_by("-date_joined")[:limit]
    
    result = []
    for u in qs:
        balance = getattr(u, "credit_balance", None)
        balance_value = balance.balance if balance else 0
        if min_balance is not None and balance_value < min_balance:
            continue
        if max_balance is not None and balance_value > max_balance:
            continue
        profile = getattr(u, "b2c_profile", None)
        result.append({
            "id": u.id,
            "email": u.email,
            "name": u.get_full_name(),
            "phone": profile.phone_number if profile else "",
            "balance": balance_value,
            "signup_source": profile.signup_source if profile else "",
            "joined_at": u.date_joined,
            "target_exam": profile.target_exam if profile else "",
            "exam_date": profile.exam_date if profile else None,
        })
    return result


def get_b2c_user_detail(user):
    from apps.b2c.models import CreditTransaction, B2CTestAttempt, B2CActivityEvent
    from apps.b2c.services.activity import get_streak_stats
    
    profile = user.b2c_profile
    balance = user.credit_balance.balance if hasattr(user, "credit_balance") else 0
    
    # Tranzaksiyalar
    transactions = (
        CreditTransaction.objects.filter(user=user)
        .select_related("created_by", "related_attempt__test")[:100]
    )
    
    # Attempt'lar
    attempts = (
        B2CTestAttempt.objects.filter(user=user)
        .select_related("test")[:50]
    )
    
    # Activity
    events_count = B2CActivityEvent.objects.filter(user=user).count()
    streak = get_streak_stats(user)
    
    return {
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.get_full_name(),
            "joined_at": user.date_joined,
            "last_login": user.last_login,
        },
        "profile": {
            "phone": profile.phone_number,
            "preferred_language": profile.preferred_language,
            "signup_source": profile.signup_source,
            "target_exam": profile.target_exam,
            "target_band": float(profile.target_band) if profile.target_band else None,
            "exam_date": profile.exam_date,
            "weekly_goal_sessions": profile.weekly_goal_sessions,
        },
        "balance": balance,
        "streak": streak,
        "events_count": events_count,
        "transactions": [
            {
                "id": t.id,
                "kind": t.kind,
                "kind_display": t.get_kind_display(),
                "amount": t.amount,
                "balance_after": t.balance_after,
                "note": t.note,
                "created_by": t.created_by.email if t.created_by else None,
                "created_at": t.created_at,
                "related_test_id": t.related_attempt.test_id if t.related_attempt else None,
            }
            for t in transactions
        ],
        "attempts": [
            {
                "id": a.id,
                "test_id": a.test_id,
                "test_name": getattr(a.test, "b2c_name", None) or getattr(a.test, "name", ""),
                "status": a.status,
                "status_display": a.get_status_display(),
                "credits_spent": a.credits_spent,
                "score": float(a.score) if a.score else None,
                "started_at": a.started_at,
                "completed_at": a.completed_at,
                "is_refund_eligible": a.is_refund_eligible,
            }
            for a in attempts
        ],
    }
```

### `apps/super_admin/views_b2c_users.py`

```python
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.contrib.auth import get_user_model

from apps.b2c.services import credits as credit_service
from apps.b2c.models import CreditTransaction, B2CTestAttempt
from .services.b2c_users import get_b2c_users_list, get_b2c_user_detail

User = get_user_model()


def _superadmin(request):
    return request.user.is_authenticated and request.user.user_type == "superadmin"


class B2CUsersListView(APIView):
    def get(self, request):
        if not _superadmin(request):
            return Response(status=403)
        
        users = get_b2c_users_list(
            search=request.query_params.get("q", "").strip(),
            signup_source=request.query_params.get("signup_source", "all"),
            min_balance=request.query_params.get("min_balance"),
            max_balance=request.query_params.get("max_balance"),
        )
        
        total = User.objects.filter(user_type="b2c_user").count()
        
        return Response({"total": total, "users": users})


class B2CUserDetailView(APIView):
    def get(self, request, user_id):
        if not _superadmin(request):
            return Response(status=403)
        
        user = get_object_or_404(User, pk=user_id, user_type="b2c_user")
        return Response(get_b2c_user_detail(user))


class CreditGrantView(APIView):
    """POST /api/v1/super/b2c-users/<id>/credit-grant/"""
    
    def post(self, request, user_id):
        if not _superadmin(request):
            return Response(status=403)
        
        user = get_object_or_404(User, pk=user_id, user_type="b2c_user")
        amount = int(request.data.get("amount", 0))
        note = request.data.get("note", "").strip()
        action = request.data.get("action", "grant")  # grant | deduct
        
        if amount <= 0:
            return Response({"error": "Miqdor musbat bo'lishi kerak"}, status=400)
        if not note:
            return Response({"error": "Izoh majburiy"}, status=400)
        
        if action == "grant":
            tx = credit_service.grant_credits(
                user=user, amount=amount,
                kind=CreditTransaction.Kind.ADMIN_GRANT,
                created_by=request.user, note=note,
            )
        elif action == "deduct":
            tx = credit_service.deduct_credits(
                user=user, amount=amount,
                created_by=request.user, note=note,
            )
        else:
            return Response({"error": "Action grant yoki deduct bo'lishi kerak"}, status=400)
        
        return Response({
            "new_balance": user.credit_balance.balance,
            "transaction_id": tx.id,
        })


class CreditRefundView(APIView):
    """POST /api/v1/super/b2c-users/<id>/refund-attempt/"""
    
    def post(self, request, user_id):
        if not _superadmin(request):
            return Response(status=403)
        
        attempt_id = request.data.get("attempt_id")
        reason = request.data.get("reason", "").strip()
        force = request.data.get("force", False)  # admin override
        
        if not reason:
            return Response({"error": "Sabab majburiy"}, status=400)
        
        try:
            attempt = B2CTestAttempt.objects.get(pk=attempt_id, user_id=user_id)
        except B2CTestAttempt.DoesNotExist:
            return Response(status=404)
        
        if not force and not attempt.is_refund_eligible:
            return Response(
                {"error": "Attempt refund eligible emas. force=true bilan majburlash mumkin."},
                status=400,
            )
        
        # Force refund — eligible check'ni o'tkazib yuborish
        with transaction.atomic():
            attempt.status = B2CTestAttempt.Status.REFUNDED
            from django.utils import timezone
            attempt.refunded_at = timezone.now()
            attempt.save()
            
            tx = credit_service.grant_credits(
                user=attempt.user, amount=attempt.credits_spent,
                kind=CreditTransaction.Kind.REFUND,
                related_attempt=attempt,
                created_by=request.user,
                note=f"Admin refund: {reason}",
            )
        
        return Response({
            "status": "refunded",
            "credits_returned": attempt.credits_spent,
            "transaction_id": tx.id,
        })


class BulkCreditGrantView(APIView):
    """POST /api/v1/super/credits/bulk-grant/"""
    
    def post(self, request):
        if not _superadmin(request):
            return Response(status=403)
        
        # Filter ma'lumotlari
        filter_type = request.data.get("filter_type", "user_ids")
        amount = int(request.data.get("amount", 0))
        note = request.data.get("note", "").strip()
        
        if amount <= 0:
            return Response({"error": "Miqdor musbat bo'lishi kerak"}, status=400)
        if not note:
            return Response({"error": "Izoh majburiy"}, status=400)
        
        # User'larni filtr'lash
        qs = User.objects.filter(user_type="b2c_user")
        
        if filter_type == "user_ids":
            user_ids = request.data.get("user_ids", [])
            if not user_ids:
                return Response({"error": "user_ids bo'sh"}, status=400)
            qs = qs.filter(pk__in=user_ids)
        elif filter_type == "all":
            pass  # barchasi
        elif filter_type == "joined_last_n_days":
            from datetime import timedelta
            from django.utils import timezone
            days = int(request.data.get("days", 30))
            qs = qs.filter(date_joined__gte=timezone.now() - timedelta(days=days))
        elif filter_type == "zero_balance":
            qs = qs.filter(credit_balance__balance=0)
        else:
            return Response({"error": "Noma'lum filter_type"}, status=400)
        
        users = list(qs)
        if len(users) > 5000:
            return Response({"error": "Juda ko'p user (5000+). Aniqroq filter bering."}, status=400)
        
        # Tasdiqlash (preview)
        if request.data.get("preview", False):
            return Response({
                "preview": True,
                "users_count": len(users),
                "total_credits_granted": len(users) * amount,
            })
        
        # Bajarish
        granted_count = 0
        with transaction.atomic():
            for u in users:
                try:
                    credit_service.grant_credits(
                        user=u, amount=amount,
                        kind=CreditTransaction.Kind.ADMIN_GRANT,
                        created_by=request.user,
                        note=f"[BULK] {note}",
                    )
                    granted_count += 1
                except Exception:
                    continue
        
        return Response({
            "status": "completed",
            "granted_to": granted_count,
            "total_credits": granted_count * amount,
        })
```

### URLs

```python
path("b2c-users/", v.B2CUsersListView.as_view()),
path("b2c-users/<int:user_id>/", v.B2CUserDetailView.as_view()),
path("b2c-users/<int:user_id>/credit-grant/", v.CreditGrantView.as_view()),
path("b2c-users/<int:user_id>/refund-attempt/", v.CreditRefundView.as_view()),
path("credits/bulk-grant/", v.BulkCreditGrantView.as_view()),
```

### Frontend — `SuperAdminB2CUsersPage.tsx`

Ro'yxat sahifa — list view, filter, search. Har userning email, ism, balance, signup_source, joined ko'rinadi. Bossa detail sahifaga.

### Frontend — `SuperAdminB2CUserDetailPage.tsx`

```tsx
// Strukturasi:
// - Hero: foto/avatar, email, ism, joined, last_login
// - KPI: balance (katta), streak, events_count, target exam
// - 3 tab: Tranzaksiyalar / Test attempts / Profil
// - "Kredit qo'shish" tugmasi — modal (amount, note, grant/deduct radio)
// - Har attempt qatorida: status badge + "Refund" tugmasi (eligible bo'lsa odiy, bo'lmasa "Force refund" admin warning bilan)

// Asosiy kod (qisqartirilgan):

export function SuperAdminB2CUserDetailPage() {
  const { userId } = useParams();
  const [data, setData] = useState<any>(null);
  const [tab, setTab] = useState<"transactions" | "attempts" | "profile">("transactions");
  
  const load = () => fetch(`/api/v1/super/b2c-users/${userId}/`).then(r => r.json()).then(setData);
  useEffect(load, [userId]);
  
  const grantCredit = async () => {
    const action = confirm("Qo'shish (OK) yoki olib tashlash (Cancel)?") ? "grant" : "deduct";
    const amountStr = prompt(`Miqdor (${action === "grant" ? "qo'shish" : "olib tashlash"}):`);
    if (!amountStr) return;
    const amount = parseInt(amountStr);
    if (!amount || amount <= 0) return;
    const note = prompt("Izoh (majburiy):");
    if (!note?.trim()) return;
    
    const res = await fetch(`/api/v1/super/b2c-users/${userId}/credit-grant/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrf() },
      body: JSON.stringify({ amount, note, action }),
    });
    if (res.ok) { toast.success("Bajarildi"); load(); }
  };
  
  const refundAttempt = async (attempt: any, force: boolean) => {
    const reason = prompt(`Refund sababi (majburiy):`);
    if (!reason?.trim()) return;
    if (force && !confirm(`Bu attempt eligible emas. Force refund qilamizmi?`)) return;
    
    const res = await fetch(`/api/v1/super/b2c-users/${userId}/refund-attempt/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrf() },
      body: JSON.stringify({ attempt_id: attempt.id, reason, force }),
    });
    const result = await res.json();
    if (res.ok) {
      toast.success(`${result.credits_returned} credit qaytarildi`);
      load();
    } else {
      toast.error(result.error);
    }
  };
  
  // ... render (header, KPI, tabs, har tabning content'i)
}
```

UI tafsilotlari ko'p, lekin paterni clear: 3 tab orasida o'tish, har attempt qatorida "Refund (force)" tugmasi, kredit operatsiyalari uchun prompt'lar (yoki to'liq modal — agar vaqt bo'lsa).

---

## 4-bosqich: Promo kod tizimi

### `apps/b2c/models.py` ga qo'shish

```python
import string
import secrets


def generate_promo_code(length=8):
    """8 ta belgili katta harfli + raqamli kod yaratadi."""
    alphabet = string.ascii_uppercase + string.digits
    # Adashtiruvchi belgilarni olib tashlash: O/0, I/1, l
    alphabet = alphabet.replace("O", "").replace("0", "").replace("I", "").replace("1", "")
    return "".join(secrets.choice(alphabet) for _ in range(length))


class CreditPromoCode(models.Model):
    code = models.CharField(max_length=20, unique=True, db_index=True)
    description = models.CharField(max_length=200, blank=True)
    
    credits_amount = models.PositiveIntegerField()
    
    max_uses = models.PositiveIntegerField(
        null=True, blank=True,
        help_text="Bo'sh qoldirilsa cheksiz",
    )
    uses_count = models.PositiveIntegerField(default=0)
    
    valid_from = models.DateTimeField(null=True, blank=True)
    valid_until = models.DateTimeField(null=True, blank=True)
    
    is_active = models.BooleanField(default=True)
    
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True,
        related_name="created_promo_codes",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ["-created_at"]
    
    def __str__(self):
        return f"{self.code} ({self.credits_amount} credit)"
    
    @property
    def is_redeemable(self):
        """Hozirda foydalanish mumkinmi?"""
        from django.utils import timezone
        if not self.is_active:
            return False
        now = timezone.now()
        if self.valid_from and now < self.valid_from:
            return False
        if self.valid_until and now > self.valid_until:
            return False
        if self.max_uses is not None and self.uses_count >= self.max_uses:
            return False
        return True


class CreditPromoCodeRedemption(models.Model):
    """Promo kod ishlatilishi tarixi."""
    promo_code = models.ForeignKey(CreditPromoCode, on_delete=models.CASCADE, related_name="redemptions")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="promo_redemptions")
    credit_transaction = models.ForeignKey("CreditTransaction", on_delete=models.SET_NULL, null=True, blank=True)
    redeemed_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = [("promo_code", "user")]  # bitta user bitta marta
        ordering = ["-redeemed_at"]
```

Migration ishlating.

### Promo kod service — `apps/b2c/services/promo_codes.py`

```python
from django.db import transaction
from django.utils import timezone
from ..models import CreditPromoCode, CreditPromoCodeRedemption, CreditTransaction
from . import credits as credit_service


class PromoCodeError(Exception):
    pass


@transaction.atomic
def redeem_promo_code(user, code: str):
    code = code.strip().upper()
    
    try:
        promo = CreditPromoCode.objects.select_for_update().get(code=code)
    except CreditPromoCode.DoesNotExist:
        raise PromoCodeError("Bunday promo kod topilmadi")
    
    if not promo.is_redeemable:
        if not promo.is_active:
            raise PromoCodeError("Promo kod faol emas")
        if promo.valid_until and timezone.now() > promo.valid_until:
            raise PromoCodeError("Promo kod muddati o'tgan")
        if promo.max_uses and promo.uses_count >= promo.max_uses:
            raise PromoCodeError("Promo kod limiti tugagan")
        raise PromoCodeError("Promo kod hozirda ishlatib bo'lmaydi")
    
    # Allaqachon ishlatganmi?
    if CreditPromoCodeRedemption.objects.filter(promo_code=promo, user=user).exists():
        raise PromoCodeError("Siz bu kodni allaqachon ishlatgansiz")
    
    # Kredit berish
    tx = credit_service.grant_credits(
        user=user, amount=promo.credits_amount,
        kind=CreditTransaction.Kind.ADMIN_GRANT,  # yoki yangi PROMO_CODE turi yaratish mumkin
        note=f"Promo kod: {promo.code} ({promo.description})",
    )
    
    # Redemption yozish
    CreditPromoCodeRedemption.objects.create(
        promo_code=promo, user=user, credit_transaction=tx,
    )
    
    # Counter
    promo.uses_count += 1
    promo.save(update_fields=["uses_count"])
    
    return {"credits_granted": promo.credits_amount, "new_balance": user.credit_balance.balance}
```

### Promo kod views — `apps/super_admin/views_promo_codes.py`

```python
class PromoCodesListView(APIView):
    def get(self, request):
        if not _superadmin(request):
            return Response(status=403)
        
        qs = CreditPromoCode.objects.all().select_related("created_by").order_by("-created_at")[:200]
        return Response({
            "codes": [
                {
                    "id": p.id, "code": p.code, "description": p.description,
                    "credits_amount": p.credits_amount,
                    "max_uses": p.max_uses, "uses_count": p.uses_count,
                    "valid_from": p.valid_from, "valid_until": p.valid_until,
                    "is_active": p.is_active, "is_redeemable": p.is_redeemable,
                    "created_at": p.created_at,
                    "created_by": p.created_by.email if p.created_by else None,
                }
                for p in qs
            ],
        })


class PromoCodeCreateView(APIView):
    def post(self, request):
        if not _superadmin(request):
            return Response(status=403)
        
        from apps.b2c.models import generate_promo_code
        
        code = request.data.get("code", "").strip().upper() or generate_promo_code()
        credits_amount = int(request.data.get("credits_amount", 0))
        
        if credits_amount <= 0:
            return Response({"error": "credits_amount musbat bo'lishi kerak"}, status=400)
        
        if CreditPromoCode.objects.filter(code=code).exists():
            return Response({"error": f"Kod {code} allaqachon mavjud"}, status=400)
        
        promo = CreditPromoCode.objects.create(
            code=code,
            description=request.data.get("description", ""),
            credits_amount=credits_amount,
            max_uses=request.data.get("max_uses") or None,
            valid_from=request.data.get("valid_from") or None,
            valid_until=request.data.get("valid_until") or None,
            is_active=request.data.get("is_active", True),
            created_by=request.user,
        )
        return Response({"id": promo.id, "code": promo.code}, status=201)


class PromoCodeUpdateView(APIView):
    def patch(self, request, pk):
        if not _superadmin(request):
            return Response(status=403)
        
        promo = get_object_or_404(CreditPromoCode, pk=pk)
        
        # Kod, miqdor o'zgartirilmaydi (faqat o'chirib, qaytadan yaratish)
        for field in ["description", "max_uses", "valid_from", "valid_until", "is_active"]:
            if field in request.data:
                setattr(promo, field, request.data[field] or None if field != "is_active" else request.data[field])
        
        promo.save()
        return Response({"status": "updated"})


class PromoCodeDeactivateView(APIView):
    def post(self, request, pk):
        if not _superadmin(request):
            return Response(status=403)
        
        promo = get_object_or_404(CreditPromoCode, pk=pk)
        promo.is_active = False
        promo.save(update_fields=["is_active"])
        return Response({"status": "deactivated"})


# B2C user uchun — kodni kiritish (kreditlar sahifasida)
class B2CPromoCodeRedeemView(APIView):
    """POST /api/v1/b2c/promo-codes/redeem/"""
    
    def post(self, request):
        if not request.user.is_authenticated or not request.user.is_b2c:
            return Response(status=403)
        
        from apps.b2c.services.promo_codes import redeem_promo_code, PromoCodeError
        
        try:
            result = redeem_promo_code(request.user, request.data.get("code", ""))
            return Response(result)
        except PromoCodeError as e:
            return Response({"error": str(e)}, status=400)
```

### Frontend — `SuperAdminPromoCodesPage.tsx`

CRUD UI:
- Ro'yxat (kod, miqdor, foydalanish/limit, holat, yaratuvchi)
- "Yangi kod yaratish" tugmasi → modal yoki sahifa
- Har koddan: tahrirlash, deaktiv qilish, foydalanuvchilar ro'yxati (drill-down)
- Yangi kod yaratish: code (bo'sh qoldirilsa avtomatik), credits, description, max_uses (optional), valid_from/until (optional)

### B2C uchun — kreditlar sahifasiga promo kod inputi

`/b2c/credits/` sahifasiga qo'shish:

```tsx
<div className="bg-white border border-gray-200 rounded-2xl p-5 mb-5">
  <h2 className="font-bold mb-2">Promo kod</h2>
  <p className="text-sm text-gray-500 mb-3">Agar promo kodingiz bo'lsa, kiriting va bepul kredit oling.</p>
  <div className="flex gap-2">
    <input
      type="text" placeholder="PROMO123"
      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm uppercase"
      value={promoInput}
      onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
    />
    <button
      onClick={redeemPromo}
      disabled={!promoInput.trim()}
      className="bg-rose-600 hover:bg-rose-700 disabled:opacity-30 text-white text-sm font-medium px-5 py-2 rounded-lg"
    >
      Qabul qilish
    </button>
  </div>
</div>
```

`redeemPromo` funksiya `/api/v1/b2c/promo-codes/redeem/` ga POST yuboradi, muvaffaqiyatlisa toast bilan kredit miqdorini ko'rsatadi va balance'ni yangilaydi.

---

## 5-bosqich: Kreditlar sahifasi (super-admin)

`/super/credits/` — 3 ta tab:

1. **Tranzaksiyalar** — barcha tranzaksiyalar (filter: kind, sana, user)
2. **Bulk grant** — wizard:
   - Filter: barchasi / 0 balance / oxirgi N kun ichida ro'yxatdan o'tganlar / aniq user_ids (CSV paste)
   - Miqdor + izoh
   - **Preview** tugmasi — nechta user, jami credit
   - **Tasdiqlash va bajarish** tugmasi
3. **Tarix** — bulk grant'lar tarixi (kim, qachon, nechta user, qancha credit)

Bu sahifa ETAP 17 da `SuperAdminCreditsPage` deb yozilgan edi — agar mavjud bo'lsa, kengaytiring. Yo'q bo'lsa, yangidan yarating.

---

## 6-bosqich: Super-admin dashboard yangilash

`/super/dashboard/` sahifasiga 4 ta yangi KPI:

```tsx
<div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
  <KPI label="Markazlar" value={stats.centers_total} sub={`${stats.centers_active} faol`} />
  <KPI label="B2C foydalanuvchilar" value={stats.b2c_users_total} sub={`+${stats.b2c_new_30d} oxirgi 30 kun`} />
  <KPI label="Aylanmadagi kredit" value={stats.total_credits_in_circulation} accent="amber" />
  <KPI label="Bugungi PDF import" value={stats.pdf_imports_today} sub={`${stats.ai_tokens_today.toLocaleString()} token`} />
</div>
```

Backend — `apps/super_admin/views_dashboard.py`:

```python
class DashboardStatsView(APIView):
    def get(self, request):
        if not _superadmin(request):
            return Response(status=403)
        
        from datetime import date, timedelta
        from django.db.models import Sum, Count
        from apps.centers.models import Center
        from apps.b2c.models import CreditBalance, CreditTransaction
        from apps.tests.models import PDFImportLog
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        today = date.today()
        month_ago = today - timedelta(days=30)
        
        return Response({
            "centers_total": Center.objects.filter(deleted_at__isnull=True).count(),
            "centers_active": Center.objects.filter(is_suspended=False, deleted_at__isnull=True).count(),
            "b2c_users_total": User.objects.filter(user_type="b2c_user").count(),
            "b2c_new_30d": User.objects.filter(user_type="b2c_user", date_joined__date__gte=month_ago).count(),
            "total_credits_in_circulation": CreditBalance.objects.aggregate(s=Sum("balance"))["s"] or 0,
            "pdf_imports_today": PDFImportLog.objects.filter(created_at__date=today).count(),
            "ai_tokens_today": PDFImportLog.objects.filter(created_at__date=today).aggregate(s=Sum("tokens_used"))["s"] or 0,
        })
```

URL: `/api/v1/super/dashboard-stats/`

---

## 7-bosqich: Manual test checklist

### Sidebar
- [ ] Super-admin'da kirsangiz sidebar 5 ta kategoriyaga guruhlangan
- [ ] Har kategoriya label'i kichik uppercase
- [ ] Aktiv sahifa rose rangda
- [ ] Hozirgi pages (B2C Catalog, AI Providers) saqlangan, to'g'ri kategoriyada

### Markazlar
- [ ] `/super/centers` ochiladi
- [ ] Summary KPI: Jami / Faol / To'xtatilgan
- [ ] Qidiruv ishlaydi
- [ ] Status filter ishlaydi
- [ ] Har markaz qatorida: nom, admin, guruh/talaba/o'qituvchi count, status badge
- [ ] Markaz qatori bossa drill-down ochiladi
- [ ] Drill-down'da: header (nom, status, admin info), KPI (5 ta), trend chart, guruhlar
- [ ] Faol markaz "To'xtatish" tugmasi — sabab so'raydi, muvaffaqiyatli
- [ ] To'xtatilgan markaz "Faol qilish" tugmasi
- [ ] "Admin qayta tayinlash" — email so'raydi, yangi user'ga admin role beradi
- [ ] "Arxivga" — markaz nomini terish bilan tasdiqlash, keyin soft-delete
- [ ] O'chirilgan markaz ro'yxatda "O'chirilgan" badge bilan ko'rinadi
- [ ] Faolligi nol bo'lgan markazda: "Hali sessiya o'tkazmagan" xabari

### B2C foydalanuvchilar
- [ ] `/super/b2c-users` ochiladi, ro'yxat ko'rinadi
- [ ] Qidiruv (email, ism, telefon)
- [ ] Signup source filter (email/google)
- [ ] Balance range filter
- [ ] User qatori bossa detail
- [ ] Detail sahifa: header, KPI (balance, streak, events, target), 3 tab
- [ ] Tranzaksiyalar tab: tarix to'liq, kind_display, amount rangda (yashil/qizil)
- [ ] Test attempts tab: status badge, score, "Refund" tugmasi eligible'larga
- [ ] Force refund — eligible bo'lmagan attempt'da admin override, warning bilan
- [ ] Profil tab: barcha B2CProfile maydonlari
- [ ] "Kredit qo'shish" tugmasi — modal: action (grant/deduct), amount, note majburiy
- [ ] Grant muvaffaqiyatli — yangi balance ko'rinadi, tarixda yangi yozuv

### Kreditlar
- [ ] `/super/credits` 3 tab
- [ ] Tranzaksiyalar tab: filter (kind, sana, user), 100+ qatorli ro'yxat
- [ ] Bulk grant tab: filter wizard (barchasi/last_N/zero_balance/user_ids)
- [ ] Preview bossa user soni va jami credit ko'rinadi
- [ ] Tasdiqlash bilan bajarish — bir necha sekund, natija toast
- [ ] Tarix tab: oldingi bulk grant'lar

### Promo kodlar
- [ ] `/super/promo-codes` ochiladi
- [ ] Ro'yxat: kod, miqdor, foydalanish/limit, valid until, holat
- [ ] "Yangi yaratish" — code (bo'sh qoldirilsa avtomatik), credits, description, max_uses (optional), valid_until (optional)
- [ ] Yaratilgan kod ro'yxatga qo'shiladi
- [ ] Tahrirlash — description, limit, holat o'zgartirish (kod va miqdor o'zgarmas)
- [ ] Deaktiv qilish
- [ ] B2C user `/b2c/credits/` da promo kod input, qabul qilsa kredit oladi
- [ ] Bir kod ikki marta ishlatib bo'lmaydi (xato xabar)
- [ ] Muddati o'tgan kod xato xabari
- [ ] Limit oshganda xato xabari

### Dashboard
- [ ] `/super/dashboard` 4 yangi KPI ko'rinadi
- [ ] Markazlar / B2C users / Aylanmadagi kredit / Bugungi PDF import

### Permissions
- [ ] B2B admin yoki teacher super-admin sahifalariga kirsa — 403
- [ ] B2C user shu sahifalarga kirsa — 403

---

## 8-bosqich: Git commit va push (MAJBURIY)

```bash
git add .
git commit -m "ETAP 19: Super admin panel — centers admin, B2C users admin, credits (grant/deduct/refund/bulk), promo codes, sidebar restructure"
git push origin <branch-nomi>
```

---

## Yakuniy checklist

### Backend
- [ ] Center'da `is_suspended`, `suspended_at`, `suspended_reason`, `suspended_by`, `deleted_at` field'lari
- [ ] `CreditPromoCode`, `CreditPromoCodeRedemption` modellari + migration
- [ ] `services/centers.py` — list, detail, suspend, activate, soft-delete
- [ ] `services/b2c_users.py` — list, detail
- [ ] `services/promo_codes.py` — redeem logic
- [ ] API endpoints: centers (list, detail, suspend, activate, update, reassign, delete)
- [ ] API endpoints: b2c-users (list, detail), credit-grant, refund-attempt, bulk-grant
- [ ] API endpoints: promo-codes (CRUD), redeem
- [ ] Dashboard stats endpoint

### Frontend
- [ ] `SuperAdminLayout` — sidebar guruhlangan
- [ ] `SuperAdminCentersPage` + `SuperAdminCenterDetailPage` (Chart.js trend bilan)
- [ ] `SuperAdminB2CUsersPage` + `SuperAdminB2CUserDetailPage` (3 tab, kredit operatsiyalari)
- [ ] `SuperAdminCreditsPage` 3 tab bilan (transactions, bulk grant, history)
- [ ] `SuperAdminPromoCodesPage` (list + create modal)
- [ ] Dashboard yangi KPI cards
- [ ] B2C `/b2c/credits/` — promo kod input

### Other
- [ ] Migration fayllar git'da
- [ ] Manual test checklist tugallangan
- [ ] `git push origin <branch>` muvaffaqiyatli

---

## Eslatmalar va kelajak

Bu ETAP'dan keyin super-admin paneli "to'liq" boshqaruv markazi bo'ladi. Kelajakda qo'shilishi mumkin:

- **B2B Statistika** sahifasi (markazlar bo'yicha aggregate analytics)
- **Audio fayllar** boshqaruvi (agar Listening test audio'lari uchun kerak bo'lsa)
- **Bot boshqaruvi** (mavjud `order_qulaymakon_bot` kabi)
- **Sistemali sozlamalar** (ish vaqtlari, default qiymatlar va h.k.)
- **Export/Import** — markazlar va userlarni Excel'ga eksport qilish
- **Audit log dashboard** — barcha admin harakatlarining markazlashgan logi

Bu kelajak ETAP'lar uchun foundation hozir tayyor.
