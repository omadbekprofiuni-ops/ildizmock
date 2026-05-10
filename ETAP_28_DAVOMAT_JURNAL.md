# ETAP 28 — DAVOMAT JURNALI (Elektron Attendance System)

> **Mission:** Build a simple, paper-journal-like attendance system for ILDIZ Mock IELTS centers. Teachers mark each student's status per lesson with a single tap (Present / Absent / Late / Excused / Sick). The student sees a **monthly calendar grid** of their attendance. Parents get automatic Telegram messages. Center admins see a real-time dashboard. No biometrics, no QR codes — just a fast, error-proof electronic gradebook.
>
> **Inspirations:**
> - **Kundalik.com** (Uzbekistan, 1200+ schools) — for status taxonomy and 72-hour lock
> - **Canvas Roll Call** (USA universities) — for "Mark All Present" UX and one-tap-multiple-states
> - **PowerSchool** (USA) — for tier-based escalation
> - **ReachMoreParents** (UK) — for parent notification flow

---

## 📌 PROJECT CONTEXT (READ FIRST)

**Repository:** `omadbekprofiuni-ops/ildizmock`
**Domain:** `ildiz-testing.uz`
**Server:** Contabo VPS `207.180.226.230`, user `ildiz`, Supervisor program `ildizmock`

**Stack:**
- Backend: Django 5.x + DRF, PostgreSQL, JWT auth (httpOnly cookie)
- Frontend: React 18 + Vite + TypeScript + TailwindCSS + shadcn/ui
- State: Zustand (auth) + TanStack Query (server state)
- Multi-tenant via `apps/organizations/` model

**Existing models we MUST reuse (do not duplicate):**
- `apps.organizations.Organization` — center
- `apps.accounts.User` — teacher / student / parent / admin (role-based)
- `apps.groups.StudentGroup` — class/cohort, already exists from earlier ETAPs
  - Has fields: `name`, `organization`, `teacher`, `students` (M2M to User)
  - Has `lesson_schedule` (days of week + time)

**Language:** All UI text and code in **English only**. No Uzbek strings in the codebase.

**Standing rule:** Every prompt MUST end with `git add . && git commit -m "..." && git push origin <branch>` actually executed.

---

## 🎯 SCOPE — WHAT THIS ETAP DELIVERS

### IN SCOPE

✅ Backend models: `AttendanceClass`, `AttendanceMark`, `AttendanceEscalation`
✅ 5 status marks: Present (✓), Absent (✗), Late (L), Excused (S), Sick (K)
✅ Teacher mobile/web UI: list of students with single-tap status cycle
✅ "Mark All Present" button — saves 5+ minutes per lesson
✅ 72-hour lock rule (after which marks become read-only)
✅ Teacher can add a brief note per mark
✅ Student monthly journal — grid view (week × weekday) + percentage
✅ Center admin dashboard — real-time per-class status today + escalations
✅ Auto-percentage calculation (Late counts as 80% by default, configurable)
✅ Telegram bot integration for parent notifications
✅ Tier-based escalation: 3 / 5 / 10 absences → warnings to admin
✅ PDF export of student monthly journal
✅ Excel export of class roster (admin)

### EXPLICITLY OUT OF SCOPE

❌ QR code / biometric / GPS / facial recognition
❌ ILDIZ Library integration (this ETAP is Mock-only)
❌ SMS notifications (Telegram only)
❌ Live (real-time WebSocket) updates — polling every 10s is enough
❌ Custom escalation policy editor (use hardcoded 3/5/10 thresholds for now)
❌ Bulk attendance editing across multiple classes
❌ Attendance analytics charts (deferred to ETAP 29)

If a feature is not on the IN SCOPE list, **don't build it**.

---

## 🏗️ ARCHITECTURE

```
   TEACHER PATH                     STUDENT PATH

   ┌──────────────────┐             ┌────────────────┐
   │  My groups today │             │  My attendance │
   └────────┬─────────┘             └────────┬───────┘
            │                                │
   ┌────────▼─────────┐             ┌────────▼───────┐
   │  Open class      │             │  Monthly grid  │
   │  (lesson)        │             │  view          │
   └────────┬─────────┘             └────────┬───────┘
            │                                │
   ┌────────▼─────────┐             ┌────────▼───────┐
   │  ✓ Mark All      │             │  Stats:        │
   │  Present, then   │             │  Present 17    │
   │  edit exceptions │             │  Late 1        │
   │                  │             │  %  92%        │
   │  Adjust notes    │             └────────┬───────┘
   └────────┬─────────┘                      │
            │                       ┌────────▼───────┐
   ┌────────▼─────────┐             │  PDF download  │
   │  Auto-save       │             └────────────────┘
   │  Auto-calc %     │
   │  Trigger         │
   │  Telegram bot    │
   │  Trigger         │
   │  escalations     │
   └──────────────────┘
```

---

# PART 1 — DATA MODEL

`backend/apps/attendance/models.py` (create new app):

```bash
cd backend
python manage.py startapp attendance
```

Move it under `apps/`:
```bash
mv attendance apps/attendance
# update apps.py: name = 'apps.attendance'
# add to INSTALLED_APPS in settings: 'apps.attendance'
```

Then:

