# ETAP 20: B2B Attendance System Redesign (Davomat)

## Kontekst

Hozirgi `/<slug>/admin/attendance` sahifasi **noto'g'ri primary model**: sessiyalar ro'yxati ko'rinmoqda, davomat emas. Stats sessiya soni (0 sessiya = 0 davomat). Asosiy mahsulot vazifasi — talaba davomatini ko'rsatish va boshqarish — sahifada amalga oshmaydi.

**Bu ETAP-ning vazifasi:** "Davomat" sahifasini **3 tab li** to'liq attendance management tizimiga aylantirish:

1. **Bugungi davomat** — o'qituvchi uchun: bir sessiyaga tezda davomat belgilash (Classter-style)
2. **Oylik jadval** — center admin uchun: oylik grid (talabalar × sessiyalar), Division Register-style
3. **Tahlil / Hisobot** — Chart.js bilan trendlar, xavfli talabalar, eksport

Plyus **talaba detail sahifa** (drill-down), **CSS print stylesheet**, va **Excel export**.

**Bu ETAP B2C ishlardan mustaqil** (ETAP 14-17 B2C foundation/credit). Alohida branch'da ishlang, masalan `feat/etap-20-attendance`.

## Vizual mo'ljal

**Konkurent referenslar:**
- **Division Register** — oylik grid, talabalar qator, kunlar ustun, ✓/✗ hujayralarda
- **Classter Subjects Absences** — daily view, har talabaga photo + status toggle + notes

**ILDIZ uchun gibrid yondashuv:** ikkala formatni 3 tab ichida birlashtirish. Rol bo'yicha default tab:
- O'qituvchi kirsa → Tab 1 (Bugungi davomat) ochiladi
- Center admin kirsa → Tab 2 (Oylik jadval) ochiladi

## Davomat statuslari (4 ta)

| Status | Belgi | Rang | Eslatma |
|---|---|---|---|
| Keldi (Present) | ✓ | yashil | ixtiyoriy |
| Kech qoldi (Late) | ⏱ | sariq | ixtiyoriy |
| Kelmadi (Absent) | ✗ | qizil | ixtiyoriy |
| Sababli (Excused) | E | kulrang | **majburiy** (kasal, ota-ona ruxsati va h.k.) |

## Loyihaning hozirgi holati

- Django 5.x backend + React (Vite) frontend
- Multi-tenant: center slug URL'larda (`/<slug>/admin/...`)
- Mavjud apps (haqiqiy nomlarni saqlang): `users`, `tests`, `groups`, `sessions`, `attendance` (yoki ulardan biri)
- Frontend: `/<slug>/admin/attendance` route'i ulangan, `AttendancePage` mavjud (bosh skeleton)
- Mavjud `Session` modeli — ehtimol `apps/sessions/` yoki `apps/attendance/` ichida bor (group + date + time + teacher)

## ETAP yakunidagi natija

1. `Session` modeli mavjudligi tekshirilgan/yangilangan
2. `AttendanceRecord` modeli yaratilgan
3. Sessiya yaratilganda guruhdagi har talabaga avtomatik `AttendanceRecord` (status=null) yaratiladi
4. 3 ta tab ishlaydi: Bugungi davomat / Oylik jadval / Tahlil
5. Talaba detail sahifa ishlaydi (`/<slug>/admin/attendance/student/<id>`)
6. Print CSS — Tab 2 sahifasini chiroyli A4 landscape qog'ozda chop etish
7. Excel eksport — Tab 2 va Tahlil sahifalaridan
8. O'qituvchi faqat o'z guruhlarini ko'radi; center admin — barchasini
9. Git push muvaffaqiyatli

---

## 1-bosqich: Modellar

### Mavjud Session modelini tekshiring

`apps/sessions/models.py` yoki `apps/attendance/models.py` ichida `Session` (yoki `LessonSession`) modeli bormi? Quyidagi minimal field'lar kerak:

```python
class Session(SoftDeleteModel):  # haqiqiy nom va base'ni saqlang
    group = models.ForeignKey("groups.StudentGroup", on_delete=models.CASCADE, related_name="sessions")
    date = models.DateField(db_index=True)
    start_time = models.TimeField()
    end_time = models.TimeField(null=True, blank=True)
    teacher = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True,
        related_name="taught_sessions",
    )
    
    class Status(models.TextChoices):
        PLANNED = "planned", "Rejalashtirilgan"
        IN_PROGRESS = "in_progress", "Davom etmoqda"
        COMPLETED = "completed", "Yakunlangan"
        CANCELLED = "cancelled", "Bekor qilingan"
    
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PLANNED)
    notes = models.TextField(blank=True)
    
    class Meta:
        indexes = [models.Index(fields=["group", "date"])]
        ordering = ["-date", "-start_time"]
```

Agar field'lar yetishmasa, qo'shing. Agar Session yo'q bo'lsa, yarating.

### Yangi `AttendanceRecord` modeli

```python
class AttendanceRecord(models.Model):
    """
    Bitta talaba bitta sessiyada qanday holatda bo'lgan.
    Sessiya yaratilganda har talabaga avtomatik yaratiladi (status=null).
    """
    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name="attendance_records")
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="attendance_records",
        limit_choices_to={"user_type": "b2b_student"},
    )
    
    class Status(models.TextChoices):
        PRESENT = "present", "Keldi"
        LATE = "late", "Kech qoldi"
        ABSENT = "absent", "Kelmadi"
        EXCUSED = "excused", "Sababli"
    
    status = models.CharField(max_length=20, choices=Status.choices, null=True, blank=True, db_index=True)
    note = models.TextField(blank=True, help_text="Sababli kelmagan uchun majburiy")
    
    marked_at = models.DateTimeField(null=True, blank=True)
    marked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="marked_attendance",
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = [("session", "student")]
        indexes = [
            models.Index(fields=["student", "session"]),
            models.Index(fields=["session", "status"]),
        ]
    
    def __str__(self):
        return f"{self.student.email} — {self.session.date} — {self.status or 'unmarked'}"
    
    def clean(self):
        from django.core.exceptions import ValidationError
        if self.status == self.Status.EXCUSED and not self.note.strip():
            raise ValidationError({"note": "Sababli kelmagan holat uchun izoh majburiy."})
```

### Sessiya yaratilganda avtomatik `AttendanceRecord`'lar

Signal yoki Session.save() override:

```python
# apps/attendance/signals.py
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Session, AttendanceRecord


@receiver(post_save, sender=Session)
def create_attendance_records(sender, instance, created, **kwargs):
    if created:
        students = instance.group.students.all()  # haqiqiy reverse rel'ga moslang
        records = [
            AttendanceRecord(session=instance, student=s) for s in students
        ]
        AttendanceRecord.objects.bulk_create(records, ignore_conflicts=True)
```

`apps.py` ichida `ready()` da signalni yuklang.

Migration:
```bash
python manage.py makemigrations attendance
python manage.py migrate
```