```python
# apps/attendance/models.py
import uuid
from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        abstract = True


class AttendanceClass(TimeStampedModel):
    """One lesson session. Teacher creates this when starting attendance."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    group = models.ForeignKey(
        'groups.StudentGroup', on_delete=models.CASCADE, related_name='attendance_classes',
    )
    teacher = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name='attendance_classes_taught',
    )
    date = models.DateField(default=timezone.now)
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    locked_at = models.DateTimeField(
        null=True, blank=True,
        help_text="Set after 72 hours — marks become read-only",
    )
    note = models.TextField(blank=True, default='', help_text="Optional lesson-wide note")

    class Meta:
        ordering = ['-date', '-started_at']
        indexes = [
            models.Index(fields=['group', '-date']),
            models.Index(fields=['date']),
        ]
        unique_together = [('group', 'date')]   # one session per group per day

    def is_locked(self) -> bool:
        if self.locked_at:
            return True
        # Auto-lock after 72 hours
        if self.started_at and (timezone.now() - self.started_at).total_seconds() > 72 * 3600:
            return True
        return False


class AttendanceMark(TimeStampedModel):
    """One student's status for one AttendanceClass."""

    class Status(models.TextChoices):
        PRESENT = 'present', 'Present'      # ✓ — 100%
        ABSENT  = 'absent',  'Absent'       # ✗ — 0% (unexcused)
        LATE    = 'late',    'Late'         # L — 80% (configurable)
        EXCUSED = 'excused', 'Excused'      # S — 100% (excused absence)
        SICK    = 'sick',    'Sick'         # K — 100% (excused, sick)

    attendance_class = models.ForeignKey(
        AttendanceClass, on_delete=models.CASCADE, related_name='marks',
    )
    student = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='attendance_marks',
    )
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.PRESENT,
    )
    note = models.TextField(blank=True, default='')
    marked_at = models.DateTimeField(auto_now_add=True)
    marked_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name='marks_set',
    )
    edited_count = models.PositiveSmallIntegerField(default=0)

    # Telegram notification tracking
    parent_notified = models.BooleanField(default=False)
    parent_notified_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = [('attendance_class', 'student')]
        indexes = [
            models.Index(fields=['student', '-created_at']),
            models.Index(fields=['attendance_class', 'status']),
        ]

    @property
    def credit_percent(self) -> float:
        """How much this mark contributes to attendance percentage."""
        return {
            self.Status.PRESENT: 100.0,
            self.Status.LATE:    80.0,
            self.Status.EXCUSED: 100.0,
            self.Status.SICK:    100.0,
            self.Status.ABSENT:  0.0,
        }[self.status]


class AttendanceEscalation(TimeStampedModel):
    """Triggered when a student crosses 3/5/10 absence thresholds."""

    class Tier(models.TextChoices):
        WARNING       = 'warning',       'Warning (3 absences)'
        REPRIMAND     = 'reprimand',     'Reprimand (5 absences)'
        REMOVAL       = 'removal',       'Removal recommended (10 absences)'

    student = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='attendance_escalations',
    )
    group = models.ForeignKey(
        'groups.StudentGroup', on_delete=models.CASCADE,
    )
    tier = models.CharField(max_length=16, choices=Tier.choices)
    absence_count = models.PositiveSmallIntegerField()
    triggered_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name='escalations_resolved',
    )
    resolution_note = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['-triggered_at']
        indexes = [
            models.Index(fields=['student', 'tier', 'resolved_at']),
        ]


class TelegramBinding(TimeStampedModel):
    """Links a parent's Telegram chat_id to a student. One student can have multiple parents."""
    student = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='telegram_bindings',
    )
    chat_id = models.CharField(max_length=32)
    parent_name = models.CharField(max_length=100, blank=True, default='')
    is_active = models.BooleanField(default=True)
    bound_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('student', 'chat_id')]
        indexes = [models.Index(fields=['chat_id'])]
```

Migration:
```bash
python manage.py makemigrations attendance
python manage.py migrate
```

---

# PART 2 — ESCALATION + AUTO-LOCK BACKGROUND TASKS

## 2.1 Escalation logic

`backend/apps/attendance/services/escalation.py`:

```python
"""
After every AttendanceMark save, check whether the student has crossed
an absence threshold (3 / 5 / 10) within the current group. If so,
create an AttendanceEscalation row (idempotent — won't duplicate).
"""
from datetime import timedelta
from django.utils import timezone
from ..models import AttendanceMark, AttendanceEscalation


THRESHOLDS = [
    (3,  AttendanceEscalation.Tier.WARNING),
    (5,  AttendanceEscalation.Tier.REPRIMAND),
    (10, AttendanceEscalation.Tier.REMOVAL),
]


def check_and_create_escalations(student, group, since_days: int = 30) -> list:
    """Returns a list of newly-created AttendanceEscalation rows."""
    cutoff = timezone.now() - timedelta(days=since_days)
    absence_count = AttendanceMark.objects.filter(
        student=student,
        attendance_class__group=group,
        status=AttendanceMark.Status.ABSENT,
        created_at__gte=cutoff,
    ).count()

    new_rows = []
    for threshold, tier in THRESHOLDS:
        if absence_count < threshold:
            continue
        # Skip if there's already an unresolved escalation at this tier
        already = AttendanceEscalation.objects.filter(
            student=student, group=group, tier=tier, resolved_at__isnull=True,
        ).exists()
        if already:
            continue
        row = AttendanceEscalation.objects.create(
            student=student, group=group, tier=tier, absence_count=absence_count,
        )
        new_rows.append(row)
    return new_rows
```

## 2.2 Auto-lock cron command

`backend/apps/attendance/management/commands/lock_old_attendance.py`:

```python
"""Lock attendance classes older than 72 hours (idempotent)."""
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.attendance.models import AttendanceClass


class Command(BaseCommand):
    help = "Lock attendance classes older than 72 hours."

    def handle(self, *args, **opts):
        cutoff = timezone.now() - timedelta(hours=72)
        qs = AttendanceClass.objects.filter(
            locked_at__isnull=True,
            started_at__lt=cutoff,
        )
        count = qs.update(locked_at=timezone.now())
        self.stdout.write(self.style.SUCCESS(f"Locked {count} attendance classes."))
```

Schedule it via crontab on the server:
```cron
0 * * * * cd /home/ildiz/ildizmock/backend && /home/ildiz/ildizmock/backend/venv/bin/python manage.py lock_old_attendance
```

## 2.3 Signal — trigger escalation + Telegram on mark save

`backend/apps/attendance/signals.py`:

```python
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import AttendanceMark
from .services.escalation import check_and_create_escalations
from .services.telegram_bot import notify_parent_async


@receiver(post_save, sender=AttendanceMark)
def on_mark_saved(sender, instance, created, **kwargs):
    """After a mark is saved or updated:
       1. Notify parent via Telegram (once per mark)
       2. Check escalation thresholds
    """
    # Telegram (only on creation; updates don't re-notify)
    if created and not instance.parent_notified:
        notify_parent_async(instance)

    # Escalation
    if instance.status == AttendanceMark.Status.ABSENT:
        check_and_create_escalations(
            student=instance.student,
            group=instance.attendance_class.group,
        )
```

Wire signals in `apps/attendance/apps.py`:

```python
from django.apps import AppConfig

class AttendanceConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.attendance'

    def ready(self):
        from . import signals  # noqa: F401
```

---

# PART 3 — TELEGRAM BOT INTEGRATION

## 3.1 Settings

In `backend/config/settings/base.py`:

```python
import os

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_BOT_USERNAME = os.getenv("TELEGRAM_BOT_USERNAME", "ildiz_attendance_bot")
```

In `.env`:
```
TELEGRAM_BOT_TOKEN=<your_bot_token_from_@BotFather>
TELEGRAM_BOT_USERNAME=ildiz_attendance_bot
```

If the bot doesn't exist yet, the admin should create one with `@BotFather` on Telegram, set its name to `ILDIZ Attendance`, and paste the token into `.env`.

## 3.2 Notification service

`backend/apps/attendance/services/telegram_bot.py`:

```python
"""
Sends parent notifications via Telegram Bot API.
Sync version is used directly; for high-volume centers, switch to Celery later.
"""
import logging
import requests
from django.conf import settings
from django.utils import timezone
from ..models import TelegramBinding, AttendanceMark

logger = logging.getLogger(__name__)

API_BASE = "https://api.telegram.org/bot{token}"

STATUS_MESSAGES = {
    'present': "✓ {student_name} arrived at {time} for {group_name}.",
    'absent':  "⚠️ {student_name} did not arrive for {group_name} (lesson at {time}).",
    'late':    "⏰ {student_name} arrived late at {time} for {group_name}.",
    'excused': "ℹ️ {student_name} is excused today for {group_name}.",
    'sick':    "🤒 {student_name} is marked sick today for {group_name}.",
}


def send_telegram_message(chat_id: str, text: str) -> bool:
    token = settings.TELEGRAM_BOT_TOKEN
    if not token:
        logger.warning("TELEGRAM_BOT_TOKEN is not set; skipping notification")
        return False
    try:
        resp = requests.post(
            f"{API_BASE.format(token=token)}/sendMessage",
            json={"chat_id": chat_id, "text": text, "parse_mode": "HTML"},
            timeout=5,
        )
        if resp.status_code == 200:
            return True
        logger.error(f"Telegram API error {resp.status_code}: {resp.text[:200]}")
    except requests.RequestException as e:
        logger.error(f"Telegram request failed: {e}")
    return False


def notify_parent_async(mark: AttendanceMark) -> None:
    """Sends notification to all parents bound to this student. Synchronous,
    but wrapped in try/except so failures don't break the save flow."""
    try:
        student = mark.student
        bindings = TelegramBinding.objects.filter(student=student, is_active=True)
        if not bindings.exists():
            return

        template = STATUS_MESSAGES.get(mark.status)
        if not template:
            return

        text = template.format(
            student_name=student.get_full_name() or student.username,
            time=mark.attendance_class.started_at.strftime("%H:%M"),
            group_name=mark.attendance_class.group.name,
        )

        any_success = False
        for binding in bindings:
            if send_telegram_message(binding.chat_id, text):
                any_success = True

        if any_success:
            mark.parent_notified = True
            mark.parent_notified_at = timezone.now()
            mark.save(update_fields=['parent_notified', 'parent_notified_at'])
    except Exception as e:
        logger.exception(f"notify_parent_async failed: {e}")
```

## 3.3 Bot webhook for binding parents

Parents start the bot, send `/start <student_code>`, and the backend binds their `chat_id` to the student.

`backend/apps/attendance/views_bot.py`:

```python
import logging
import json
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
from django.contrib.auth import get_user_model
from .models import TelegramBinding
from .services.telegram_bot import send_telegram_message

User = get_user_model()
logger = logging.getLogger(__name__)


@csrf_exempt
def telegram_webhook(request):
    """Handles /start <code> commands from parents."""
    if request.method != 'POST':
        return JsonResponse({"ok": False}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"ok": False}, status=400)

    message = data.get("message")
    if not message:
        return JsonResponse({"ok": True})

    chat_id = str(message["chat"]["id"])
    text = (message.get("text") or "").strip()

    if text.startswith("/start"):
        parts = text.split(maxsplit=1)
        if len(parts) < 2:
            send_telegram_message(chat_id, (
                "👋 Welcome to ILDIZ Attendance Bot.\n\n"
                "Please ask your child for their student code "
                "and send: /start <code>"
            ))
            return JsonResponse({"ok": True})

        code = parts[1].strip()
        try:
            student = User.objects.get(student_code=code)
        except User.DoesNotExist:
            send_telegram_message(chat_id, (
                "❌ Student code not found. Please double-check with your child."
            ))
            return JsonResponse({"ok": True})

        binding, created = TelegramBinding.objects.get_or_create(
            student=student, chat_id=chat_id,
            defaults={
                "parent_name": message["chat"].get("first_name", ""),
                "is_active": True,
            },
        )
        if not created:
            binding.is_active = True
            binding.save(update_fields=["is_active"])

        send_telegram_message(chat_id, (
            f"✅ Subscribed to attendance updates for "
            f"{student.get_full_name() or student.username}.\n\n"
            f"You'll receive a message every time their attendance is marked."
        ))

    elif text == "/stop":
        TelegramBinding.objects.filter(chat_id=chat_id).update(is_active=False)
        send_telegram_message(chat_id, "🔕 Notifications paused. Send /start to resume.")

    return JsonResponse({"ok": True})
```

> **Note:** This requires a `student_code` field on the User model (or a workspace-style code on `StudentGroup` membership). If it doesn't exist, add it as a 6-character random code generated on user creation. Otherwise, parents can use the username directly.

URL: `/api/v1/telegram/webhook/` — register with Telegram via:
```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
     -d "url=https://ildiz-testing.uz/api/v1/telegram/webhook/"
```

---

# PART 4 — BACKEND API ENDPOINTS

`backend/apps/attendance/urls.py`:

```python
from django.urls import path
from . import views_teacher, views_student, views_admin, views_bot

urlpatterns = [
    # Teacher
    path("teacher/today/", views_teacher.TeacherTodayView.as_view()),
    path("teacher/groups/<uuid:group_id>/start/", views_teacher.StartClassView.as_view()),
    path("teacher/classes/<uuid:class_id>/", views_teacher.ClassDetailView.as_view()),
    path("teacher/classes/<uuid:class_id>/marks/", views_teacher.MarksBulkView.as_view()),
    path("teacher/classes/<uuid:class_id>/mark-all-present/",
         views_teacher.MarkAllPresentView.as_view()),
    path("teacher/marks/<int:pk>/", views_teacher.MarkDetailView.as_view()),

    # Student
    path("student/journal/", views_student.StudentJournalView.as_view()),
    path("student/journal/export-pdf/", views_student.StudentJournalPdfView.as_view()),

    # Admin
    path("admin/dashboard/today/", views_admin.AdminDashboardTodayView.as_view()),
    path("admin/escalations/", views_admin.EscalationListView.as_view()),
    path("admin/escalations/<int:pk>/resolve/",
         views_admin.EscalationResolveView.as_view()),
    path("admin/groups/<uuid:group_id>/monthly-export/",
         views_admin.GroupMonthlyExcelView.as_view()),

    # Telegram bot webhook
    path("telegram/webhook/", views_bot.telegram_webhook),
]
```

Include in `backend/config/urls.py`:
```python
path("api/v1/attendance/", include("apps.attendance.urls")),
```

## 4.1 Teacher views — `views_teacher.py`

```python
from datetime import date as date_cls
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.generics import RetrieveAPIView
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db import transaction

from apps.groups.models import StudentGroup
from .models import AttendanceClass, AttendanceMark
from .serializers import (
    AttendanceClassSerializer, AttendanceMarkSerializer,
    StudentGroupBriefSerializer,
)


class TeacherTodayView(APIView):
    """Returns today's groups for the logged-in teacher, with status."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = date_cls.today()
        groups = StudentGroup.objects.filter(teacher=request.user)
        result = []
        for g in groups:
            klass = AttendanceClass.objects.filter(group=g, date=today).first()
            result.append({
                "group": StudentGroupBriefSerializer(g).data,
                "class_id": str(klass.id) if klass else None,
                "started": bool(klass),
                "ended": bool(klass and klass.ended_at),
                "marks_count": klass.marks.count() if klass else 0,
                "students_count": g.students.count(),
            })
        return Response(result)


class StartClassView(APIView):
    """Starts (or fetches existing) attendance class for a group today."""
    permission_classes = [IsAuthenticated]

    def post(self, request, group_id):
        group = get_object_or_404(StudentGroup, pk=group_id)
        if group.teacher_id != request.user.id and not request.user.is_superuser:
            return Response({"error": "Not your group"}, status=403)

        klass, created = AttendanceClass.objects.get_or_create(
            group=group,
            date=date_cls.today(),
            defaults={"teacher": request.user},
        )
        return Response(AttendanceClassSerializer(klass).data, status=201 if created else 200)


class ClassDetailView(RetrieveAPIView):
    """Read full class data including all marks."""
    permission_classes = [IsAuthenticated]
    serializer_class = AttendanceClassSerializer
    queryset = AttendanceClass.objects.all()
    lookup_url_kwarg = 'class_id'


class MarksBulkView(APIView):
    """
    POST: Create or update multiple marks at once.
    Body:
        {"marks": [{"student_id": "...", "status": "present", "note": ""}, ...]}
    """
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, class_id):
        klass = get_object_or_404(AttendanceClass, pk=class_id)
        if klass.is_locked():
            return Response({"error": "Class is locked (72 hours passed)"}, status=400)

        items = request.data.get("marks", [])
        results = []
        for item in items:
            mark, created = AttendanceMark.objects.update_or_create(
                attendance_class=klass,
                student_id=item["student_id"],
                defaults={
                    "status": item.get("status", "present"),
                    "note": item.get("note", ""),
                    "marked_by": request.user,
                },
            )
            if not created:
                AttendanceMark.objects.filter(pk=mark.pk).update(
                    edited_count=models.F('edited_count') + 1,
                )
            results.append(AttendanceMarkSerializer(mark).data)
        return Response({"marks": results})


class MarkAllPresentView(APIView):
    """One-tap: mark all students in this group as Present (only those without a mark yet)."""
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, class_id):
        klass = get_object_or_404(AttendanceClass, pk=class_id)
        if klass.is_locked():
            return Response({"error": "Class is locked"}, status=400)

        existing_student_ids = set(klass.marks.values_list("student_id", flat=True))
        new_marks = []
        for student in klass.group.students.all():
            if student.id in existing_student_ids:
                continue
            new_marks.append(AttendanceMark(
                attendance_class=klass,
                student=student,
                status=AttendanceMark.Status.PRESENT,
                marked_by=request.user,
            ))
        AttendanceMark.objects.bulk_create(new_marks)
        return Response({"created": len(new_marks)})


class MarkDetailView(APIView):
    """PATCH: update one mark's status/note."""
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        mark = get_object_or_404(AttendanceMark, pk=pk)
        if mark.attendance_class.is_locked():
            return Response({"error": "Class is locked"}, status=400)

        if "status" in request.data:
            mark.status = request.data["status"]
        if "note" in request.data:
            mark.note = request.data["note"]
        mark.marked_by = request.user
        mark.edited_count += 1
        mark.save()
        return Response(AttendanceMarkSerializer(mark).data)


# Need this import for F() above
from django.db import models
```

## 4.2 Student views — `views_student.py`

```python
import io
from calendar import monthrange
from datetime import date as date_cls
from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import AttendanceMark


class StudentJournalView(APIView):
    """Returns a calendar-grid view of the student's attendance for a given month.

    Query params:
        year=2026, month=5  (defaults to current month)
        group_id=<uuid>     (optional — filter to one group)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = date_cls.today()
        year = int(request.query_params.get("year", today.year))
        month = int(request.query_params.get("month", today.month))
        group_id = request.query_params.get("group_id")

        marks_qs = AttendanceMark.objects.filter(
            student=request.user,
            attendance_class__date__year=year,
            attendance_class__date__month=month,
        ).select_related("attendance_class", "attendance_class__group")
        if group_id:
            marks_qs = marks_qs.filter(attendance_class__group_id=group_id)

        # Build day → status map
        by_date: dict[str, dict] = {}
        for m in marks_qs:
            d = m.attendance_class.date.isoformat()
            by_date[d] = {
                "status": m.status,
                "note": m.note,
                "credit_percent": m.credit_percent,
                "group": m.attendance_class.group.name,
            }

        # Build the calendar grid
        first_weekday, days_in_month = monthrange(year, month)
        days = []
        for day in range(1, days_in_month + 1):
            d = date_cls(year, month, day).isoformat()
            days.append({
                "day": day,
                "date": d,
                "weekday": (first_weekday + day - 1) % 7,
                "mark": by_date.get(d),
            })

        # Stats
        total = len(by_date)
        counts = {"present": 0, "absent": 0, "late": 0, "excused": 0, "sick": 0}
        sum_pct = 0.0
        for v in by_date.values():
            counts[v["status"]] = counts.get(v["status"], 0) + 1
            sum_pct += v["credit_percent"]
        attendance_pct = round(sum_pct / total, 1) if total else 0.0

        return Response({
            "year": year,
            "month": month,
            "days": days,
            "totals": {
                **counts,
                "total_lessons": total,
                "attendance_percent": attendance_pct,
            },
        })


class StudentJournalPdfView(APIView):
    """Returns the monthly journal as a PDF (uses reportlab)."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Reuse the StudentJournalView logic
        journal = StudentJournalView().get(request).data

        from reportlab.pdfgen import canvas
        from reportlab.lib.pagesizes import A4

        buf = io.BytesIO()
        c = canvas.Canvas(buf, pagesize=A4)
        width, height = A4

        c.setFont("Helvetica-Bold", 18)
        c.drawString(50, height - 60, f"Attendance Journal — {journal['year']}/{journal['month']:02d}")
        c.setFont("Helvetica", 11)
        c.drawString(50, height - 80, f"Student: {request.user.get_full_name() or request.user.username}")

        y = height - 120
        c.setFont("Helvetica-Bold", 12)
        c.drawString(50, y, "Day | Date | Status | Note")
        y -= 16
        c.setFont("Helvetica", 10)
        for d in journal["days"]:
            mark = d.get("mark")
            row = f"{d['day']:>2} | {d['date']} | "
            if mark:
                row += f"{mark['status']:<8} | {mark['note'][:50]}"
            else:
                row += "—"
            c.drawString(50, y, row)
            y -= 13
            if y < 60:
                c.showPage()
                y = height - 60

        c.showPage()
        c.setFont("Helvetica-Bold", 14)
        c.drawString(50, height - 60, "Summary")
        c.setFont("Helvetica", 11)
        t = journal["totals"]
        rows = [
            f"Total lessons: {t['total_lessons']}",
            f"Present: {t['present']}",
            f"Late: {t['late']}",
            f"Excused: {t['excused']}",
            f"Sick: {t['sick']}",
            f"Absent: {t['absent']}",
            f"Attendance percent: {t['attendance_percent']}%",
        ]
        y = height - 90
        for r in rows:
            c.drawString(50, y, r)
            y -= 16

        c.save()
        buf.seek(0)
        resp = HttpResponse(buf.getvalue(), content_type="application/pdf")
        resp["Content-Disposition"] = (
            f'attachment; filename="attendance_{journal["year"]}_{journal["month"]:02d}.pdf"'
        )
        return resp
```