**Cursor Agent eslatma:** Loyihada `StudentGroup.students` qanday qilib munosabatda — ManyToManyField yoki orqali yana boshqa model bo'lsa, signalni shunga moslang. Soft-delete bo'lgan talabalar uchun `students.filter(deleted_at__isnull=True)` ishlatishi mumkin.

---

## 2-bosqich: Services (business logic)

### `apps/attendance/services/attendance.py`

```python
from datetime import date, timedelta
from collections import defaultdict
from decimal import Decimal
from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone
from ..models import Session, AttendanceRecord


def mark_attendance(session, student, status, *, note="", marked_by=None):
    """Bitta talabaning davomatini belgilash."""
    record, _ = AttendanceRecord.objects.get_or_create(
        session=session, student=student
    )
    record.status = status
    record.note = note
    record.marked_at = timezone.now()
    record.marked_by = marked_by
    record.full_clean()  # excused uchun note majburiyligini tekshiradi
    record.save()
    return record


@transaction.atomic
def bulk_mark_attendance(session, records, marked_by):
    """
    Tab 1 "Saqlash" uchun — sessiyadagi barcha talabalarni bir martada saqlash.
    
    records: list of {"student_id": int, "status": str, "note": str}
    """
    saved = []
    for r in records:
        record = AttendanceRecord.objects.select_for_update().get(
            session=session, student_id=r["student_id"]
        )
        record.status = r["status"]
        record.note = r.get("note", "")
        record.marked_at = timezone.now()
        record.marked_by = marked_by
        record.full_clean()
        record.save()
        saved.append(record)
    
    # Sessiya statusini "completed" ga o'tkazish (agar barcha markirovka qilingan bo'lsa)
    unmarked = session.attendance_records.filter(status__isnull=True).count()
    if unmarked == 0 and session.status == Session.Status.PLANNED:
        session.status = Session.Status.COMPLETED
        session.save(update_fields=["status"])
    
    return saved


def get_monthly_grid(group, year, month):
    """
    Tab 2 uchun: oylik jadval ma'lumotlari.
    Return: {
        "students": [list of students],
        "sessions": [list of sessions in month],
        "cells": {(student_id, session_id): {status, note}},
        "summary": {student_id: {present, late, absent, excused, total, percent}},
        "group_stats": {avg_percent, today_percent, at_risk_count},
    }
    """
    from calendar import monthrange
    
    first = date(year, month, 1)
    last = date(year, month, monthrange(year, month)[1])
    
    sessions = list(
        Session.objects.filter(group=group, date__gte=first, date__lte=last)
        .exclude(status=Session.Status.CANCELLED)
        .order_by("date", "start_time")
    )
    students = list(group.students.all())  # haqiqiy rel
    
    records = AttendanceRecord.objects.filter(
        session__in=sessions, student__in=students
    ).select_related("student", "session")
    
    cells = {(r.student_id, r.session_id): {"status": r.status, "note": r.note} for r in records}
    
    # Summary per student
    summary = {}
    for s in students:
        present = late = absent = excused = unmarked = 0
        for sess in sessions:
            cell = cells.get((s.id, sess.id))
            if not cell or not cell["status"]:
                unmarked += 1
                continue
            if cell["status"] == "present": present += 1
            elif cell["status"] == "late": late += 1
            elif cell["status"] == "absent": absent += 1
            elif cell["status"] == "excused": excused += 1
        
        marked_total = present + late + absent + excused
        attended = present + late  # kech qolgan ham keldi sanaladi
        percent = round((attended / marked_total) * 100, 1) if marked_total else None
        
        summary[s.id] = {
            "present": present, "late": late, "absent": absent,
            "excused": excused, "unmarked": unmarked,
            "total_sessions": len(sessions),
            "marked": marked_total,
            "percent": percent,
        }
    
    # Group-wide stats
    percents = [v["percent"] for v in summary.values() if v["percent"] is not None]
    avg_percent = round(sum(percents) / len(percents), 1) if percents else None
    at_risk = sum(1 for p in percents if p < 70)
    
    today_sessions = [s for s in sessions if s.date == date.today()]
    today_percent = None
    if today_sessions:
        today_records = [r for r in records if r.session_id in {s.id for s in today_sessions}]
        marked = [r for r in today_records if r.status]
        attended = [r for r in marked if r.status in ("present", "late")]
        today_percent = round(len(attended) / len(marked) * 100, 1) if marked else None
    
    return {
        "students": students,
        "sessions": sessions,
        "cells": cells,
        "summary": summary,
        "group_stats": {
            "avg_percent": avg_percent,
            "today_percent": today_percent,
            "at_risk_count": at_risk,
        },
    }


def get_today_session(group, *, requested_date=None):
    """Tab 1 uchun: belgilangan sananing sessiyasini topish (default = bugun)."""
    target_date = requested_date or date.today()
    return Session.objects.filter(group=group, date=target_date).exclude(
        status=Session.Status.CANCELLED
    ).first()


def get_at_risk_students(center, *, threshold=70, months_back=3):
    """Tahlil uchun: davomati past talabalar."""
    from django.contrib.auth import get_user_model
    User = get_user_model()
    
    since = date.today() - timedelta(days=months_back * 30)
    students = User.objects.filter(
        user_type="b2b_student",
        # markazga tegishli — haqiqiy rel'ga moslang
    )
    
    result = []
    for s in students:
        records = AttendanceRecord.objects.filter(
            student=s, session__date__gte=since, status__isnull=False
        )
        marked = records.count()
        if marked < 5:  # juda kam ma'lumot
            continue
        attended = records.filter(status__in=["present", "late"]).count()
        percent = round((attended / marked) * 100, 1)
        if percent < threshold:
            result.append({
                "student": s, "percent": percent,
                "marked": marked, "attended": attended,
            })
    
    return sorted(result, key=lambda x: x["percent"])


def get_attendance_trend(group, *, months_back=6):
    """Tahlil uchun: oxirgi N oydagi guruh davomat trend."""
    today = date.today()
    start = today - timedelta(days=months_back * 30)
    
    sessions = Session.objects.filter(
        group=group, date__gte=start
    ).exclude(status=Session.Status.CANCELLED)
    
    by_month = defaultdict(lambda: {"marked": 0, "attended": 0})
    for sess in sessions:
        key = sess.date.strftime("%Y-%m")
        records = sess.attendance_records.filter(status__isnull=False)
        by_month[key]["marked"] += records.count()
        by_month[key]["attended"] += records.filter(status__in=["present", "late"]).count()
    
    trend = []
    for month_key in sorted(by_month.keys()):
        m = by_month[month_key]
        percent = round((m["attended"] / m["marked"]) * 100, 1) if m["marked"] else None
        trend.append({"month": month_key, "percent": percent})
    
    return trend


def get_student_history(student, *, date_from=None, date_to=None):
    """Talaba detail sahifa uchun: butun davomat tarixi."""
    qs = AttendanceRecord.objects.filter(student=student).select_related("session__group")
    if date_from:
        qs = qs.filter(session__date__gte=date_from)
    if date_to:
        qs = qs.filter(session__date__lte=date_to)
    
    records = list(qs.order_by("-session__date"))
    
    marked = [r for r in records if r.status]
    attended = [r for r in marked if r.status in ("present", "late")]
    overall = round(len(attended) / len(marked) * 100, 1) if marked else None
    
    by_status = {
        "present": sum(1 for r in marked if r.status == "present"),
        "late": sum(1 for r in marked if r.status == "late"),
        "absent": sum(1 for r in marked if r.status == "absent"),
        "excused": sum(1 for r in marked if r.status == "excused"),
    }
    
    return {
        "records": records,
        "overall_percent": overall,
        "total_marked": len(marked),
        "by_status": by_status,
    }
```