Install reportlab:
```bash
pip install reportlab --break-system-packages
echo "reportlab==4.2.5" >> requirements.txt
```

## 4.3 Admin views — `views_admin.py`

```python
import io
from datetime import date as date_cls, timedelta
from calendar import monthrange
from openpyxl import Workbook
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.generics import ListAPIView
from rest_framework.response import Response

from apps.groups.models import StudentGroup
from .models import AttendanceClass, AttendanceMark, AttendanceEscalation
from .serializers import EscalationSerializer


class AdminDashboardTodayView(APIView):
    """Returns all groups in the org with today's attendance status."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        org = getattr(request, "organization", None)
        groups_qs = StudentGroup.objects.all()
        if org:
            groups_qs = groups_qs.filter(organization=org)

        today = date_cls.today()
        result = []
        for g in groups_qs:
            klass = AttendanceClass.objects.filter(group=g, date=today).first()
            students_count = g.students.count()
            present = late = absent = excused = sick = 0
            if klass:
                for m in klass.marks.all():
                    if m.status == 'present': present += 1
                    elif m.status == 'late': late += 1
                    elif m.status == 'absent': absent += 1
                    elif m.status == 'excused': excused += 1
                    elif m.status == 'sick': sick += 1
            attended = present + late + excused + sick
            pct = round(attended / students_count * 100, 1) if students_count else 0
            result.append({
                "group_id": str(g.id),
                "group_name": g.name,
                "teacher": g.teacher.get_full_name() if g.teacher else None,
                "students_count": students_count,
                "started": bool(klass),
                "present": present,
                "late": late,
                "absent": absent,
                "excused": excused,
                "sick": sick,
                "attendance_percent": pct,
            })
        return Response({"date": today.isoformat(), "groups": result})


class EscalationListView(ListAPIView):
    """Unresolved escalations across the org."""
    permission_classes = [IsAuthenticated]
    serializer_class = EscalationSerializer

    def get_queryset(self):
        qs = AttendanceEscalation.objects.filter(resolved_at__isnull=True)
        org = getattr(self.request, "organization", None)
        if org:
            qs = qs.filter(group__organization=org)
        return qs.order_by("-triggered_at")


class EscalationResolveView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        esc = get_object_or_404(AttendanceEscalation, pk=pk)
        esc.resolved_at = timezone.now()
        esc.resolved_by = request.user
        esc.resolution_note = request.data.get("note", "")
        esc.save()
        return Response({"id": esc.id, "resolved": True})


class GroupMonthlyExcelView(APIView):
    """Excel export: all students × days of month for one group."""
    permission_classes = [IsAuthenticated]

    def get(self, request, group_id):
        group = get_object_or_404(StudentGroup, pk=group_id)
        today = date_cls.today()
        year = int(request.query_params.get("year", today.year))
        month = int(request.query_params.get("month", today.month))
        _, days_in_month = monthrange(year, month)

        wb = Workbook()
        ws = wb.active
        ws.title = f"{year}-{month:02d}"

        # Header
        header = ["Student"] + [f"{d:02d}" for d in range(1, days_in_month + 1)] + [
            "Present", "Late", "Excused", "Sick", "Absent", "%",
        ]
        ws.append(header)

        # Per student
        for student in group.students.all():
            row = [student.get_full_name() or student.username]
            counts = {"present": 0, "late": 0, "excused": 0, "sick": 0, "absent": 0}
            sum_pct = 0.0
            seen = 0
            for d in range(1, days_in_month + 1):
                lesson_date = date_cls(year, month, d)
                klass = AttendanceClass.objects.filter(group=group, date=lesson_date).first()
                if not klass:
                    row.append("")
                    continue
                mark = klass.marks.filter(student=student).first()
                if not mark:
                    row.append("")
                    continue
                symbol = {
                    'present': '✓', 'absent': '✗', 'late': 'L',
                    'excused': 'S', 'sick': 'K',
                }[mark.status]
                row.append(symbol)
                counts[mark.status] += 1
                sum_pct += mark.credit_percent
                seen += 1
            pct = round(sum_pct / seen, 1) if seen else 0
            row += [counts["present"], counts["late"], counts["excused"],
                    counts["sick"], counts["absent"], f"{pct}%"]
            ws.append(row)

        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)
        resp = HttpResponse(
            buf.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        resp["Content-Disposition"] = (
            f'attachment; filename="{group.name}_{year}_{month:02d}.xlsx"'
        )
        return resp
```

## 4.4 Serializers — `serializers.py`

```python
from rest_framework import serializers
from .models import AttendanceClass, AttendanceMark, AttendanceEscalation


class StudentGroupBriefSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()
    students_count = serializers.SerializerMethodField()

    def get_students_count(self, obj):
        return obj.students.count()


class AttendanceMarkSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    credit_percent = serializers.FloatField(read_only=True)
    is_locked = serializers.SerializerMethodField()

    class Meta:
        model = AttendanceMark
        fields = ["id", "student", "student_name", "status", "note",
                  "marked_at", "edited_count", "credit_percent",
                  "parent_notified", "is_locked"]

    def get_student_name(self, obj):
        return obj.student.get_full_name() or obj.student.username

    def get_is_locked(self, obj):
        return obj.attendance_class.is_locked()


class AttendanceClassSerializer(serializers.ModelSerializer):
    marks = AttendanceMarkSerializer(many=True, read_only=True)
    is_locked = serializers.SerializerMethodField()
    students = serializers.SerializerMethodField()

    class Meta:
        model = AttendanceClass
        fields = ["id", "group", "teacher", "date", "started_at", "ended_at",
                  "locked_at", "is_locked", "note", "marks", "students"]

    def get_is_locked(self, obj):
        return obj.is_locked()

    def get_students(self, obj):
        return [
            {"id": str(s.id), "full_name": s.get_full_name() or s.username}
            for s in obj.group.students.all()
        ]


class EscalationSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    group_name = serializers.SerializerMethodField()

    class Meta:
        model = AttendanceEscalation
        fields = ["id", "student", "student_name", "group", "group_name",
                  "tier", "absence_count", "triggered_at",
                  "resolved_at", "resolution_note"]

    def get_student_name(self, obj):
        return obj.student.get_full_name() or obj.student.username

    def get_group_name(self, obj):
        return obj.group.name
```

---

# PART 5 — FRONTEND ROUTES

In `frontend/src/App.tsx`:

```tsx
{/* Teacher */}
<Route path="/teacher/attendance" element={<TeacherToday />} />
<Route path="/teacher/attendance/class/:classId" element={<TeacherClassMarker />} />

{/* Student */}
<Route path="/student/attendance" element={<StudentJournal />} />

{/* Center admin */}
<Route path="/center/attendance" element={<AdminAttendanceDashboard />} />
<Route path="/center/attendance/escalations" element={<EscalationsList />} />
```

---

# PART 6 — TEACHER UI

## 6.1 Today screen — `frontend/src/pages/teacher/TeacherToday.tsx`

```tsx
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

export default function TeacherToday() {
  const navigate = useNavigate();
  const { data: groups, refetch } = useQuery({
    queryKey: ['teacher-today'],
    queryFn: () => api.get('/attendance/teacher/today/').then(r => r.data),
    refetchInterval: 30_000,
  });

  const startMutation = useMutation({
    mutationFn: (groupId: string) =>
      api.post(`/attendance/teacher/groups/${groupId}/start/`),
    onSuccess: (r: any) => navigate(`/teacher/attendance/class/${r.data.id}`),
  });

  if (!groups) return <div className="p-8">Loading…</div>;

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="mb-2 text-2xl font-bold">Today's Classes</h1>
      <p className="mb-6 text-sm text-gray-600">
        {new Date().toLocaleDateString(undefined, {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        })}
      </p>

      {groups.length === 0 && (
        <div className="rounded-xl border bg-gray-50 p-12 text-center text-gray-500">
          No groups assigned to you.
        </div>
      )}

      <div className="space-y-3">
        {groups.map((g: any) => (
          <div key={g.group.id}
               className="flex items-center justify-between rounded-xl border bg-white p-5 shadow-sm">
            <div>
              <h2 className="font-semibold">{g.group.name}</h2>
              <p className="mt-1 text-sm text-gray-600">
                {g.students_count} students
                {g.started && (
                  <span className="ml-2 text-xs text-green-600">
                    · {g.marks_count} marked
                  </span>
                )}
              </p>
            </div>

            {g.started ? (
              <button
                onClick={() => navigate(`/teacher/attendance/class/${g.class_id}`)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
              >
                Continue →
              </button>
            ) : (
              <button
                onClick={() => startMutation.mutate(g.group.id)}
                disabled={startMutation.isPending}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:bg-gray-300"
              >
                {startMutation.isPending ? 'Starting…' : 'Start attendance'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

## 6.2 Class marker — `frontend/src/pages/teacher/TeacherClassMarker.tsx`

```tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { StatusBadge, STATUS_CYCLE, statusOf } from '@/components/attendance/StatusBadge';

export default function TeacherClassMarker() {
  const { classId } = useParams();
  const navigate = useNavigate();

  const { data: klass, refetch } = useQuery({
    queryKey: ['class', classId],
    queryFn: () => api.get(`/attendance/teacher/classes/${classId}/`).then(r => r.data),
  });

  const [localMarks, setLocalMarks] = useState<Record<string, { status: string; note: string }>>({});
  useEffect(() => {
    if (klass) {
      const mp: Record<string, { status: string; note: string }> = {};
      for (const m of klass.marks) {
        mp[m.student] = { status: m.status, note: m.note || '' };
      }
      setLocalMarks(mp);
    }
  }, [klass]);

  const saveMutation = useMutation({
    mutationFn: (payload: any) =>
      api.post(`/attendance/teacher/classes/${classId}/marks/`, payload),
    onSuccess: () => refetch(),
  });

  const markAllMutation = useMutation({
    mutationFn: () =>
      api.post(`/attendance/teacher/classes/${classId}/mark-all-present/`),
    onSuccess: () => refetch(),
  });

  const cycle = (studentId: string) => {
    const cur = localMarks[studentId]?.status || 'present';
    const idx = STATUS_CYCLE.indexOf(cur as any);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    const newMark = { ...(localMarks[studentId] || { note: '' }), status: next };
    setLocalMarks({ ...localMarks, [studentId]: newMark });
    saveMutation.mutate({ marks: [{ student_id: studentId, status: next, note: newMark.note }] });
  };

  if (!klass) return <div className="p-8">Loading…</div>;

  const studentList = klass.students;
  const counts = STATUS_CYCLE.reduce((acc: any, s) => ({ ...acc, [s]: 0 }), { not_marked: 0 });
  for (const s of studentList) {
    const m = localMarks[s.id];
    if (m) counts[m.status] = (counts[m.status] || 0) + 1;
    else counts.not_marked = (counts.not_marked || 0) + 1;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <button onClick={() => navigate('/teacher/attendance')}
              className="mb-3 text-sm text-gray-500">
        ← Back
      </button>
      <h1 className="text-xl font-bold">{klass.group.name || 'Class'}</h1>
      <p className="text-sm text-gray-600">
        {new Date(klass.date).toLocaleDateString()} · {studentList.length} students
        {klass.is_locked && (
          <span className="ml-2 rounded bg-gray-200 px-2 py-0.5 text-xs">🔒 Locked</span>
        )}
      </p>

      <div className="my-4 flex gap-2">
        <button
          onClick={() => markAllMutation.mutate()}
          disabled={markAllMutation.isPending || klass.is_locked}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:bg-gray-300"
        >
          ✓ Mark All Present
        </button>
        <div className="flex-1" />
        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs">
          ✓ {counts.present || 0}
        </span>
        <span className="rounded-full bg-red-100 px-3 py-1 text-xs">
          ✗ {counts.absent || 0}
        </span>
        <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs">
          L {counts.late || 0}
        </span>
      </div>

      <div className="space-y-1.5">
        {studentList.map((s: any, i: number) => {
          const m = localMarks[s.id];
          return (
            <div key={s.id}
                 className="flex items-center gap-3 rounded-lg border bg-white px-3 py-2.5 shadow-sm">
              <span className="w-7 text-right text-xs text-gray-400">{i + 1}.</span>
              <span className="flex-1 text-sm">{s.full_name}</span>
              <button
                onClick={() => !klass.is_locked && cycle(s.id)}
                disabled={klass.is_locked}
                className="min-w-[110px]"
              >
                <StatusBadge status={m?.status as any} />
              </button>
            </div>
          );
        })}
      </div>

      {klass.is_locked && (
        <p className="mt-4 text-center text-xs text-gray-500">
          🔒 This class is locked (72 hours have passed). Contact your admin to make changes.
        </p>
      )}
    </div>
  );
}
```

## 6.3 StatusBadge component — `frontend/src/components/attendance/StatusBadge.tsx`

```tsx
export const STATUS_CYCLE = ['present', 'absent', 'late', 'excused', 'sick'] as const;
export type StatusKey = typeof STATUS_CYCLE[number];