---

## 3-bosqich: Permissions

### `apps/attendance/permissions.py`

```python
from rest_framework.permissions import BasePermission


class IsCenterAdminOrTeacher(BasePermission):
    """Center admin (markazning hammasini) yoki teacher (faqat o'z guruhlarini)."""
    
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        return request.user.user_type in ("b2b_admin", "b2b_teacher")


class IsCenterAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.user_type == "b2b_admin"


def get_accessible_groups(user):
    """Foydalanuvchining ko'ra oladigan guruhlar."""
    from apps.groups.models import StudentGroup  # haqiqiy import
    
    if user.user_type == "b2b_admin":
        # Center admin — markazga tegishli barchasi
        return StudentGroup.objects.filter(center=user.center)
    if user.user_type == "b2b_teacher":
        # Teacher — faqat o'zining guruhlari
        return StudentGroup.objects.filter(teacher=user)  # yoki teachers__in=[user]
    return StudentGroup.objects.none()
```

---

## 4-bosqich: API endpoints (DRF)

### `apps/attendance/views.py`

```python
from datetime import date as date_cls
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status as drf_status
from rest_framework.permissions import IsAuthenticated

from .models import Session, AttendanceRecord
from .services import attendance as svc
from .permissions import IsCenterAdminOrTeacher, get_accessible_groups
from .serializers import (
    SessionSerializer, AttendanceRecordSerializer,
    MonthlyGridSerializer, StudentHistorySerializer,
)


class TodaySessionView(APIView):
    """Tab 1 — bugungi (yoki tanlangan) sessiya + barcha talabalari."""
    permission_classes = [IsCenterAdminOrTeacher]
    
    def get(self, request):
        group_id = request.query_params.get("group")
        target_date = request.query_params.get("date") or date_cls.today().isoformat()
        
        accessible = get_accessible_groups(request.user)
        try:
            group = accessible.get(pk=group_id)
        except Exception:
            return Response({"error": "group_not_accessible"}, status=403)
        
        session = svc.get_today_session(group, requested_date=date_cls.fromisoformat(target_date))
        if not session:
            return Response({
                "session": None,
                "message": f"{target_date} sanasida ushbu guruh uchun sessiya topilmadi"
            })
        
        records = session.attendance_records.select_related("student").order_by("student__first_name")
        
        return Response({
            "session": {
                "id": session.id,
                "date": session.date,
                "start_time": session.start_time,
                "end_time": session.end_time,
                "teacher": session.teacher.get_full_name() if session.teacher else None,
                "status": session.status,
                "notes": session.notes,
            },
            "records": [
                {
                    "id": r.id,
                    "student_id": r.student.id,
                    "student_name": r.student.get_full_name(),
                    "student_email": r.student.email,
                    "photo_url": getattr(r.student, "photo_url", None),
                    "status": r.status,
                    "note": r.note,
                }
                for r in records
            ],
        })


class BulkMarkView(APIView):
    """Tab 1 — Saqlash."""
    permission_classes = [IsCenterAdminOrTeacher]
    
    def post(self, request, session_id):
        try:
            session = Session.objects.get(pk=session_id)
        except Session.DoesNotExist:
            return Response(status=404)
        
        # Ruxsat tekshiruvi
        if session.group not in get_accessible_groups(request.user):
            return Response(status=403)
        
        records = request.data.get("records", [])
        if not isinstance(records, list):
            return Response({"error": "records must be a list"}, status=400)
        
        try:
            svc.bulk_mark_attendance(session, records, marked_by=request.user)
        except Exception as e:
            return Response({"error": str(e)}, status=400)
        
        return Response({"status": "saved", "count": len(records)})


class MonthlyGridView(APIView):
    """Tab 2 — oylik jadval."""
    permission_classes = [IsCenterAdminOrTeacher]
    
    def get(self, request):
        group_id = request.query_params.get("group")
        year = int(request.query_params.get("year", date_cls.today().year))
        month = int(request.query_params.get("month", date_cls.today().month))
        
        accessible = get_accessible_groups(request.user)
        try:
            group = accessible.get(pk=group_id)
        except Exception:
            return Response({"error": "group_not_accessible"}, status=403)
        
        data = svc.get_monthly_grid(group, year, month)
        
        return Response({
            "group": {"id": group.id, "name": group.name},
            "year": year, "month": month,
            "students": [
                {"id": s.id, "name": s.get_full_name(), "email": s.email,
                 "photo_url": getattr(s, "photo_url", None)}
                for s in data["students"]
            ],
            "sessions": [
                {"id": s.id, "date": s.date, "weekday": s.date.strftime("%a")}
                for s in data["sessions"]
            ],
            "cells": [
                {"student_id": k[0], "session_id": k[1], **v}
                for k, v in data["cells"].items()
            ],
            "summary": data["summary"],
            "group_stats": data["group_stats"],
        })


class CellUpdateView(APIView):
    """Tab 2 — bitta hujayrani o'zgartirish."""
    permission_classes = [IsCenterAdminOrTeacher]
    
    def patch(self, request, record_id):
        try:
            record = AttendanceRecord.objects.select_related("session__group").get(pk=record_id)
        except AttendanceRecord.DoesNotExist:
            return Response(status=404)
        
        if record.session.group not in get_accessible_groups(request.user):
            return Response(status=403)
        
        new_status = request.data.get("status")
        new_note = request.data.get("note", "")
        
        try:
            svc.mark_attendance(
                session=record.session, student=record.student,
                status=new_status, note=new_note, marked_by=request.user,
            )
        except Exception as e:
            return Response({"error": str(e)}, status=400)
        
        return Response({"status": "updated"})


class AnalyticsView(APIView):
    """Tab 3 — analitika."""
    permission_classes = [IsCenterAdminOrTeacher]
    
    def get(self, request):
        group_id = request.query_params.get("group")
        accessible = get_accessible_groups(request.user)
        
        if group_id:
            try:
                group = accessible.get(pk=group_id)
            except Exception:
                return Response({"error": "group_not_accessible"}, status=403)
            
            return Response({
                "trend": svc.get_attendance_trend(group, months_back=6),
                "at_risk": [
                    {"student_id": item["student"].id,
                     "student_name": item["student"].get_full_name(),
                     "percent": item["percent"]}
                    for item in svc.get_at_risk_students(
                        center=request.user.center, threshold=70
                    )
                    if hasattr(item["student"], "studentgroup_set") and group in item["student"].studentgroup_set.all()
                ],
            })
        
        # Markazning umumiy tahlili
        at_risk = svc.get_at_risk_students(center=request.user.center, threshold=70)
        return Response({
            "at_risk": [
                {"student_id": item["student"].id,
                 "student_name": item["student"].get_full_name(),
                 "percent": item["percent"]}
                for item in at_risk[:20]
            ],
        })


class StudentHistoryView(APIView):
    """Talaba detail sahifa."""
    permission_classes = [IsCenterAdminOrTeacher]
    
    def get(self, request, student_id):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        try:
            student = User.objects.get(pk=student_id, user_type="b2b_student")
        except User.DoesNotExist:
            return Response(status=404)
        
        # Tekshirish: student request user'ning markaziga tegishlimi
        if student.center != request.user.center:  # haqiqiy field
            return Response(status=403)
        
        data = svc.get_student_history(student)
        
        return Response({
            "student": {
                "id": student.id,
                "name": student.get_full_name(),
                "email": student.email,
                "photo_url": getattr(student, "photo_url", None),
            },
            "overall_percent": data["overall_percent"],
            "by_status": data["by_status"],
            "total_marked": data["total_marked"],
            "records": [
                {
                    "session_date": r.session.date,
                    "group_name": r.session.group.name,
                    "status": r.status,
                    "note": r.note,
                }
                for r in data["records"][:50]
            ],
        })


class ExcelExportView(APIView):
    """Tab 2 — Excel eksport."""
    permission_classes = [IsCenterAdminOrTeacher]
    
    def get(self, request):
        import openpyxl
        from openpyxl.styles import PatternFill, Font, Alignment
        from openpyxl.utils import get_column_letter
        from django.http import HttpResponse
        
        group_id = request.query_params.get("group")
        year = int(request.query_params.get("year"))
        month = int(request.query_params.get("month"))
        
        accessible = get_accessible_groups(request.user)
        try:
            group = accessible.get(pk=group_id)
        except Exception:
            return Response(status=403)
        
        data = svc.get_monthly_grid(group, year, month)
        
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = f"{group.name} {year}-{month:02d}"
        
        # Header
        ws.cell(1, 1, f"Davomat — {group.name}").font = Font(bold=True, size=14)
        ws.cell(2, 1, f"Oy: {year}-{month:02d}")
        
        row = 4
        ws.cell(row, 1, "№"); ws.cell(row, 2, "F.I.O")
        for col, sess in enumerate(data["sessions"], start=3):
            ws.cell(row, col, sess.date.strftime("%d"))
        last_col = 3 + len(data["sessions"])
        ws.cell(row, last_col, "Davomat %")
        ws.cell(row, last_col + 1, "Keldi")
        ws.cell(row, last_col + 2, "Kech")
        ws.cell(row, last_col + 3, "Kelmadi")
        ws.cell(row, last_col + 4, "Sababli")
        
        for r in [row]:
            for c in range(1, last_col + 5):
                ws.cell(r, c).font = Font(bold=True)
                ws.cell(r, c).alignment = Alignment(horizontal="center")
        
        # Body
        row += 1
        green = PatternFill("solid", fgColor="C6EFCE")
        yellow = PatternFill("solid", fgColor="FFEB9C")
        red = PatternFill("solid", fgColor="FFC7CE")
        gray = PatternFill("solid", fgColor="D9D9D9")
        
        for idx, s in enumerate(data["students"], start=1):
            ws.cell(row, 1, idx)
            ws.cell(row, 2, s.get_full_name())
            for col, sess in enumerate(data["sessions"], start=3):
                cell_data = data["cells"].get((s.id, sess.id), {})
                status_ = cell_data.get("status")
                if status_ == "present":
                    ws.cell(row, col, "✓").fill = green
                elif status_ == "late":
                    ws.cell(row, col, "⏱").fill = yellow
                elif status_ == "absent":
                    ws.cell(row, col, "✗").fill = red
                elif status_ == "excused":
                    ws.cell(row, col, "E").fill = gray
                ws.cell(row, col).alignment = Alignment(horizontal="center")
            
            summary = data["summary"][s.id]
            ws.cell(row, last_col, summary["percent"] or "-")
            ws.cell(row, last_col + 1, summary["present"])
            ws.cell(row, last_col + 2, summary["late"])
            ws.cell(row, last_col + 3, summary["absent"])
            ws.cell(row, last_col + 4, summary["excused"])
            
            row += 1
        
        # Column widths
        ws.column_dimensions["A"].width = 5
        ws.column_dimensions["B"].width = 28
        for col in range(3, last_col):
            ws.column_dimensions[get_column_letter(col)].width = 5
        
        response = HttpResponse(
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        response["Content-Disposition"] = f'attachment; filename="davomat_{group.name}_{year}_{month:02d}.xlsx"'
        wb.save(response)
        return response
```