const META: Record<string, { label: string; symbol: string; className: string }> = {
  present: { label: 'Present', symbol: '✓', className: 'bg-green-100 text-green-700 border-green-300' },
  absent:  { label: 'Absent',  symbol: '✗', className: 'bg-red-100 text-red-700 border-red-300' },
  late:    { label: 'Late',    symbol: 'L', className: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  excused: { label: 'Excused', symbol: 'S', className: 'bg-blue-100 text-blue-700 border-blue-300' },
  sick:    { label: 'Sick',    symbol: 'K', className: 'bg-cyan-100 text-cyan-700 border-cyan-300' },
};

export function statusOf(s?: string) {
  return META[s || ''] || { label: '— Mark', symbol: '⚪', className: 'bg-gray-50 text-gray-400 border-gray-200 border-dashed' };
}

export function StatusBadge({ status }: { status?: string }) {
  const m = statusOf(status);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${m.className}`}>
      <span className="text-base">{m.symbol}</span>
      <span>{m.label}</span>
    </span>
  );
}
```

---

# PART 7 — STUDENT JOURNAL UI

`frontend/src/pages/student/StudentJournal.tsx`:

```tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { statusOf } from '@/components/attendance/StatusBadge';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function StudentJournal() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const { data } = useQuery({
    queryKey: ['student-journal', year, month],
    queryFn: () => api.get(`/attendance/student/journal/?year=${year}&month=${month}`)
                       .then(r => r.data),
  });

  const prev = () => {
    if (month === 1) { setYear(year - 1); setMonth(12); }
    else setMonth(month - 1);
  };
  const next = () => {
    if (month === 12) { setYear(year + 1); setMonth(1); }
    else setMonth(month + 1);
  };

  if (!data) return <div className="p-8">Loading…</div>;

  // Build weeks (Mon-Fri shown, Sat/Sun greyed)
  const weeks: any[][] = [];
  let currentWeek: any[] = [];
  // Add empty cells for weekday before first day
  if (data.days.length) {
    for (let i = 0; i < data.days[0].weekday; i++) currentWeek.push(null);
  }
  for (const d of data.days) {
    currentWeek.push(d);
    if (currentWeek.length === 7) { weeks.push(currentWeek); currentWeek = []; }
  }
  if (currentWeek.length) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="text-2xl font-bold">My Attendance</h1>

      <div className="mt-4 flex items-center justify-between">
        <button onClick={prev} className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50">
          ← Previous
        </button>
        <h2 className="text-lg font-semibold">{MONTH_NAMES[month - 1]} {year}</h2>
        <button onClick={next} className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50">
          Next →
        </button>
      </div>

      {/* Calendar grid */}
      <div className="mt-6 rounded-xl border bg-white p-4">
        <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs font-medium uppercase tracking-wider text-gray-400">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="space-y-1">
          {weeks.map((w, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-1">
              {w.map((d: any, di: number) => {
                if (!d) {
                  return <div key={di} className="aspect-square rounded bg-gray-50" />;
                }
                const m = d.mark;
                const meta = m ? statusOf(m.status) : null;
                return (
                  <div key={di}
                       title={m ? `${m.status}${m.note ? ': ' + m.note : ''}` : ''}
                       className={`aspect-square flex flex-col items-center justify-center rounded text-xs font-medium ${
                         meta ? meta.className : 'border bg-gray-50 text-gray-400'
                       }`}>
                    <span className="text-[10px] opacity-70">{d.day}</span>
                    {meta && <span className="text-base">{meta.symbol}</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="mt-6 rounded-xl border bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
          Monthly stats
        </h3>
        <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
          <Stat label="Total lessons" value={data.totals.total_lessons} />
          <Stat label="Present" value={data.totals.present} color="text-green-600" />
          <Stat label="Late" value={data.totals.late} color="text-yellow-600" />
          <Stat label="Excused" value={data.totals.excused} color="text-blue-600" />
          <Stat label="Sick" value={data.totals.sick} color="text-cyan-600" />
          <Stat label="Absent" value={data.totals.absent} color="text-red-600" />
        </div>
        <div className="mt-4 border-t pt-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Attendance rate</span>
            <span className={`text-3xl font-bold ${
              data.totals.attendance_percent >= 90 ? 'text-green-600' :
              data.totals.attendance_percent >= 75 ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {data.totals.attendance_percent}%
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200">
            <div
              className={`h-full ${
                data.totals.attendance_percent >= 90 ? 'bg-green-500' :
                data.totals.attendance_percent >= 75 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${data.totals.attendance_percent}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <a href={`/api/v1/attendance/student/journal/export-pdf/?year=${year}&month=${month}`}
           target="_blank" rel="noreferrer"
           className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white">
          📄 Download PDF
        </a>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: any; color?: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-gray-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${color || 'text-gray-900'}`}>{value}</div>
    </div>
  );
}
```

---

# PART 8 — ADMIN DASHBOARD

`frontend/src/pages/center/AdminAttendanceDashboard.tsx`:

```tsx
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export default function AdminAttendanceDashboard() {
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => api.get('/attendance/admin/dashboard/today/').then(r => r.data),
    refetchInterval: 15_000,
  });

  const { data: escalations } = useQuery({
    queryKey: ['escalations'],
    queryFn: () => api.get('/attendance/admin/escalations/').then(r => r.data.results || r.data),
    refetchInterval: 60_000,
  });

  if (!data) return <div className="p-8">Loading…</div>;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="mb-2 text-2xl font-bold">Attendance — Today</h1>
      <p className="mb-6 text-sm text-gray-600">
        {new Date(data.date).toLocaleDateString(undefined, {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        })} · Auto-refreshes every 15s
      </p>

      {/* Active classes */}
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
        Today's classes
      </h2>
      <div className="space-y-2">
        {data.groups.map((g: any) => {
          const colorClass = !g.started ? 'bg-gray-100 text-gray-500' :
            g.attendance_percent >= 90 ? 'bg-green-50 border-green-200' :
            g.attendance_percent >= 75 ? 'bg-yellow-50 border-yellow-200' :
            'bg-red-50 border-red-200';
          return (
            <div key={g.group_id}
                 className={`rounded-lg border p-3 ${colorClass}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">{g.group_name}</h3>
                  <p className="text-xs text-gray-600">
                    Teacher: {g.teacher || '—'} · {g.students_count} students
                  </p>
                </div>
                <div className="text-right">
                  {g.started ? (
                    <>
                      <div className="text-2xl font-bold">{g.attendance_percent}%</div>
                      <div className="text-xs text-gray-600">
                        ✓ {g.present + g.late + g.excused + g.sick} / {g.students_count}
                      </div>
                    </>
                  ) : (
                    <span className="text-sm text-gray-500">⏳ Not started</span>
                  )}
                </div>
              </div>
              {g.started && (
                <div className="mt-2 flex gap-2 text-xs">
                  <span>✓ {g.present}</span>
                  <span>L {g.late}</span>
                  <span>S {g.excused}</span>
                  <span>K {g.sick}</span>
                  <span className="font-medium text-red-700">✗ {g.absent}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Escalations */}
      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wider text-gray-500">
        ⚠️ Active escalations
      </h2>
      {!escalations || escalations.length === 0 ? (
        <div className="rounded-lg border bg-gray-50 p-6 text-center text-sm text-gray-500">
          No active escalations. 🎉
        </div>
      ) : (
        <div className="space-y-2">
          {escalations.map((e: any) => (
            <div key={e.id}
                 className={`rounded-lg border p-3 ${
                   e.tier === 'removal' ? 'border-red-300 bg-red-50' :
                   e.tier === 'reprimand' ? 'border-orange-300 bg-orange-50' :
                   'border-yellow-300 bg-yellow-50'
                 }`}>
              <div className="flex items-center justify-between">
                <div>
                  <strong>{e.student_name}</strong> · {e.group_name}
                  <p className="text-xs text-gray-600">
                    Tier: {e.tier} · {e.absence_count} absences in last 30 days
                  </p>
                </div>
                <button
                  onClick={() => api.post(`/attendance/admin/escalations/${e.id}/resolve/`,
                                          { note: 'Resolved by admin' })}
                  className="rounded border bg-white px-3 py-1.5 text-xs hover:bg-gray-50"
                >
                  Mark resolved
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

# PART 9 — VERIFICATION CHECKLIST

Before declaring done, verify each:

## Backend
- [ ] `python manage.py migrate` runs cleanly
- [ ] Creating an `AttendanceClass` for a group on today's date works
- [ ] Two attempts on the same group/date return the existing class (unique constraint)
- [ ] `Mark All Present` creates marks only for un-marked students
- [ ] After 72 hours, class becomes locked → PATCH returns 400
- [ ] Manual run of `python manage.py lock_old_attendance` locks old classes
- [ ] 3 absences trigger `WARNING` escalation; 5 triggers `REPRIMAND`; 10 triggers `REMOVAL`
- [ ] Escalation does NOT duplicate when threshold already had an active row

## Telegram bot
- [ ] Bot token in `.env`, webhook registered with Telegram
- [ ] `/start <code>` from a parent's Telegram creates a `TelegramBinding`
- [ ] After teacher marks attendance, parent receives a Telegram message
- [ ] `/stop` from parent disables notifications

## Teacher UI
- [ ] `/teacher/attendance` shows today's groups
- [ ] Click "Start attendance" → creates class, navigates to marker
- [ ] Click student row → status cycles: Present → Absent → Late → Excused → Sick → Present
- [ ] "Mark All Present" works with one click
- [ ] After 72 hours, marker shows lock icon and disables editing

## Student UI
- [ ] `/student/attendance` shows current month's calendar grid
- [ ] Days with marks show colored symbols (✓/✗/L/S/K)
- [ ] Empty days show "—"
- [ ] Stats panel shows correct counts and overall percentage
- [ ] Previous/Next month navigation works
- [ ] PDF export downloads correctly

## Admin UI
- [ ] `/center/attendance` shows all groups with today's status
- [ ] Page auto-refreshes every 15s
- [ ] Color coding: green ≥90%, yellow ≥75%, red <75%
- [ ] Escalations list shows active ones, sorted by tier
- [ ] "Mark resolved" closes an escalation
- [ ] Excel export downloads a properly-formatted spreadsheet

---

# PART 10 — DEPLOYMENT

```bash
# Local
cd ildizmock
git add .
git commit -m "ETAP 28: Attendance journal — 5 statuses, Mark All Present, 72h lock, Telegram notifications, escalations"
git push origin main

# Server
ssh ildiz@207.180.226.230
cd /home/ildiz/ildizmock
git stash
git pull origin main
git stash pop

cd backend
source venv/bin/activate
pip install -r requirements.txt --break-system-packages
python manage.py migrate

# Add cron for auto-lock (one-time setup)
crontab -e
# Append: 0 * * * * cd /home/ildiz/ildizmock/backend && /home/ildiz/ildizmock/backend/venv/bin/python manage.py lock_old_attendance >> /tmp/attendance_lock.log 2>&1

# Set Telegram webhook (one-time setup, replace TOKEN)
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
     -d "url=https://ildiz-testing.uz/api/v1/attendance/telegram/webhook/"

cd ../frontend
npm install
npm run build

sudo supervisorctl restart ildizmock
sudo systemctl reload nginx

# Smoke test
curl -I https://ildiz-testing.uz/teacher/attendance
curl -I https://ildiz-testing.uz/student/attendance
sudo supervisorctl tail -f ildizmock stderr
```

---

# 🟢 MANDATORY GIT WORKFLOW

```bash
git add .
git commit -m "ETAP 28: Attendance journal — 5 statuses, Mark All Present, 72h lock, Telegram notifications, escalations"
git push origin main
```

Cursor Agent: do not stop before pushing. Local-only changes are not acceptable.

---

# ⚙️ BUILD ORDER

| # | Task | Hours |
|---|------|------:|
| 1 | Models + migration (PART 1) | 1 |
| 2 | Escalation service + lock command (PART 2) | 1 |
| 3 | Telegram bot service + webhook (PART 3) | 2 |
| 4 | Backend teacher views (PART 4.1) | 2 |
| 5 | Backend student views + PDF export (PART 4.2) | 2 |
| 6 | Backend admin views + Excel export (PART 4.3) | 1.5 |
| 7 | Serializers (PART 4.4) | 0.5 |
| 8 | Frontend routes (PART 5) | 0.2 |
| 9 | StatusBadge component (PART 6.3) | 0.3 |
| 10 | Teacher Today page (PART 6.1) | 1 |
| 11 | Teacher Class Marker (PART 6.2) | 2 |
| 12 | Student Journal — calendar grid (PART 7) | 2.5 |
| 13 | Admin Dashboard (PART 8) | 1.5 |
| 14 | Verification (PART 9) | 1.5 |
| 15 | Deploy + cron + Telegram webhook (PART 10) | 1 |

**Total: ~20 hours = 2.5 working days for one engineer.**

---

# 📌 WHAT THIS ETAP DOES NOT DO

- Does not add QR / biometric / GPS / face recognition
- Does not modify ILDIZ Library
- Does not send SMS (Telegram only)
- Does not include analytics charts (deferred to ETAP 29)
- Does not allow custom escalation thresholds (hardcoded 3 / 5 / 10)
- Does not support multi-class bulk attendance editing

---

After this ETAP ships:
- Teachers mark attendance in **15 seconds** per class via Mark All Present + 2-3 corrections
- Students see a **monthly calendar grid** with their full attendance history
- Parents get **automatic Telegram messages** for every mark
- Center admins see a **real-time dashboard** of all classes today
- Late absences automatically **escalate** to admin attention at 3 / 5 / 10 thresholds
- Marks become **locked after 72 hours** — preventing tampering with old records
- Excel and PDF exports give physical copies for paperwork

---

**END OF ETAP 28.**