### `apps/attendance/urls.py`

```python
from django.urls import path
from . import views

urlpatterns = [
    path("today-session/", views.TodaySessionView.as_view()),
    path("sessions/<int:session_id>/bulk-mark/", views.BulkMarkView.as_view()),
    path("monthly-grid/", views.MonthlyGridView.as_view()),
    path("records/<int:record_id>/", views.CellUpdateView.as_view()),
    path("analytics/", views.AnalyticsView.as_view()),
    path("students/<int:student_id>/history/", views.StudentHistoryView.as_view()),
    path("export/excel/", views.ExcelExportView.as_view()),
]
```

API base: `/api/v1/<slug>/admin/attendance/...`

`openpyxl` ni `requirements.txt` ga qo'shing:
```
openpyxl>=3.1
```

---

## 5-bosqich: Frontend — `AttendancePage` (tab container)

### `pages/admin/AttendancePage.tsx`

```tsx
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { AttendanceTodayTab } from "./AttendanceTodayTab";
import { AttendanceMonthlyTab } from "./AttendanceMonthlyTab";
import { AttendanceAnalyticsTab } from "./AttendanceAnalyticsTab";

const TABS = [
  { key: "today", label: "Bugungi davomat" },
  { key: "monthly", label: "Oylik jadval" },
  { key: "analytics", label: "Tahlil" },
];

export function AttendancePage() {
  const { user } = useUser();
  const [params, setParams] = useSearchParams();
  
  // Rol bo'yicha default tab
  const defaultTab = user?.user_type === "b2b_admin" ? "monthly" : "today";
  const activeTab = params.get("tab") || defaultTab;
  
  const setTab = (key: string) => {
    const next = new URLSearchParams(params);
    next.set("tab", key);
    setParams(next);
  };
  
  return (
    <AdminLayout active="attendance">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Davomat</h1>
        <p className="text-sm text-gray-500 mt-1">
          Guruhlar bo'yicha talaba davomati va hisobotlar
        </p>
      </div>
      
      {/* Tabs */}
      <div className="bg-white border border-gray-200 rounded-2xl p-2 mb-4">
        <nav className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === t.key
                  ? "bg-rose-50 text-rose-600"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>
      
      {activeTab === "today" && <AttendanceTodayTab />}
      {activeTab === "monthly" && <AttendanceMonthlyTab />}
      {activeTab === "analytics" && <AttendanceAnalyticsTab />}
    </AdminLayout>
  );
}
```

---

## 6-bosqich: Tab 1 — Bugungi davomat

### `pages/admin/AttendanceTodayTab.tsx`

```tsx
import { useState, useEffect } from "react";
import { useGroups } from "@/hooks/useGroups";
import toast from "react-hot-toast";

interface Record {
  id: number;
  student_id: number;
  student_name: string;
  photo_url: string | null;
  status: "present" | "late" | "absent" | "excused" | null;
  note: string;
}

export function AttendanceTodayTab() {
  const { groups, loading: groupsLoading } = useGroups();
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [session, setSession] = useState<any | null>(null);
  const [records, setRecords] = useState<Record[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const slug = window.location.pathname.split("/")[1];
  
  useEffect(() => {
    if (groups.length && !selectedGroup) setSelectedGroup(groups[0].id);
  }, [groups]);
  
  useEffect(() => {
    if (!selectedGroup) return;
    setLoading(true);
    fetch(`/api/v1/${slug}/admin/attendance/today-session/?group=${selectedGroup}&date=${selectedDate}`)
      .then((r) => r.json())
      .then((d) => {
        setSession(d.session);
        setRecords(d.records || []);
      })
      .finally(() => setLoading(false));
  }, [selectedGroup, selectedDate]);
  
  const updateRecord = (studentId: number, status: Record["status"], note?: string) => {
    setRecords((prev) => prev.map((r) =>
      r.student_id === studentId ? { ...r, status, ...(note !== undefined ? { note } : {}) } : r
    ));
  };
  
  const markAllPresent = () => {
    setRecords((prev) => prev.map((r) => ({ ...r, status: "present" })));
  };
  
  const save = async () => {
    if (!session) return;
    const unmarked = records.filter((r) => !r.status);
    if (unmarked.length > 0) {
      if (!confirm(`${unmarked.length} ta talaba markirovkasiz. Davom etamizmi?`)) return;
    }
    
    // Excused uchun note tekshiruvi
    const missingNote = records.find((r) => r.status === "excused" && !r.note.trim());
    if (missingNote) {
      toast.error(`${missingNote.student_name}: Sababli kelmagan uchun izoh majburiy`);
      return;
    }
    
    setSaving(true);
    const res = await fetch(
      `/api/v1/${slug}/admin/attendance/sessions/${session.id}/bulk-mark/`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrf() },
        body: JSON.stringify({
          records: records.filter((r) => r.status).map((r) => ({
            student_id: r.student_id, status: r.status, note: r.note,
          })),
        }),
      }
    );
    setSaving(false);
    if (res.ok) {
      toast.success("Davomat saqlandi");
    } else {
      toast.error("Saqlashda xatolik");
    }
  };
  
  const STATUS_BTNS = [
    { key: "present", label: "Keldi", icon: "✓", color: "green" },
    { key: "late", label: "Kech", icon: "⏱", color: "yellow" },
    { key: "absent", label: "Kelmadi", icon: "✗", color: "red" },
    { key: "excused", label: "Sababli", icon: "E", color: "gray" },
  ] as const;
  
  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-col md:flex-row gap-3">
        <select
          value={selectedGroup ?? ""}
          onChange={(e) => setSelectedGroup(Number(e.target.value))}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        <button
          onClick={markAllPresent}
          disabled={!session}
          className="ml-auto border border-green-500 text-green-700 hover:bg-green-50 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-30"
        >
          ✓ Hammasi keldi
        </button>
        <button
          onClick={save}
          disabled={!session || saving}
          className="bg-rose-600 hover:bg-rose-700 text-white rounded-lg px-5 py-2 text-sm font-medium disabled:opacity-50"
        >
          {saving ? "Saqlanmoqda..." : "Saqlash"}
        </button>
      </div>
      
      {/* Session info */}
      {!session ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <p className="text-gray-500">Ushbu sanada sessiya topilmadi.</p>
          <button className="mt-3 bg-rose-600 hover:bg-rose-700 text-white rounded-lg px-4 py-2 text-sm">
            + Yangi sessiya yaratish
          </button>
        </div>
      ) : (
        <>
          <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-6 text-sm">
            <div>
              <p className="text-xs text-gray-500">Sana</p>
              <p className="font-semibold">{session.date}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Vaqt</p>
              <p className="font-semibold">{session.start_time} – {session.end_time || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">O'qituvchi</p>
              <p className="font-semibold">{session.teacher || "—"}</p>
            </div>
            <div className="ml-auto">
              <p className="text-xs text-gray-500">Markirovka qilingan</p>
              <p className="font-semibold">
                {records.filter((r) => r.status).length} / {records.length}
              </p>
            </div>
          </div>
          
          {/* Students list */}
          <div className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100">
            {records.map((r) => (
              <div key={r.id} className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gray-200 shrink-0 overflow-hidden">
                  {r.photo_url ? <img src={r.photo_url} alt="" className="w-full h-full object-cover" /> : null}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{r.student_name}</p>
                  {r.status === "excused" && (
                    <input
                      type="text"
                      value={r.note}
                      onChange={(e) => updateRecord(r.student_id, r.status, e.target.value)}
                      placeholder="Sabab (majburiy)"
                      className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-xs"
                    />
                  )}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {STATUS_BTNS.map((b) => (
                    <button
                      key={b.key}
                      onClick={() => updateRecord(r.student_id, b.key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                        r.status === b.key
                          ? `bg-${b.color}-500 text-white`
                          : `border border-${b.color}-300 text-${b.color}-700 hover:bg-${b.color}-50`
                      }`}
                    >
                      {b.icon} {b.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
```

**Tailwind safelist** uchun: `bg-{green,yellow,red,gray}-500`, `border-{green,yellow,red,gray}-300`, `text-{green,yellow,red,gray}-700`, `hover:bg-{...}-50` — bularni `safelist`ga qo'shing.

---

## 7-bosqich: Tab 2 — Oylik jadval

### `pages/admin/AttendanceMonthlyTab.tsx`

```tsx
import { useState, useEffect } from "react";
import { useGroups } from "@/hooks/useGroups";
import { CellEditModal } from "./CellEditModal";

const STATUS_VISUAL: Record<string, {icon: string, bg: string}> = {
  present: { icon: "✓", bg: "bg-green-200 text-green-800" },
  late: { icon: "⏱", bg: "bg-yellow-200 text-yellow-800" },
  absent: { icon: "✗", bg: "bg-red-200 text-red-800" },
  excused: { icon: "E", bg: "bg-gray-300 text-gray-700" },
};

export function AttendanceMonthlyTab() {
  const { groups } = useGroups();
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null);
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [data, setData] = useState<any | null>(null);
  const [editingCell, setEditingCell] = useState<any | null>(null);
  
  const slug = window.location.pathname.split("/")[1];
  
  useEffect(() => { if (groups.length && !selectedGroup) setSelectedGroup(groups[0].id); }, [groups]);
  
  const load = () => {
    if (!selectedGroup) return;
    fetch(`/api/v1/${slug}/admin/attendance/monthly-grid/?group=${selectedGroup}&year=${year}&month=${month}`)
      .then((r) => r.json()).then(setData);
  };
  useEffect(load, [selectedGroup, year, month]);
  
  const exportExcel = () => {
    window.location.href = `/api/v1/${slug}/admin/attendance/export/excel/?group=${selectedGroup}&year=${year}&month=${month}`;
  };
  
  const print = () => window.print();
  
  if (!data) return <div className="py-20 text-center text-gray-500">Yuklanmoqda...</div>;
  
  const cellMap = new Map<string, any>();
  data.cells.forEach((c: any) => cellMap.set(`${c.student_id}-${c.session_id}`, c));
  
  return (
    <div className="space-y-4">
      {/* Controls — non-print */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-col md:flex-row gap-3 print:hidden">
        <select value={selectedGroup ?? ""} onChange={(e) => setSelectedGroup(Number(e.target.value))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          {Array.from({length: 12}, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>{m}-oy</option>
          ))}
        </select>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          {[year - 1, year, year + 1].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <button onClick={print} className="ml-auto border border-gray-300 hover:bg-gray-50 rounded-lg px-4 py-2 text-sm">
          🖨 Print
        </button>
        <button onClick={exportExcel} className="border border-green-500 text-green-700 hover:bg-green-50 rounded-lg px-4 py-2 text-sm">
          📥 Excel
        </button>
      </div>
      
      {/* Print header */}
      <div className="hidden print:block text-center mb-4">
        <h1 className="text-xl font-bold">Davomat jadvali</h1>
        <p>{data.group.name} — {year}/{month.toString().padStart(2, "0")}</p>
      </div>
      
      {/* KPI cards — non-print */}
      <div className="grid grid-cols-3 gap-3 print:hidden">
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <p className="text-xs text-gray-500">Guruh o'rtacha davomat</p>
          <p className="text-2xl font-bold text-rose-600">
            {data.group_stats.avg_percent ?? "—"}%
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <p className="text-xs text-gray-500">Bugun davomat</p>
          <p className="text-2xl font-bold">
            {data.group_stats.today_percent != null ? `${data.group_stats.today_percent}%` : "—"}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <p className="text-xs text-gray-500">Xavfli talabalar (&lt;70%)</p>
          <p className="text-2xl font-bold text-red-600">{data.group_stats.at_risk_count}</p>
        </div>
      </div>
      
      {/* Grid */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-x-auto attendance-grid">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left sticky left-0 bg-gray-50 z-10">№</th>
              <th className="px-3 py-2 text-left sticky left-10 bg-gray-50 z-10 min-w-[180px]">F.I.O</th>
              {data.sessions.map((s: any) => (
                <th key={s.id} className="px-1.5 py-2 text-center font-medium min-w-[36px]">
                  <div>{new Date(s.date).getDate()}</div>
                  <div className="text-[10px] text-gray-400">{s.weekday}</div>
                </th>
              ))}
              <th className="px-3 py-2 text-center bg-rose-50">%</th>
              <th className="px-2 py-2 text-center bg-green-50">✓</th>
              <th className="px-2 py-2 text-center bg-yellow-50">⏱</th>
              <th className="px-2 py-2 text-center bg-red-50">✗</th>
              <th className="px-2 py-2 text-center bg-gray-100">E</th>
              <th className="px-2 py-2 text-center">Jami</th>
            </tr>
          </thead>
          <tbody>
            {data.students.map((s: any, idx: number) => {
              const summary = data.summary[s.id];
              return (
                <tr key={s.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 sticky left-0 bg-white">{idx + 1}</td>
                  <td className="px-3 py-2 sticky left-10 bg-white font-medium">
                    <a href={`/${slug}/admin/attendance/student/${s.id}`} className="hover:text-rose-600 hover:underline">
                      {s.name}
                    </a>
                  </td>
                  {data.sessions.map((sess: any) => {
                    const cell = cellMap.get(`${s.id}-${sess.id}`);
                    const visual = cell?.status ? STATUS_VISUAL[cell.status] : null;
                    return (
                      <td key={sess.id} className="p-0.5 text-center">
                        <button
                          onClick={() => setEditingCell({ student: s, session: sess, current: cell })}
                          className={`w-8 h-8 rounded text-xs font-bold ${visual?.bg ?? "bg-white border border-gray-200 hover:bg-gray-100"}`}
                          title={cell?.note || ""}
                        >
                          {visual?.icon ?? ""}
                        </button>
                      </td>
                    );
                  })}
                  <td className={`px-3 py-2 text-center font-bold ${summary.percent !== null && summary.percent < 70 ? "text-red-600" : "text-rose-600"}`}>
                    {summary.percent ?? "—"}{summary.percent !== null && "%"}
                  </td>
                  <td className="px-2 py-2 text-center">{summary.present}</td>
                  <td className="px-2 py-2 text-center">{summary.late}</td>
                  <td className="px-2 py-2 text-center">{summary.absent}</td>
                  <td className="px-2 py-2 text-center">{summary.excused}</td>
                  <td className="px-2 py-2 text-center text-gray-500">{summary.total_sessions}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500 px-2 print:px-0">
        <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-green-200 inline-flex items-center justify-center">✓</span> Keldi</span>
        <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-yellow-200 inline-flex items-center justify-center">⏱</span> Kech qoldi</span>
        <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-red-200 inline-flex items-center justify-center">✗</span> Kelmadi</span>
        <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-gray-300 inline-flex items-center justify-center">E</span> Sababli</span>
      </div>
      
      {editingCell && (
        <CellEditModal
          {...editingCell}
          onClose={() => setEditingCell(null)}
          onSaved={() => { setEditingCell(null); load(); }}
        />
      )}
    </div>
  );
}
```

### `CellEditModal.tsx`

```tsx
export function CellEditModal({ student, session, current, onClose, onSaved }: any) {
  const [status, setStatus] = useState(current?.status || "");
  const [note, setNote] = useState(current?.note || "");
  const slug = window.location.pathname.split("/")[1];
  
  const save = async () => {
    if (status === "excused" && !note.trim()) {
      toast.error("Sababli kelmagan uchun izoh majburiy");
      return;
    }
    const res = await fetch(`/api/v1/${slug}/admin/attendance/records/${current?.id}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrf() },
      body: JSON.stringify({ status, note }),
    });
    if (res.ok) onSaved();
  };
  
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
        <h3 className="font-bold mb-1">{student.name}</h3>
        <p className="text-sm text-gray-500 mb-4">{new Date(session.date).toLocaleDateString("uz")}</p>
        
        <div className="grid grid-cols-2 gap-2 mb-3">
          {["present", "late", "absent", "excused"].map((s) => (
            <button key={s} onClick={() => setStatus(s)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border ${status === s ? "border-rose-500 bg-rose-50 text-rose-700" : "border-gray-300"}`}>
              {{ present: "Keldi", late: "Kech", absent: "Kelmadi", excused: "Sababli" }[s as any]}
            </button>
          ))}
        </div>
        
        {(status === "excused" || note) && (
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3}
                    placeholder={status === "excused" ? "Sabab (majburiy)" : "Izoh (ixtiyoriy)"}
                    className="w-full border border-gray-300 rounded-lg p-2 text-sm mb-3" />
        )}
        
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm">Bekor</button>
          <button onClick={save} className="flex-1 bg-rose-600 text-white rounded-lg py-2 text-sm font-medium">Saqlash</button>
        </div>
      </div>
    </div>
  );
}
```

---

## 8-bosqich: Tab 3 — Tahlil/Hisobot

### `pages/admin/AttendanceAnalyticsTab.tsx`

```tsx
import { useState, useEffect } from "react";
import { Line } from "react-chartjs-2";  // yoki Chart.js to'g'ridan-to'g'ri
import { useGroups } from "@/hooks/useGroups";

export function AttendanceAnalyticsTab() {
  const { groups } = useGroups();
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null);
  const [data, setData] = useState<any | null>(null);
  const slug = window.location.pathname.split("/")[1];
  
  useEffect(() => {
    const url = selectedGroup
      ? `/api/v1/${slug}/admin/attendance/analytics/?group=${selectedGroup}`
      : `/api/v1/${slug}/admin/attendance/analytics/`;
    fetch(url).then((r) => r.json()).then(setData);
  }, [selectedGroup]);
  
  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-2xl p-4 flex gap-3">
        <select value={selectedGroup ?? ""} onChange={(e) => setSelectedGroup(e.target.value ? Number(e.target.value) : null)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="">Barcha guruhlar</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>
      
      {!data ? (
        <div className="py-20 text-center text-gray-500">Yuklanmoqda...</div>
      ) : (
        <>
          {data.trend && (
            <div className="bg-white border border-gray-200 rounded-2xl p-6">
              <h2 className="font-bold mb-4">Davomat trendi (oxirgi 6 oy)</h2>
              <Line
                data={{
                  labels: data.trend.map((t: any) => t.month),
                  datasets: [{
                    label: "Davomat %",
                    data: data.trend.map((t: any) => t.percent),
                    borderColor: "rgb(225, 29, 72)",
                    backgroundColor: "rgba(225, 29, 72, 0.1)",
                    tension: 0.3,
                  }],
                }}
                options={{ scales: { y: { min: 0, max: 100 } } }}
              />
            </div>
          )}
          
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <h2 className="font-bold mb-4">Xavfli talabalar (davomati &lt; 70%)</h2>
            {data.at_risk.length === 0 ? (
              <p className="text-sm text-gray-500">Xavfli talabalar yo'q. 🎉</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {data.at_risk.map((s: any) => (
                  <a key={s.student_id} href={`/${slug}/admin/attendance/student/${s.student_id}`}
                     className="flex items-center justify-between py-2 hover:bg-gray-50 -mx-2 px-2 rounded">
                    <span className="text-sm font-medium">{s.student_name}</span>
                    <span className="text-sm font-bold text-red-600">{s.percent}%</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
```

---

## 9-bosqich: Talaba detail sahifa

### Route: `/<slug>/admin/attendance/student/:id`

### `pages/admin/StudentAttendanceDetailPage.tsx`

```tsx
import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";

export function StudentAttendanceDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState<any | null>(null);
  const slug = window.location.pathname.split("/")[1];
  
  useEffect(() => {
    fetch(`/api/v1/${slug}/admin/attendance/students/${id}/history/`).then((r) => r.json()).then(setData);
  }, [id]);
  
  if (!data) return <AdminLayout><div>Yuklanmoqda...</div></AdminLayout>;
  
  return (
    <AdminLayout active="attendance">
      <a href={`/${slug}/admin/attendance`} className="text-sm text-gray-500 hover:text-rose-600">← Davomatga qaytish</a>
      
      <div className="bg-white border border-gray-200 rounded-2xl p-6 mt-3">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-16 h-16 rounded-full bg-gray-200 overflow-hidden">
            {data.student.photo_url ? <img src={data.student.photo_url} alt="" className="w-full h-full object-cover" /> : null}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{data.student.name}</h1>
            <p className="text-sm text-gray-500">{data.student.email}</p>
          </div>
        </div>
        
        <div className="grid grid-cols-5 gap-3 mb-5">
          <div className="bg-rose-50 border border-rose-100 rounded-xl p-3">
            <p className="text-xs text-rose-700">Umumiy davomat</p>
            <p className="text-2xl font-bold text-rose-700">{data.overall_percent ?? "—"}%</p>
          </div>
          <div className="bg-green-50 border border-green-100 rounded-xl p-3">
            <p className="text-xs text-green-700">Keldi</p>
            <p className="text-2xl font-bold text-green-700">{data.by_status.present}</p>
          </div>
          <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-3">
            <p className="text-xs text-yellow-700">Kech qoldi</p>
            <p className="text-2xl font-bold text-yellow-700">{data.by_status.late}</p>
          </div>
          <div className="bg-red-50 border border-red-100 rounded-xl p-3">
            <p className="text-xs text-red-700">Kelmadi</p>
            <p className="text-2xl font-bold text-red-700">{data.by_status.absent}</p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
            <p className="text-xs text-gray-600">Sababli</p>
            <p className="text-2xl font-bold text-gray-700">{data.by_status.excused}</p>
          </div>
        </div>
        
        <h2 className="font-bold mb-3">So'nggi 50 sessiya</h2>
        <div className="divide-y divide-gray-100">
          {data.records.map((r: any, i: number) => (
            <div key={i} className="py-2 flex items-center justify-between text-sm">
              <div>
                <p className="font-medium">{new Date(r.session_date).toLocaleDateString("uz")}</p>
                <p className="text-xs text-gray-500">{r.group_name}</p>
              </div>
              <div className="text-right">
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  r.status === "present" ? "bg-green-100 text-green-700" :
                  r.status === "late" ? "bg-yellow-100 text-yellow-700" :
                  r.status === "absent" ? "bg-red-100 text-red-700" :
                  r.status === "excused" ? "bg-gray-100 text-gray-700" :
                  "bg-gray-50 text-gray-400"
                }`}>
                  {{ present: "Keldi", late: "Kech", absent: "Kelmadi", excused: "Sababli" }[r.status as any] || "—"}
                </span>
                {r.note && <p className="text-xs text-gray-400 mt-1">{r.note}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
```

Route'ni `App.tsx` ga qo'shing.

---

## 10-bosqich: Print stylesheet

### `styles/attendance-print.css` (yoki global Tailwind'da)

```css
@media print {
  @page {
    size: A4 landscape;
    margin: 10mm;
  }
  
  body {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  
  /* Nav, sidebar, controls — chop etishda yashirin */
  header, aside, nav, .print\\:hidden {
    display: none !important;
  }
  
  .print\\:block { display: block !important; }
  .print\\:px-0 { padding-left: 0 !important; padding-right: 0 !important; }
  
  .attendance-grid {
    border: 1px solid #000;
    page-break-inside: avoid;
  }
  
  .attendance-grid th, .attendance-grid td {
    border: 1px solid #ccc;
  }
  
  /* Status hujayralar — print uchun ranglar */
  .bg-green-200 { background-color: #C6EFCE !important; }
  .bg-yellow-200 { background-color: #FFEB9C !important; }
  .bg-red-200 { background-color: #FFC7CE !important; }
  .bg-gray-300 { background-color: #D9D9D9 !important; }
}
```

Tailwind config'ga `print:hidden`, `print:block`, `print:px-0` variantlari mavjud. Custom CSS faqat tasarrufga oid.

---

## 11-bosqich: Sample data — sinov uchun

```bash
python manage.py shell
```

```python
from datetime import date, timedelta, time
from django.contrib.auth import get_user_model
from apps.groups.models import StudentGroup
from apps.attendance.models import Session, AttendanceRecord
import random

User = get_user_model()

# Bitta guruh
group = StudentGroup.objects.first()
students = list(group.students.all())  # haqiqiy rel

# Oxirgi 30 kun uchun har 2 kunda 1 sessiya
today = date.today()
for i in range(0, 30, 2):
    d = today - timedelta(days=i)
    sess, created = Session.objects.get_or_create(
        group=group, date=d,
        defaults={"start_time": time(14, 0), "end_time": time(16, 0)},
    )
    if created:
        # Har talaba uchun random status
        for s in students:
            rec = sess.attendance_records.filter(student=s).first()
            if rec:
                rec.status = random.choices(
                    ["present", "late", "absent", "excused"],
                    weights=[70, 10, 15, 5]
                )[0]
                if rec.status == "excused":
                    rec.note = "Kasal"
                rec.save()

print("Sample data ready")
```

---

## 12-bosqich: Manual test checklist

### Tab 1 — Bugungi davomat
- [ ] O'qituvchi sifatida kirish → default Tab 1 ochiladi
- [ ] Guruh tanlash dropdown faqat o'qituvchining guruhlarini ko'rsatadi
- [ ] Sana o'zgartirilsa shu sananing sessiyasi yuklanadi
- [ ] Sessiya bo'lmasa "Sessiya topilmadi" + yangi yaratish CTA
- [ ] Talabalar ro'yxati photo + ism bilan
- [ ] 4 ta status tugma har talabaga
- [ ] "Sababli" tanlansa note majburiy bo'ladi (saqlashda validation)
- [ ] "Hammasi keldi" tugmasi barchaga present qo'yadi
- [ ] Saqlash — markirovkalanmagan talabalar ko'p bo'lsa ogohlantirish
- [ ] Muvaffaqiyatli saqlangach toast "Davomat saqlandi"
- [ ] Markirovka 0 → barchasi → Sessiya statusi "completed" ga o'tadi

### Tab 2 — Oylik jadval
- [ ] Center admin sifatida kirish → default Tab 2 ochiladi
- [ ] Guruh + oy + yil tanlash → grid yuklanadi
- [ ] Sticky chap ustun (№, F.I.O) — gorizontal scroll qilganda qoladi
- [ ] Hujayrada to'g'ri rang+belgi: ✓ yashil, ⏱ sariq, ✗ qizil, E kulrang
- [ ] Hujayrani bossa modal ochiladi — status o'zgartirish va saqlash
- [ ] Summary ustunlar to'g'ri: %, Keldi, Kech, Kelmadi, Sababli, Jami
- [ ] Davomati < 70% bo'lgan talaba % qizil rangda
- [ ] KPI cards: avg, today, at_risk to'g'ri
- [ ] Print tugmasi → yangi sahifada landscape print preview
- [ ] Excel tugmasi → .xlsx fayl yuklanadi, ranglar va belgilar to'g'ri
- [ ] Talaba ismini bossa drill-down sahifaga o'tadi

### Tab 3 — Tahlil
- [ ] "Barcha guruhlar" tanlanganda — markazning at_risk ro'yxati
- [ ] Guruh tanlanganda — trend chart + at_risk
- [ ] Chart.js trend chizig'i to'g'ri ko'rinadi
- [ ] At risk talabalar drill-down link bilan

### Talaba detail
- [ ] `/<slug>/admin/attendance/student/<id>` ochiladi
- [ ] Photo, ism, KPI cards (5 ta: Umumiy %, Keldi, Kech, Kelmadi, Sababli)
- [ ] Oxirgi 50 sessiya ro'yxati, har biriga status badge va note
- [ ] Boshqa markazga tegishli talaba bo'lsa 403

### Permission
- [ ] B2C user `/<slug>/admin/attendance` ga kirsa → bloklanadi
- [ ] Teacher boshqa o'qituvchining guruhini tanlay olmaydi (dropdown'da yo'q)

---

## 13-bosqich: Git commit va push (MAJBURIY)

```bash
git add .
git commit -m "ETAP 20: Attendance system redesign — 3 tabs (today/monthly grid/analytics), student detail, print CSS, Excel export, 4 status types"
git push origin feat/etap-20-attendance
```

---

## Yakuniy checklist

- [ ] `Session` modeli mavjud va to'g'ri field'lar bilan
- [ ] `AttendanceRecord` modeli yaratilgan, `unique_together` (session, student)
- [ ] Signal: Session yaratilganda guruhdagi har talabaga AttendanceRecord avtomatik
- [ ] `services/attendance.py` — mark, bulk_mark, get_monthly_grid, get_at_risk, get_trend, get_student_history
- [ ] DRF endpoints: today-session, bulk-mark, monthly-grid, records (PATCH), analytics, students/<id>/history, export/excel
- [ ] `openpyxl` requirements'ga qo'shilgan
- [ ] Frontend: AttendancePage (tab container), 3 tab komponenti, CellEditModal, StudentDetail
- [ ] Rol-aware default tab (teacher → today, admin → monthly)
- [ ] 4 status: Keldi (yashil ✓), Kech (sariq ⏱), Kelmadi (qizil ✗), Sababli (kulrang E)
- [ ] Sababli holatda note majburiy (frontend + backend validation)
- [ ] Tailwind safelist: `bg-{green,yellow,red,gray}-{200,300,500}`, `print:hidden`, `print:block`
- [ ] Print CSS — A4 landscape, control/nav hidden, ranglar saqlanadi
- [ ] Excel export — rangli hujayralar, summary ustunlar
- [ ] Talaba detail sahifa va route
- [ ] Chart.js (yoki react-chartjs-2) o'rnatilgan, trend chizig'i ishlaydi
- [ ] Sample data shell snippet ishlatildi
- [ ] Permissions — teacher faqat o'z guruhlarini, admin barchasini
- [ ] Migration fayllar git'da
- [ ] `git push origin feat/etap-20-attendance` muvaffaqiyatli

---

## Keyingi qadam

ETAP 20 yakunlangandan keyin keyingi B2B yaxshilash yo'nalishlari:
- ETAP 21: Sessiya yaratish flow — recurring sessions (haftalik shedyul), guruh kalendari
- ETAP 22: Ota-onaga avtomatik xabar (talaba kelmasa) — Telegram bot integratsiya
- ETAP 23: To'lov integratsiyasi — talaba davomatiga qarab oylik to'lov hisobi

Yoki B2C tomonida ETAP 17 (kreditlar) → ETAP 18 (to'lov) ga davom etamiz.
