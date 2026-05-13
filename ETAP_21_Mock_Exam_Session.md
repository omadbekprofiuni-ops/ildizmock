# ETAP 21: B2B Mock Exam Session (Markaz mock imtihoni)

## Kontekst

O'quv markazlar mock imtihon (real IELTS-ga o'xshatish) kunlari o'tkazadi. Hozirgi platformada bu **alohida flow yo'q** — testlar faqat shaxsiy mashq sifatida ishlatiladi. Bu ETAP'da real imtihon kunini taqlid qiladigan to'liq tizim quramiz:

- Center admin **Mock Session** yaratadi (sana, vaqt, qaysi testlar)
- Admin **talabalarni qo'shadi** — har biriga avtomatik **Exam Taker ID** (masalan `IELTS-2026-0001`)
- Mock kuni talaba **o'z ismini tanlab** check-in qiladi va exam taker ID'ni ko'radi
- Talaba **3 ta bo'limni** ketma-ket ishlaydi: Listening → Reading → Writing
- Tugagach talabaga **natija ko'rsatilmaydi** — faqat "Test topshirildi" xabari
- **Speaking yo'q** — markaz uni face-to-face oladi va keyin Excel'ga qo'lda yozadi
- O'qituvchi **anonim** ravishda (faqat Exam Taker ID bilan, ism ko'rinmaydi) Writing essay'larini baholaydi
- Writing **Task 1 + Task 2 alohida** baholanadi, og'irlikli o'rtacha (Task 2 = 2× og'irlik)
- Platforma **overall band** ni avtomatik hisoblaydi (L + R + W bo'yicha)
- Admin **Excel'ga eksport** qiladi (Exam Taker ID, F.I.O, L band, R band, W band, Overall)

**Bu ETAP-da YO'Q:** Speaking integratsiyasi (alohida ETAP), B2C bilan bog'liqlik (bu faqat B2B), to'lov.

## Anonim grading printsipi

Real IELTS standartiga yaqin: o'qituvchi essay baholayotganda **kim yozganini bilmaydi** — faqat exam taker ID ko'rinadi. Bu adolatlilikni ta'minlaydi (o'qituvchi sevimli talaba'ga yuqori, sevmaganiga past qo'ya olmaydi). Admin keyin grading tugagach ID → ism mapping orqali kim kimligini ko'radi va eksport qiladi.

## Loyihaning hozirgi holati

- Django 5.x + PostgreSQL + Tailwind + Alpine.js + Chart.js + React (vite SPA frontend)
- Multi-tenant: center slug URL'larda (`/<slug>/admin/...`)
- Mavjud Test modeli (UUID), Passage, ListeningPart, Question — ETAP 16.7 audit'idan ma'lum
- Question turlari: mcq, tfng, fill, matching
- ETAP 20'dan: Session (regular dars sessiyasi), AttendanceRecord — bu Mock Session emas, alohida
- ETAP 16-17'dan: B2C test catalog va credit (mock'ga aloqasi yo'q)
- Mavjud test runner B2B kontekstida ishlaydi (sessions/groups orqali) — biz uni mock mode'iga moslashtramiz

## ETAP yakunidagi natija

1. 5 ta yangi model: `MockExamSession`, `MockExamParticipant`, `MockExamAttempt`, `WritingTaskResponse`, `WritingTaskGrade`
2. Exam Taker ID avtomatik generatsiya: `IELTS-YYYY-NNNN`
3. Admin: Mock session CRUD, talaba qo'shish, real-time monitoring, grading queue, Excel eksport
4. Teacher: anonim grading sahifa (faqat ID ko'rinadi)
5. Student: check-in → test ishlash → "Topshirildi" xabari (natija yo'q)
6. Auto-scoring: Listening + Reading (band scale jadval bilan)
7. Manual grading: Writing (Task 1 band + Task 2 band, og'irlikli o'rtacha)
8. Platforma overall band hisoblaydi
9. Excel eksport (openpyxl orqali, mock natijalari bilan)
10. Mavjud test runner mock mode'da: progress, taymer, lekin natija ko'rsatmaydi
11. Git push muvaffaqiyatli

---

## 1-bosqich: Modellar

### `apps/mock_exams/models.py` (yangi app)

```bash
python manage.py startapp mock_exams apps/mock_exams
```

`settings.py` `INSTALLED_APPS` ga `apps.mock_exams` qo'shing.

```python
import uuid
import secrets
from django.conf import settings
from django.db import models
from django.utils import timezone


def generate_exam_taker_id(session):
    """
    Yangi exam taker ID generatsiya qiladi.
    Format: IELTS-YYYY-NNNN (masalan IELTS-2026-0042)
    Session ichida unique, lekin yil bo'yicha global counter.
    """
    year = session.date.year
    
    # Shu yilda umumiy nechta exam taker bo'lganini hisoblab, +1
    last_id = MockExamParticipant.objects.filter(
        exam_taker_id__startswith=f"IELTS-{year}-"
    ).order_by("-exam_taker_id").first()
    
    if last_id:
        try:
            last_number = int(last_id.exam_taker_id.split("-")[-1])
            new_number = last_number + 1
        except (ValueError, IndexError):
            new_number = 1
    else:
        new_number = 1
    
    return f"IELTS-{year}-{new_number:04d}"


class MockExamSession(models.Model):
    """
    Markaz tomonidan tashkil etilgan mock imtihon kuni.
    Bir kunda bir necha session bo'lishi mumkin (ertalab/kechqurun).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    center = models.ForeignKey(
        "centers.Center",  # haqiqiy import yo'lini moslang
        on_delete=models.CASCADE,
        related_name="mock_sessions",
    )
    
    name = models.CharField(
        max_length=200,
        help_text="Masalan: 'Mock #5 — 12 May 2026 ertalabki'",
    )
    
    date = models.DateField(db_index=True)
    start_time = models.TimeField()
    end_time = models.TimeField(null=True, blank=True)
    
    # Qaysi testlar ishlatiladi (admin tanlaydi)
    listening_test = models.ForeignKey(
        "tests.Test", on_delete=models.PROTECT,
        related_name="mock_sessions_as_listening",
        limit_choices_to={"section_type": "listening"},  # haqiqiy field nomini moslang
    )
    reading_test = models.ForeignKey(
        "tests.Test", on_delete=models.PROTECT,
        related_name="mock_sessions_as_reading",
        limit_choices_to={"section_type": "reading"},
    )
    writing_test = models.ForeignKey(
        "tests.Test", on_delete=models.PROTECT,
        related_name="mock_sessions_as_writing",
        limit_choices_to={"section_type": "writing"},
    )
    
    class Status(models.TextChoices):
        DRAFT = "draft", "Qoralama"
        OPEN_FOR_CHECKIN = "open_for_checkin", "Check-in ochiq"
        IN_PROGRESS = "in_progress", "Davom etmoqda"
        SUBMITTED = "submitted", "Topshirildi (grading kutmoqda)"
        GRADING = "grading", "Baholanmoqda"
        COMPLETED = "completed", "Tugadi"
        CANCELLED = "cancelled", "Bekor qilingan"
    
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.DRAFT, db_index=True)
    
    instructions = models.TextField(blank=True, help_text="Talabalarga ko'rsatiladigan ko'rsatmalar")
    
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, related_name="created_mock_sessions",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    started_at = models.DateTimeField(null=True, blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    # Speaking — bu platformada emas, admin keyin qo'lda eksport oxirida qo'shadi
    
    class Meta:
        indexes = [models.Index(fields=["center", "date"])]
        ordering = ["-date", "-start_time"]
    
    def __str__(self):
        return f"{self.name} ({self.date})"
    
    @property
    def participants_count(self):
        return self.participants.count()
    
    @property
    def checked_in_count(self):
        return self.participants.exclude(checked_in_at__isnull=True).count()


class MockExamParticipant(models.Model):
    """
    Mock'ga qo'shilgan har bir talaba.
    Exam taker ID — har talabaga unique, real IELTS candidate ID kabi.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    session = models.ForeignKey(MockExamSession, on_delete=models.CASCADE, related_name="participants")
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name="mock_participations",
        limit_choices_to={"user_type": "b2b_student"},
    )
    
    exam_taker_id = models.CharField(max_length=30, unique=True, db_index=True)
    
    class Status(models.TextChoices):
        REGISTERED = "registered", "Ro'yxatdan o'tkazilgan"
        CHECKED_IN = "checked_in", "Check-in qilgan"
        IN_PROGRESS = "in_progress", "Test ishlamoqda"
        SUBMITTED = "submitted", "Test topshirgan"
        GRADING = "grading", "Baholanmoqda"
        COMPLETED = "completed", "Yakuniy ball mavjud"
    
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.REGISTERED, db_index=True)
    
    checked_in_at = models.DateTimeField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    
    # Yakuniy ballar (grading tugagach to'ldiriladi)
    listening_band = models.DecimalField(max_digits=3, decimal_places=1, null=True, blank=True)
    reading_band = models.DecimalField(max_digits=3, decimal_places=1, null=True, blank=True)
    writing_band = models.DecimalField(max_digits=3, decimal_places=1, null=True, blank=True)
    speaking_band = models.DecimalField(
        max_digits=3, decimal_places=1, null=True, blank=True,
        help_text="Admin Excel eksportdan oldin qo'lda kiritadi (face-to-face baholash)",
    )
    overall_band = models.DecimalField(max_digits=3, decimal_places=1, null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = [("session", "student")]
        indexes = [
            models.Index(fields=["session", "status"]),
            models.Index(fields=["exam_taker_id"]),
        ]
        ordering = ["exam_taker_id"]
    
    def __str__(self):
        return f"{self.exam_taker_id} — {self.student.get_full_name()}"
    
    def save(self, *args, **kwargs):
        if not self.exam_taker_id:
            self.exam_taker_id = generate_exam_taker_id(self.session)
        super().save(*args, **kwargs)


class MockExamAttempt(models.Model):
    """
    Talabaning bitta bo'lim ustida ishlashi.
    Section bo'yicha 3 ta attempt har talaba uchun (Listening/Reading/Writing).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    participant = models.ForeignKey(
        MockExamParticipant, on_delete=models.CASCADE, related_name="attempts",
    )
    
    class Section(models.TextChoices):
        LISTENING = "listening", "Listening"
        READING = "reading", "Reading"
        WRITING = "writing", "Writing"
    
    section = models.CharField(max_length=20, choices=Section.choices)
    
    test = models.ForeignKey("tests.Test", on_delete=models.PROTECT)
    
    class Status(models.TextChoices):
        NOT_STARTED = "not_started", "Boshlanmagan"
        IN_PROGRESS = "in_progress", "Davom etmoqda"
        SUBMITTED = "submitted", "Topshirilgan"
        AUTO_SCORED = "auto_scored", "Avtomatik baholandi"
        GRADED = "graded", "Baholangan"
    
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.NOT_STARTED, db_index=True)
    
    started_at = models.DateTimeField(null=True, blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    
    # Auto-scoring (Listening/Reading uchun)
    correct_answers = models.PositiveSmallIntegerField(default=0)
    total_questions = models.PositiveSmallIntegerField(default=0)
    auto_band = models.DecimalField(max_digits=3, decimal_places=1, null=True, blank=True)
    
    # Manual grading (Writing uchun)
    manual_band = models.DecimalField(max_digits=3, decimal_places=1, null=True, blank=True)
    graded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="graded_mock_attempts",
    )
    graded_at = models.DateTimeField(null=True, blank=True)
    teacher_notes = models.TextField(blank=True)
    
    # Foydalanuvchi javoblari (auto-scoring uchun)
    answers_json = models.JSONField(default=dict, blank=True)
    # {"question_id": "answer", ...} ko'rinishida
    
    class Meta:
        unique_together = [("participant", "section")]
        indexes = [models.Index(fields=["status", "section"])]
    
    def __str__(self):
        return f"{self.participant.exam_taker_id} — {self.section} — {self.status}"
    
    @property
    def final_band(self):
        """Bu attempt uchun yakuniy ball — auto yoki manual."""
        if self.section in ("listening", "reading"):
            return self.auto_band
        return self.manual_band


class WritingTaskResponse(models.Model):
    """
    Writing attempt ichida Task 1 va Task 2 alohida saqlanadi.
    Har biri alohida teacher tomonidan baholanadi.
    """
    attempt = models.ForeignKey(
        MockExamAttempt, on_delete=models.CASCADE, related_name="writing_tasks",
    )
    
    class TaskNumber(models.IntegerChoices):
        TASK_1 = 1, "Task 1"
        TASK_2 = 2, "Task 2"
    
    task_number = models.PositiveSmallIntegerField(choices=TaskNumber.choices)
    
    response_text = models.TextField(help_text="Talabaning yozma ishi")
    word_count = models.PositiveSmallIntegerField(default=0)
    
    submitted_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        unique_together = [("attempt", "task_number")]
        ordering = ["task_number"]


class WritingTaskGrade(models.Model):
    """
    Bitta WritingTaskResponse uchun teacher baholashi.
    Anonim — teacher kim yozganini ko'rmaydi, faqat exam taker ID.
    """
    task_response = models.OneToOneField(
        WritingTaskResponse, on_delete=models.CASCADE, related_name="grade",
    )
    
    band = models.DecimalField(
        max_digits=3, decimal_places=1,
        help_text="0.0 — 9.0 (0.5 qadam)",
    )
    
    feedback = models.TextField(blank=True, help_text="Teacher fikri (talabaga ko'rinmaydi)")
    
    graded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True,
        related_name="given_writing_grades",
    )
    graded_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Admin override
    override_band = models.DecimalField(
        max_digits=3, decimal_places=1, null=True, blank=True,
        help_text="Admin tomonidan o'zgartirilgan (asl bahodan farq qilsa)",
    )
    override_reason = models.TextField(blank=True)
    overridden_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="overridden_writing_grades",
    )
    overridden_at = models.DateTimeField(null=True, blank=True)
    
    @property
    def effective_band(self):
        return self.override_band if self.override_band is not None else self.band
```

Migration:
```bash
python manage.py makemigrations mock_exams
python manage.py migrate
```

---

## 2-bosqich: Auto-scoring band table

### `apps/mock_exams/services/band_calculator.py`

```python
"""
IELTS band scale conversion.
Real IELTS jadvali asosida (taxminiy, markaz xohlasa moslab oladi).
"""
from decimal import Decimal


# Listening 40 savol uchun band conversion (real IELTS Academic)
LISTENING_BAND_TABLE = {
    (39, 40): Decimal("9.0"),
    (37, 38): Decimal("8.5"),
    (35, 36): Decimal("8.0"),
    (32, 34): Decimal("7.5"),
    (30, 31): Decimal("7.0"),
    (26, 29): Decimal("6.5"),
    (23, 25): Decimal("6.0"),
    (18, 22): Decimal("5.5"),
    (16, 17): Decimal("5.0"),
    (13, 15): Decimal("4.5"),
    (11, 12): Decimal("4.0"),
    (8, 10): Decimal("3.5"),
    (6, 7): Decimal("3.0"),
    (4, 5): Decimal("2.5"),
    (0, 3): Decimal("2.0"),
}

# Reading Academic 40 savol uchun
READING_BAND_TABLE = {
    (39, 40): Decimal("9.0"),
    (37, 38): Decimal("8.5"),
    (35, 36): Decimal("8.0"),
    (33, 34): Decimal("7.5"),
    (30, 32): Decimal("7.0"),
    (27, 29): Decimal("6.5"),
    (23, 26): Decimal("6.0"),
    (19, 22): Decimal("5.5"),
    (15, 18): Decimal("5.0"),
    (13, 14): Decimal("4.5"),
    (10, 12): Decimal("4.0"),
    (8, 9): Decimal("3.5"),
    (6, 7): Decimal("3.0"),
    (4, 5): Decimal("2.5"),
    (0, 3): Decimal("2.0"),
}


def score_to_band(correct: int, section: str) -> Decimal:
    """Listening yoki Reading correct count'ni band'ga aylantiradi."""
    table = LISTENING_BAND_TABLE if section == "listening" else READING_BAND_TABLE
    for (lo, hi), band in table.items():
        if lo <= correct <= hi:
            return band
    return Decimal("0.0")


def calculate_writing_band(task1_band: Decimal, task2_band: Decimal) -> Decimal:
    """
    Writing yakuniy band: (Task1 + 2×Task2) / 3, eng yaqin 0.5 ga yaxlitlanadi.
    Real IELTS standartida Task 2 og'irligi katta.
    """
    raw = (task1_band + 2 * task2_band) / 3
    return round_to_half(raw)


def calculate_overall_band(listening, reading, writing, speaking=None) -> Decimal:
    """
    Overall: 4 (yoki 3) bo'lim o'rtachasi, 0.5 ga yaxlitlanadi.
    Speaking yo'q bo'lsa 3 bo'lim o'rtachasi.
    """
    parts = [b for b in [listening, reading, writing, speaking] if b is not None]
    if not parts:
        return None
    raw = sum(parts) / len(parts)
    return round_to_half(raw)


def round_to_half(value: Decimal) -> Decimal:
    """
    IELTS yaxlitlash qoidalari:
    - .25 va undan past → past 0.5 ga
    - .25 dan baland → yuqori 0.5 ga
    Aslida real IELTS biroz boshqacha (bank rounding), lekin shu yetadi MVP uchun.
    """
    integer_part = int(value)
    decimal_part = float(value) - integer_part
    
    if decimal_part < 0.25:
        return Decimal(f"{integer_part}.0")
    if decimal_part < 0.75:
        return Decimal(f"{integer_part}.5")
    return Decimal(f"{integer_part + 1}.0")
```

---

## 3-bosqich: Services — session management

### `apps/mock_exams/services/sessions.py`

```python
from datetime import datetime
from django.db import transaction
from django.utils import timezone
from ..models import (
    MockExamSession, MockExamParticipant, MockExamAttempt, WritingTaskResponse,
)


@transaction.atomic
def create_mock_session(center, *, name, date, start_time, end_time,
                       listening_test, reading_test, writing_test,
                       instructions, created_by):
    """Yangi mock session yaratish."""
    session = MockExamSession.objects.create(
        center=center, name=name, date=date,
        start_time=start_time, end_time=end_time,
        listening_test=listening_test,
        reading_test=reading_test,
        writing_test=writing_test,
        instructions=instructions,
        created_by=created_by,
        status=MockExamSession.Status.DRAFT,
    )
    return session


@transaction.atomic
def add_participants(session, students):
    """Mock session'ga talabalarni qo'shadi va exam taker ID beradi."""
    added = []
    for student in students:
        # Allaqachon qo'shilganmi?
        if MockExamParticipant.objects.filter(session=session, student=student).exists():
            continue
        
        participant = MockExamParticipant.objects.create(
            session=session, student=student,
            # exam_taker_id avtomatik save() ichida
        )
        
        # 3 ta attempt yaratish (bo'sh)
        for section, test_field in [
            ("listening", session.listening_test),
            ("reading", session.reading_test),
            ("writing", session.writing_test),
        ]:
            MockExamAttempt.objects.create(
                participant=participant,
                section=section,
                test=test_field,
            )
        
        added.append(participant)
    
    return added


def remove_participant(participant):
    """Talabani mock'dan olib tashlash (faqat status=registered bo'lganda)."""
    if participant.status != MockExamParticipant.Status.REGISTERED:
        raise ValueError("Faqat check-in qilmagan talabani olib tashlash mumkin")
    participant.delete()


@transaction.atomic
def open_for_checkin(session):
    """Mock session check-in'ga ochilsin."""
    if session.status != MockExamSession.Status.DRAFT:
        raise ValueError(f"Faqat draft holatdan ochish mumkin (hozir: {session.status})")
    if session.participants.count() == 0:
        raise ValueError("Avval talabalarni qo'shing")
    
    session.status = MockExamSession.Status.OPEN_FOR_CHECKIN
    session.save(update_fields=["status"])


def check_in_participant(session, student):
    """Talaba o'z ismini tanlab check-in qiladi."""
    if session.status not in (MockExamSession.Status.OPEN_FOR_CHECKIN, MockExamSession.Status.IN_PROGRESS):
        raise ValueError("Bu mock'ga check-in qilib bo'lmaydi")
    
    try:
        participant = MockExamParticipant.objects.get(session=session, student=student)
    except MockExamParticipant.DoesNotExist:
        raise ValueError("Siz bu mock'ga ro'yxatdan o'tkazilmagansiz")
    
    if participant.status != MockExamParticipant.Status.REGISTERED:
        # Allaqachon check-in qilingan — qaytadan emas, hozirgi holatni qaytaramiz
        return participant
    
    participant.status = MockExamParticipant.Status.CHECKED_IN
    participant.checked_in_at = timezone.now()
    participant.save(update_fields=["status", "checked_in_at"])
    return participant


@transaction.atomic
def start_session(session):
    """Admin testni boshlaydi — barcha checked_in talabalar test ishlay oladi."""
    if session.status != MockExamSession.Status.OPEN_FOR_CHECKIN:
        raise ValueError("Avval check-in'ni oching")
    
    session.status = MockExamSession.Status.IN_PROGRESS
    session.started_at = timezone.now()
    session.save(update_fields=["status", "started_at"])


def get_session_monitoring(session):
    """Admin uchun real-time monitoring data."""
    participants = session.participants.select_related("student").all()
    
    by_status = {}
    for p in participants:
        by_status.setdefault(p.status, 0)
        by_status[p.status] += 1
    
    return {
        "total": participants.count(),
        "registered": by_status.get("registered", 0),
        "checked_in": by_status.get("checked_in", 0),
        "in_progress": by_status.get("in_progress", 0),
        "submitted": by_status.get("submitted", 0),
        "grading": by_status.get("grading", 0),
        "completed": by_status.get("completed", 0),
    }
```

### `apps/mock_exams/services/grading.py`

```python
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from .band_calculator import (
    score_to_band, calculate_writing_band, calculate_overall_band,
)


def auto_score_attempt(attempt):
    """
    Listening yoki Reading attempt'ni avtomatik baholaydi.
    answers_json'da {question_id: answer} bor.
    Test'dagi to'g'ri javoblar bilan solishtirib correct count chiqaradi.
    """
    if attempt.section not in ("listening", "reading"):
        return None
    
    # Test'dan to'g'ri javoblarni olamiz (haqiqiy Question model strukturasiga moslang)
    correct_count = 0
    total_count = 0
    
    questions = attempt.test.questions.all()  # haqiqiy rel'ga moslang
    
    for question in questions:
        total_count += 1
        student_answer = attempt.answers_json.get(str(question.id), "")
        correct_answer = question.correct_answer  # haqiqiy field
        
        # Solishtirish (case-insensitive, trim)
        if isinstance(student_answer, str) and isinstance(correct_answer, str):
            if student_answer.strip().lower() == correct_answer.strip().lower():
                correct_count += 1
        elif student_answer == correct_answer:
            correct_count += 1
    
    band = score_to_band(correct_count, attempt.section)
    
    attempt.correct_answers = correct_count
    attempt.total_questions = total_count
    attempt.auto_band = band
    attempt.status = "auto_scored"
    attempt.save()
    
    # Participant'ning band'ini ham yangilaymiz
    if attempt.section == "listening":
        attempt.participant.listening_band = band
    else:
        attempt.participant.reading_band = band
    attempt.participant.save()
    
    _recalculate_overall(attempt.participant)
    
    return band


@transaction.atomic
def grade_writing_task(task_response, *, band, feedback, graded_by):
    """Teacher Writing task'ni baholaydi."""
    from ..models import WritingTaskGrade
    
    grade, _ = WritingTaskGrade.objects.update_or_create(
        task_response=task_response,
        defaults={
            "band": band,
            "feedback": feedback,
            "graded_by": graded_by,
        },
    )
    
    # Agar har ikkala task baholangan bo'lsa, attempt'ni grading tugatamiz
    attempt = task_response.attempt
    task1_grade = attempt.writing_tasks.filter(task_number=1).first()
    task2_grade = attempt.writing_tasks.filter(task_number=2).first()
    
    if task1_grade and task2_grade and hasattr(task1_grade, "grade") and hasattr(task2_grade, "grade"):
        # Ikkala task baholangan — yakuniy Writing band
        writing_band = calculate_writing_band(
            task1_grade.grade.effective_band,
            task2_grade.grade.effective_band,
        )
        attempt.manual_band = writing_band
        attempt.status = "graded"
        attempt.graded_by = graded_by
        attempt.graded_at = timezone.now()
        attempt.save()
        
        attempt.participant.writing_band = writing_band
        attempt.participant.save()
        
        _recalculate_overall(attempt.participant)
    
    return grade


@transaction.atomic
def override_writing_grade(grade, *, new_band, reason, overridden_by):
    """Admin teacher bahosini o'zgartiradi."""
    if not reason.strip():
        raise ValueError("Override sababi majburiy")
    
    grade.override_band = new_band
    grade.override_reason = reason
    grade.overridden_by = overridden_by
    grade.overridden_at = timezone.now()
    grade.save()
    
    # Writing band'ni qayta hisoblash
    attempt = grade.task_response.attempt
    task1 = attempt.writing_tasks.filter(task_number=1).first()
    task2 = attempt.writing_tasks.filter(task_number=2).first()
    
    if task1 and task2 and hasattr(task1, "grade") and hasattr(task2, "grade"):
        writing_band = calculate_writing_band(
            task1.grade.effective_band,
            task2.grade.effective_band,
        )
        attempt.manual_band = writing_band
        attempt.save()
        
        attempt.participant.writing_band = writing_band
        attempt.participant.save()
        
        _recalculate_overall(attempt.participant)


def _recalculate_overall(participant):
    """Participant'ning overall band'ini qayta hisoblash."""
    overall = calculate_overall_band(
        participant.listening_band,
        participant.reading_band,
        participant.writing_band,
        participant.speaking_band,
    )
    participant.overall_band = overall
    
    # Status update
    if (participant.listening_band and participant.reading_band
            and participant.writing_band):
        participant.status = "completed"
    
    participant.save(update_fields=["overall_band", "status"])


def set_speaking_band(participant, band, set_by):
    """Admin face-to-face speaking ballini qo'lda kiritadi."""
    if band < 0 or band > 9:
        raise ValueError("Band 0–9 oralig'ida bo'lishi kerak")
    
    participant.speaking_band = band
    participant.save(update_fields=["speaking_band"])
    
    _recalculate_overall(participant)
```

---

## 4-bosqich: Test runner — Mock mode

Mavjud test runner mock attempt'ga ulanadi. Kalit yangiliklari:

1. **Mock mode flag** — runner mock_attempt_id parametri qabul qiladi
2. **Natija ko'rsatmaslik** — submit'dan keyin to'g'ridan-to'g'ri "Test topshirildi" sahifa
3. **Sequential flow** — Listening tugagach Reading, Reading tugagach Writing
4. **Writing maxsus UI** — 2 ta task, har biri alohida textarea + word count

### Backend — `apps/mock_exams/views.py` start/submit endpoint'lar

```python
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.utils import timezone

from .models import (
    MockExamSession, MockExamParticipant, MockExamAttempt, WritingTaskResponse,
)
from .services import grading


class StudentSessionInfoView(APIView):
    """GET /api/v1/<slug>/mock/<session_id>/info — talaba uchun session ma'lumotlari."""
    
    def get(self, request, slug, session_id):
        session = get_object_or_404(MockExamSession, id=session_id)
        
        # Check-in ochiq bo'lsa, talabalar ro'yxati ko'rinadi
        participants = session.participants.select_related("student").all()
        
        return Response({
            "session": {
                "id": str(session.id),
                "name": session.name,
                "date": session.date,
                "start_time": session.start_time,
                "status": session.status,
                "instructions": session.instructions,
            },
            "participants": [
                {
                    "id": str(p.id),
                    "student_id": p.student.id,
                    "student_name": p.student.get_full_name(),
                    "exam_taker_id": p.exam_taker_id,
                    "is_checked_in": p.checked_in_at is not None,
                }
                for p in participants
            ],
        })


class CheckInView(APIView):
    """POST /api/v1/<slug>/mock/<session_id>/check-in/"""
    
    def post(self, request, slug, session_id):
        if not request.user.is_authenticated:
            return Response({"error": "Avval tizimga kiring"}, status=401)
        
        from .services.sessions import check_in_participant
        
        session = get_object_or_404(MockExamSession, id=session_id)
        
        try:
            participant = check_in_participant(session, request.user)
        except ValueError as e:
            return Response({"error": str(e)}, status=400)
        
        return Response({
            "exam_taker_id": participant.exam_taker_id,
            "status": participant.status,
            "checked_in_at": participant.checked_in_at,
        })


class StartAttemptView(APIView):
    """POST /api/v1/<slug>/mock/<session_id>/start-section/"""
    
    def post(self, request, slug, session_id):
        from .services.sessions import check_in_participant
        
        session = get_object_or_404(MockExamSession, id=session_id)
        section = request.data.get("section")  # listening/reading/writing
        
        if session.status != MockExamSession.Status.IN_PROGRESS:
            return Response({"error": "Mock hali boshlanmagan"}, status=400)
        
        try:
            participant = MockExamParticipant.objects.get(
                session=session, student=request.user,
            )
        except MockExamParticipant.DoesNotExist:
            return Response({"error": "Siz qatnashmaysiz"}, status=403)
        
        if participant.status not in ("checked_in", "in_progress"):
            return Response({"error": "Hozir test ishlay olmaysiz"}, status=400)
        
        attempt = MockExamAttempt.objects.get(participant=participant, section=section)
        
        if attempt.status == "not_started":
            attempt.status = "in_progress"
            attempt.started_at = timezone.now()
            attempt.save()
        
        # Participant statusini in_progress'ga
        if participant.status == "checked_in":
            participant.status = "in_progress"
            participant.started_at = timezone.now()
            participant.save()
        
        return Response({
            "attempt_id": str(attempt.id),
            "test_id": str(attempt.test.id),
            "section": section,
            "status": attempt.status,
            # Runner uchun kerakli boshqa ma'lumotlar (taymer, test struktura)
            # mavjud runner endpoint'ga moslang
        })


class SubmitAttemptView(APIView):
    """POST /api/v1/<slug>/mock/<session_id>/submit-section/"""
    
    def post(self, request, slug, session_id):
        section = request.data.get("section")
        answers = request.data.get("answers", {})  # {question_id: answer}
        # Writing uchun: {"task1": "...", "task2": "..."}
        
        session = get_object_or_404(MockExamSession, id=session_id)
        
        try:
            participant = MockExamParticipant.objects.get(
                session=session, student=request.user,
            )
        except MockExamParticipant.DoesNotExist:
            return Response({"error": "Siz qatnashmaysiz"}, status=403)
        
        attempt = MockExamAttempt.objects.get(participant=participant, section=section)
        
        if attempt.status in ("submitted", "auto_scored", "graded"):
            return Response({"error": "Allaqachon topshirilgan"}, status=400)
        
        with transaction.atomic():
            attempt.submitted_at = timezone.now()
            
            if section in ("listening", "reading"):
                attempt.answers_json = answers
                attempt.status = "submitted"
                attempt.save()
                grading.auto_score_attempt(attempt)
            
            elif section == "writing":
                # Task 1 va Task 2
                for task_num in (1, 2):
                    task_key = f"task{task_num}"
                    text = answers.get(task_key, "")
                    word_count = len(text.split())
                    
                    WritingTaskResponse.objects.update_or_create(
                        attempt=attempt, task_number=task_num,
                        defaults={
                            "response_text": text,
                            "word_count": word_count,
                            "submitted_at": timezone.now(),
                        },
                    )
                
                attempt.status = "submitted"
                attempt.save()
            
            # Hamma 3 ta bo'lim submit qilinganmi?
            all_submitted = all(
                a.status in ("submitted", "auto_scored", "graded")
                for a in participant.attempts.all()
            )
            if all_submitted:
                participant.status = "submitted"
                participant.submitted_at = timezone.now()
                participant.save()
                
                # Session ham — hamma submit qilganmi?
                all_session_submitted = all(
                    p.status in ("submitted", "grading", "completed")
                    for p in session.participants.all()
                )
                if all_session_submitted:
                    session.status = MockExamSession.Status.SUBMITTED
                    session.submitted_at = timezone.now()
                    session.save()
        
        return Response({"status": "submitted"})
```

URL'lar (loyihaning haqiqiy URL strukturasiga moslang):
```python
# apps/mock_exams/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path("mock/<uuid:session_id>/info/", views.StudentSessionInfoView.as_view()),
    path("mock/<uuid:session_id>/check-in/", views.CheckInView.as_view()),
    path("mock/<uuid:session_id>/start-section/", views.StartAttemptView.as_view()),
    path("mock/<uuid:session_id>/submit-section/", views.SubmitAttemptView.as_view()),
]
```

---

## 5-bosqich: Admin endpoints

### `apps/mock_exams/views_admin.py`

```python
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.http import HttpResponse

from .models import (
    MockExamSession, MockExamParticipant, MockExamAttempt,
    WritingTaskResponse, WritingTaskGrade,
)
from .services import sessions as session_svc
from .services import grading as grading_svc


def _admin_or_teacher(request):
    return (
        request.user.is_authenticated
        and request.user.user_type in ("b2b_admin", "b2b_teacher")
    )


def _admin_only(request):
    return request.user.is_authenticated and request.user.user_type == "b2b_admin"


class MockSessionListView(APIView):
    """GET /api/v1/<slug>/admin/mock-sessions/"""
    
    def get(self, request, slug):
        if not _admin_or_teacher(request):
            return Response(status=403)
        
        # Faqat shu center'ning mock'lari
        from apps.centers.models import Center
        center = get_object_or_404(Center, slug=slug)
        
        # Permission tekshiruvi (user shu center'dan ekanligi)
        if request.user.center != center:
            return Response(status=403)
        
        status_filter = request.query_params.get("status", "all")
        qs = MockExamSession.objects.filter(center=center)
        if status_filter != "all":
            qs = qs.filter(status=status_filter)
        
        qs = qs.order_by("-date", "-start_time")[:100]
        
        return Response({
            "sessions": [
                {
                    "id": str(s.id),
                    "name": s.name,
                    "date": s.date,
                    "start_time": s.start_time,
                    "status": s.status,
                    "status_display": s.get_status_display(),
                    "participants_count": s.participants_count,
                    "checked_in_count": s.checked_in_count,
                }
                for s in qs
            ],
        })


class MockSessionCreateView(APIView):
    """POST /api/v1/<slug>/admin/mock-sessions/"""
    
    def post(self, request, slug):
        if not _admin_only(request):
            return Response(status=403)
        
        from apps.centers.models import Center
        center = get_object_or_404(Center, slug=slug)
        if request.user.center != center:
            return Response(status=403)
        
        from apps.tests.models import Test
        
        try:
            session = session_svc.create_mock_session(
                center=center,
                name=request.data.get("name", ""),
                date=request.data.get("date"),
                start_time=request.data.get("start_time"),
                end_time=request.data.get("end_time"),
                listening_test=Test.objects.get(id=request.data.get("listening_test_id")),
                reading_test=Test.objects.get(id=request.data.get("reading_test_id")),
                writing_test=Test.objects.get(id=request.data.get("writing_test_id")),
                instructions=request.data.get("instructions", ""),
                created_by=request.user,
            )
        except Exception as e:
            return Response({"error": str(e)}, status=400)
        
        return Response({"id": str(session.id)}, status=201)


class MockSessionDetailView(APIView):
    """GET/PATCH /api/v1/<slug>/admin/mock-sessions/<id>/"""
    
    def get(self, request, slug, session_id):
        if not _admin_or_teacher(request):
            return Response(status=403)
        
        session = get_object_or_404(MockExamSession, id=session_id)
        if request.user.center != session.center:
            return Response(status=403)
        
        monitoring = session_svc.get_session_monitoring(session)
        
        participants = session.participants.select_related("student").all()
        
        return Response({
            "session": {
                "id": str(session.id),
                "name": session.name,
                "date": session.date,
                "start_time": session.start_time,
                "end_time": session.end_time,
                "status": session.status,
                "instructions": session.instructions,
                "listening_test_id": str(session.listening_test_id),
                "reading_test_id": str(session.reading_test_id),
                "writing_test_id": str(session.writing_test_id),
                "started_at": session.started_at,
                "submitted_at": session.submitted_at,
            },
            "monitoring": monitoring,
            "participants": [
                {
                    "id": str(p.id),
                    "exam_taker_id": p.exam_taker_id,
                    "student_id": p.student.id,
                    "student_name": p.student.get_full_name(),
                    "student_email": p.student.email,
                    "status": p.status,
                    "status_display": p.get_status_display(),
                    "checked_in_at": p.checked_in_at,
                    "listening_band": float(p.listening_band) if p.listening_band else None,
                    "reading_band": float(p.reading_band) if p.reading_band else None,
                    "writing_band": float(p.writing_band) if p.writing_band else None,
                    "speaking_band": float(p.speaking_band) if p.speaking_band else None,
                    "overall_band": float(p.overall_band) if p.overall_band else None,
                }
                for p in participants
            ],
        })


class AddParticipantsView(APIView):
    """POST /api/v1/<slug>/admin/mock-sessions/<id>/add-participants/"""
    
    def post(self, request, slug, session_id):
        if not _admin_only(request):
            return Response(status=403)
        
        session = get_object_or_404(MockExamSession, id=session_id)
        if request.user.center != session.center:
            return Response(status=403)
        
        if session.status != MockExamSession.Status.DRAFT:
            return Response(
                {"error": "Faqat draft holatdagi mock'ga talaba qo'shish mumkin"},
                status=400,
            )
        
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        student_ids = request.data.get("student_ids", [])
        students = User.objects.filter(
            id__in=student_ids,
            user_type="b2b_student",
            # markazga tegishlilik — haqiqiy rel'ga moslang
        )
        
        added = session_svc.add_participants(session, students)
        
        return Response({
            "added_count": len(added),
            "participants": [
                {"exam_taker_id": p.exam_taker_id, "name": p.student.get_full_name()}
                for p in added
            ],
        })


class RemoveParticipantView(APIView):
    """DELETE /api/v1/<slug>/admin/mock-sessions/<sid>/participants/<pid>/"""
    
    def delete(self, request, slug, session_id, participant_id):
        if not _admin_only(request):
            return Response(status=403)
        
        participant = get_object_or_404(MockExamParticipant, id=participant_id)
        if request.user.center != participant.session.center:
            return Response(status=403)
        
        try:
            session_svc.remove_participant(participant)
        except ValueError as e:
            return Response({"error": str(e)}, status=400)
        
        return Response({"status": "removed"})


class OpenCheckinView(APIView):
    """POST .../mock-sessions/<id>/open-checkin/"""
    
    def post(self, request, slug, session_id):
        if not _admin_only(request):
            return Response(status=403)
        
        session = get_object_or_404(MockExamSession, id=session_id)
        if request.user.center != session.center:
            return Response(status=403)
        
        try:
            session_svc.open_for_checkin(session)
        except ValueError as e:
            return Response({"error": str(e)}, status=400)
        
        return Response({"status": "open_for_checkin"})


class StartSessionView(APIView):
    """POST .../mock-sessions/<id>/start/"""
    
    def post(self, request, slug, session_id):
        if not _admin_only(request):
            return Response(status=403)
        
        session = get_object_or_404(MockExamSession, id=session_id)
        if request.user.center != session.center:
            return Response(status=403)
        
        try:
            session_svc.start_session(session)
        except ValueError as e:
            return Response({"error": str(e)}, status=400)
        
        return Response({"status": "in_progress"})


# === Grading endpoints ===

class GradingQueueView(APIView):
    """GET .../mock-sessions/<id>/grading-queue/"""
    
    def get(self, request, slug, session_id):
        if not _admin_or_teacher(request):
            return Response(status=403)
        
        session = get_object_or_404(MockExamSession, id=session_id)
        if request.user.center != session.center:
            return Response(status=403)
        
        # Faqat Writing attempt'lar
        attempts = (
            MockExamAttempt.objects
            .filter(participant__session=session, section="writing", status="submitted")
            .prefetch_related("writing_tasks__grade", "participant")
        )
        
        queue = []
        for attempt in attempts:
            tasks = list(attempt.writing_tasks.order_by("task_number"))
            queue.append({
                "attempt_id": str(attempt.id),
                "exam_taker_id": attempt.participant.exam_taker_id,
                # NOMNI YUBORMAYMIZ — anonim grading
                "submitted_at": attempt.submitted_at,
                "tasks": [
                    {
                        "id": t.id,
                        "task_number": t.task_number,
                        "word_count": t.word_count,
                        "is_graded": hasattr(t, "grade"),
                    }
                    for t in tasks
                ],
            })
        
        return Response({"queue": queue})


class WritingTaskDetailView(APIView):
    """GET/POST .../writing-tasks/<id>/"""
    
    def get(self, request, slug, task_id):
        if not _admin_or_teacher(request):
            return Response(status=403)
        
        task = get_object_or_404(WritingTaskResponse, id=task_id)
        if request.user.center != task.attempt.participant.session.center:
            return Response(status=403)
        
        grade = getattr(task, "grade", None)
        
        return Response({
            "id": task.id,
            "exam_taker_id": task.attempt.participant.exam_taker_id,
            # ANONIM — ism yo'q
            "task_number": task.task_number,
            "response_text": task.response_text,
            "word_count": task.word_count,
            "submitted_at": task.submitted_at,
            "grade": {
                "band": float(grade.band) if grade else None,
                "feedback": grade.feedback if grade else "",
                "override_band": float(grade.override_band) if grade and grade.override_band else None,
                "override_reason": grade.override_reason if grade else "",
                "graded_by_id": grade.graded_by_id if grade else None,
            } if grade else None,
        })
    
    def post(self, request, slug, task_id):
        if not _admin_or_teacher(request):
            return Response(status=403)
        
        task = get_object_or_404(WritingTaskResponse, id=task_id)
        if request.user.center != task.attempt.participant.session.center:
            return Response(status=403)
        
        try:
            band = float(request.data.get("band", 0))
            if band < 0 or band > 9 or (band * 2) % 1 != 0:
                raise ValueError("Band 0–9 oralig'ida 0.5 qadam bilan")
            
            grade = grading_svc.grade_writing_task(
                task, band=band,
                feedback=request.data.get("feedback", ""),
                graded_by=request.user,
            )
            return Response({"status": "graded", "band": float(grade.band)})
        except ValueError as e:
            return Response({"error": str(e)}, status=400)


class OverrideGradeView(APIView):
    """POST .../writing-grades/<id>/override/"""
    
    def post(self, request, slug, grade_id):
        if not _admin_only(request):
            return Response(status=403)
        
        grade = get_object_or_404(WritingTaskGrade, id=grade_id)
        if request.user.center != grade.task_response.attempt.participant.session.center:
            return Response(status=403)
        
        try:
            new_band = float(request.data.get("band"))
            grading_svc.override_writing_grade(
                grade, new_band=new_band,
                reason=request.data.get("reason", ""),
                overridden_by=request.user,
            )
        except ValueError as e:
            return Response({"error": str(e)}, status=400)
        
        return Response({"status": "overridden"})


class SetSpeakingBandView(APIView):
    """POST .../participants/<id>/set-speaking/"""
    
    def post(self, request, slug, participant_id):
        if not _admin_only(request):
            return Response(status=403)
        
        participant = get_object_or_404(MockExamParticipant, id=participant_id)
        if request.user.center != participant.session.center:
            return Response(status=403)
        
        try:
            band = float(request.data.get("band"))
            grading_svc.set_speaking_band(participant, band, request.user)
        except ValueError as e:
            return Response({"error": str(e)}, status=400)
        
        return Response({"status": "set", "overall_band": float(participant.overall_band) if participant.overall_band else None})


# === Export ===

class ExcelExportView(APIView):
    """GET .../mock-sessions/<id>/export/"""
    
    def get(self, request, slug, session_id):
        if not _admin_only(request):
            return Response(status=403)
        
        session = get_object_or_404(MockExamSession, id=session_id)
        if request.user.center != session.center:
            return Response(status=403)
        
        import openpyxl
        from openpyxl.styles import Font, Alignment, PatternFill
        
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Mock Results"
        
        # Header
        ws.cell(1, 1, f"Mock Exam Results — {session.name}").font = Font(bold=True, size=14)
        ws.cell(2, 1, f"Sana: {session.date}")
        
        # Column headers
        headers = ["Exam Taker ID", "F.I.O", "Email", "Listening", "Reading", "Writing", "Speaking", "Overall"]
        for col, h in enumerate(headers, start=1):
            cell = ws.cell(4, col, h)
            cell.font = Font(bold=True)
            cell.fill = PatternFill("solid", fgColor="DDDDDD")
            cell.alignment = Alignment(horizontal="center")
        
        row = 5
        for p in session.participants.select_related("student").order_by("exam_taker_id"):
            ws.cell(row, 1, p.exam_taker_id)
            ws.cell(row, 2, p.student.get_full_name())
            ws.cell(row, 3, p.student.email)
            ws.cell(row, 4, float(p.listening_band) if p.listening_band else "—")
            ws.cell(row, 5, float(p.reading_band) if p.reading_band else "—")
            ws.cell(row, 6, float(p.writing_band) if p.writing_band else "—")
            ws.cell(row, 7, float(p.speaking_band) if p.speaking_band else "—")
            ws.cell(row, 8, float(p.overall_band) if p.overall_band else "—")
            
            for col in range(4, 9):
                ws.cell(row, col).alignment = Alignment(horizontal="center")
            
            row += 1
        
        ws.column_dimensions["A"].width = 18
        ws.column_dimensions["B"].width = 28
        ws.column_dimensions["C"].width = 24
        for col_letter in "DEFGH":
            ws.column_dimensions[col_letter].width = 12
        
        response = HttpResponse(
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        filename = f"mock_{session.date}_{session.id.hex[:8]}.xlsx"
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        wb.save(response)
        return response
```

URL'lar:
```python
# apps/mock_exams/urls.py
urlpatterns += [
    path("admin/mock-sessions/", views_admin.MockSessionListView.as_view()),
    path("admin/mock-sessions/create/", views_admin.MockSessionCreateView.as_view()),
    path("admin/mock-sessions/<uuid:session_id>/", views_admin.MockSessionDetailView.as_view()),
    path("admin/mock-sessions/<uuid:session_id>/add-participants/", views_admin.AddParticipantsView.as_view()),
    path("admin/mock-sessions/<uuid:session_id>/participants/<uuid:participant_id>/", views_admin.RemoveParticipantView.as_view()),
    path("admin/mock-sessions/<uuid:session_id>/open-checkin/", views_admin.OpenCheckinView.as_view()),
    path("admin/mock-sessions/<uuid:session_id>/start/", views_admin.StartSessionView.as_view()),
    path("admin/mock-sessions/<uuid:session_id>/grading-queue/", views_admin.GradingQueueView.as_view()),
    path("admin/mock-sessions/<uuid:session_id>/export/", views_admin.ExcelExportView.as_view()),
    path("admin/writing-tasks/<int:task_id>/", views_admin.WritingTaskDetailView.as_view()),
    path("admin/writing-grades/<int:grade_id>/override/", views_admin.OverrideGradeView.as_view()),
    path("admin/participants/<uuid:participant_id>/set-speaking/", views_admin.SetSpeakingBandView.as_view()),
]
```

---

## 6-bosqich: Frontend — Admin sahifalari

### `/<slug>/admin/mock-sessions/` — Ro'yxat

`pages/admin/MockSessionsListPage.tsx`:
- Headerda "Yangi mock yaratish" tugmasi
- Status tabs: Draft / Open / In progress / Submitted / Grading / Completed
- Har qator: nom, sana, vaqt, qatnashuvchilar, status badge, drill-down link

### `/<slug>/admin/mock-sessions/create/`

Form:
- Nom (text)
- Sana (date), boshlanish vaqti (time), tugash vaqti (time, optional)
- 3 ta test select (Listening test, Reading test, Writing test) — katalogdan
- Ko'rsatmalar (textarea)
- Saqlash → draft sifatida

### `/<slug>/admin/mock-sessions/<id>/` — Detail

Bu sahifa **status'ga qarab** turli ko'rinishlar:

**Draft holatda:**
- Session ma'lumotlari + tahrirlash
- "Talaba qo'shish" sahifa/modal — markazning talabalarini tanlash (multi-select)
- Qatnashuvchilar ro'yxati (exam taker ID + ism)
- "Check-in'ni ochish" tugmasi

**Open for checkin holatda:**
- Real-time monitoring: kim check-in qildi, kim emas
- Auto-refresh har 5 sekundda
- "Mock'ni boshlash" tugmasi

**In progress holatda:**
- Monitoring: kim qaysi bo'limni ishlamoqda, kim tugatdi
- Vaqt, jonli statistika

**Submitted/Grading holatda:**
- "Grading queue" bo'limi: hali baholanmagan Writing'lar
- Har talaba ostida Listening/Reading/Writing/Overall ballari
- "Speaking ball qo'shish" tugmasi har talaba uchun (face-to-face)

**Completed holatda:**
- Yakuniy natijalar jadvali
- "Excel'ga eksport" tugmasi
- Override tarixi (agar bo'lsa)

```tsx
// Qisqartirilgan skeleton — Cursor Agent har holatga moslab to'liq UI quradi
export function MockSessionDetailPage() {
  const { sessionId } = useParams();
  const [data, setData] = useState<any>(null);
  
  const load = () => fetch(`/api/v1/${slug}/admin/mock-sessions/${sessionId}/`)
    .then(r => r.json()).then(setData);
  
  useEffect(() => {
    load();
    // Auto-refresh agar mock davom etmoqda bo'lsa
    if (data?.session?.status === "in_progress" || data?.session?.status === "open_for_checkin") {
      const interval = setInterval(load, 5000);
      return () => clearInterval(interval);
    }
  }, [data?.session?.status]);
  
  if (!data) return <Loading />;
  
  return (
    <AdminLayout>
      <MockSessionHeader session={data.session} monitoring={data.monitoring} onReload={load} />
      
      {data.session.status === "draft" && <DraftView session={data.session} participants={data.participants} onReload={load} />}
      {data.session.status === "open_for_checkin" && <CheckinMonitorView session={data.session} participants={data.participants} onReload={load} />}
      {data.session.status === "in_progress" && <LiveMonitorView session={data.session} participants={data.participants} />}
      {["submitted", "grading"].includes(data.session.status) && <GradingView session={data.session} participants={data.participants} onReload={load} />}
      {data.session.status === "completed" && <ResultsView session={data.session} participants={data.participants} />}
    </AdminLayout>
  );
}
```

### `/<slug>/admin/mock-sessions/<id>/grade/<task_id>/` — Anonim grading

**MUHIM:** Talaba ismi ko'rinmaydi, faqat exam taker ID.

```tsx
export function WritingGradingPage() {
  const { taskId } = useParams();
  const [task, setTask] = useState<any>(null);
  const [band, setBand] = useState("");
  const [feedback, setFeedback] = useState("");
  
  useEffect(() => {
    fetch(`/api/v1/${slug}/admin/writing-tasks/${taskId}/`)
      .then(r => r.json())
      .then((d) => {
        setTask(d);
        if (d.grade) {
          setBand(String(d.grade.band));
          setFeedback(d.grade.feedback);
        }
      });
  }, [taskId]);
  
  if (!task) return <Loading />;
  
  const submitGrade = async () => {
    const bandValue = parseFloat(band);
    if (isNaN(bandValue) || bandValue < 0 || bandValue > 9 || (bandValue * 2) % 1 !== 0) {
      toast.error("Band 0–9 oralig'ida 0.5 qadam bilan");
      return;
    }
    const res = await fetch(`/api/v1/${slug}/admin/writing-tasks/${taskId}/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrf() },
      body: JSON.stringify({ band: bandValue, feedback }),
    });
    if (res.ok) toast.success("Baholandi");
  };
  
  return (
    <AdminLayout>
      <div className="grid grid-cols-2 gap-5">
        {/* Chap — talaba ishi */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold">{task.exam_taker_id}</h1>
              {/* ISM YO'Q — anonim */}
              <p className="text-sm text-gray-500">Task {task.task_number} · {task.word_count} so'z</p>
            </div>
            <div className="text-xs text-gray-400 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-1.5">
              🔒 Anonim baholash
            </div>
          </div>
          <div className="prose prose-sm max-w-none whitespace-pre-wrap">{task.response_text}</div>
        </div>
        
        {/* O'ng — baholash */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 h-fit sticky top-6">
          <h2 className="font-bold mb-4">Bahoni kiriting</h2>
          
          <label className="text-sm font-medium block mb-1">Band (0–9, 0.5 qadam)</label>
          <input
            type="number" step="0.5" min="0" max="9"
            value={band} onChange={(e) => setBand(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-lg font-bold text-center mb-3"
            placeholder="6.5"
          />
          
          <div className="grid grid-cols-5 gap-1 mb-3">
            {[5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9].map((b) => (
              <button key={b} onClick={() => setBand(String(b))}
                      className={`py-2 rounded-lg text-sm font-bold ${band === String(b) ? "bg-rose-600 text-white" : "border border-gray-300"}`}>
                {b}
              </button>
            ))}
          </div>
          
          <label className="text-sm font-medium block mb-1 mt-3">Feedback (ixtiyoriy)</label>
          <textarea
            value={feedback} onChange={(e) => setFeedback(e.target.value)}
            rows={6}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="Task Achievement, Coherence, Lexical, Grammar bo'yicha izoh..."
          />
          
          <button
            onClick={submitGrade}
            className="w-full bg-rose-600 hover:bg-rose-700 text-white font-medium py-2.5 rounded-xl mt-4"
          >
            Saqlash
          </button>
        </div>
      </div>
    </AdminLayout>
  );
}
```

---

## 7-bosqich: Frontend — Talaba sahifalari

### `/<slug>/mock/<session_id>/` — Check-in sahifa

```tsx
export function MockCheckInPage() {
  const { sessionId } = useParams();
  const [data, setData] = useState<any>(null);
  const [myParticipant, setMyParticipant] = useState<any>(null);
  
  useEffect(() => {
    fetch(`/api/v1/${slug}/mock/${sessionId}/info/`)
      .then(r => r.json()).then(setData);
  }, [sessionId]);
  
  const checkIn = async (participantStudentId: number) => {
    // Login bo'lgan user shu studentmi tekshirish (backend qiladi)
    const res = await fetch(`/api/v1/${slug}/mock/${sessionId}/check-in/`, {
      method: "POST", headers: { "X-CSRFToken": getCsrf() },
    });
    if (res.ok) {
      const result = await res.json();
      setMyParticipant(result);
      toast.success(`Check-in tugadi! Sizning ID: ${result.exam_taker_id}`);
    }
  };
  
  if (!data) return <Loading />;
  
  if (myParticipant) {
    return <CheckedInScreen examTakerId={myParticipant.exam_taker_id} session={data.session} />;
  }
  
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-1">{data.session.name}</h1>
        <p className="text-sm text-gray-500 mb-6">
          {new Date(data.session.date).toLocaleDateString("uz")} · {data.session.start_time}
        </p>
        
        {data.session.instructions && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6 text-sm whitespace-pre-wrap">
            {data.session.instructions}
          </div>
        )}
        
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <h2 className="font-bold mb-1">Ismingizni tanlang</h2>
          <p className="text-sm text-gray-500 mb-4">Faqat o'z ismingizni tanlang. Yon-atrofdagilarning emas.</p>
          
          <div className="divide-y divide-gray-100">
            {data.participants.map((p: any) => (
              <button
                key={p.id}
                disabled={p.is_checked_in}
                onClick={() => checkIn(p.student_id)}
                className="w-full py-3 flex items-center justify-between hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed px-2"
              >
                <span className="font-medium">{p.student_name}</span>
                {p.is_checked_in ? (
                  <span className="text-xs font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">CHECK-IN ✓</span>
                ) : (
                  <span className="text-xs text-rose-600">Tanlash →</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


function CheckedInScreen({ examTakerId, session }: any) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 to-amber-50 flex items-center justify-center px-4">
      <div className="bg-white border border-gray-200 rounded-3xl p-8 max-w-md w-full text-center">
        <div className="text-5xl mb-4">✓</div>
        <h1 className="text-2xl font-bold mb-2">Check-in tugadi</h1>
        <p className="text-sm text-gray-500 mb-6">Sizning Exam Taker ID:</p>
        <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-6 mb-6">
          <p className="text-3xl font-bold text-rose-700 tracking-wider">{examTakerId}</p>
        </div>
        <p className="text-sm text-gray-600">
          Admin imtihonni boshlaganda test sahifasi avtomatik ochiladi. Iltimos, kuting va telefonni o'chiring.
        </p>
        <div className="mt-6 animate-pulse text-xs text-gray-400">⏳ Imtihon boshlanishini kutmoqda...</div>
      </div>
    </div>
  );
}
```

Sahifa auto-poll qilib turishi kerak: session.status === "in_progress" bo'lsa, test runner sahifasiga yo'naltirish.

### `/<slug>/mock/<session_id>/test/<section>/` — Test runner

Mavjud test runner'ni mock mode'da ishlatish. Cursor Agent loyihaning hozirgi runner'iga moslab integratsiya qiladi. Asosiy farqlar:

- URL mock context'da
- Submit qilingach **natija sahifasi ochilmaydi** — to'g'ridan-to'g'ri keyingi bo'lim yoki "Topshirildi"
- **Writing bo'limi maxsus UI** — Task 1 + Task 2 alohida textarea, har biri uchun word counter, taymer

### `/<slug>/mock/<session_id>/complete/` — Yakuniy sahifa

```tsx
export function MockCompletePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white border border-gray-200 rounded-3xl p-10 max-w-md w-full text-center">
        <div className="text-5xl mb-4">📝</div>
        <h1 className="text-2xl font-bold mb-3">Test topshirildi</h1>
        <p className="text-gray-600 mb-6">
          Tabriklaymiz! Mock imtihonni muvaffaqiyatli yakunladingiz.
        </p>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <strong>Natija:</strong> Yozma ish (Writing) qo'lda baholanadi. Yakuniy natija
          o'quv markazingiz tomonidan e'lon qilinadi. Platformada sizga ko'rinmaydi.
        </div>
      </div>
    </div>
  );
}
```

**MUHIM:** Talaba o'z natijasini hech qaerda ko'ra olmaydi (na dashboard, na profil, na boshqa joyda).

---

## 8-bosqich: Permission tekshiruvlari

Quyidagilarni har endpoint'da ta'minlang:

- Admin endpoint'lar: `user_type == "b2b_admin"` va `user.center == session.center`
- Teacher endpoint'lar (faqat grading): `user_type in ("b2b_admin", "b2b_teacher")` va `user.center == session.center`
- Student endpoint'lar: `user_type == "b2b_student"` va `student == participant.student` (faqat o'z ishi)
- B2C user va boshqa center'larning userlari: 403

**MUHIM xavfsizlik:** Talaba o'zining ham natijasini ko'ra olmasligi kerak. API'da hech qanday endpoint talabaga `band` qaytarmasin.

Tezkor tekshiruv: Cursor Agent har endpoint'da `participant.listening_band`, `writing_band`, `overall_band` kabi maydonlar talabaga qaytmasligini guarantee qilishi kerak.

---

## 9-bosqich: Sidebar yangilash

B2B admin sidebar'iga (loyihada qaysi component bo'lsa) "Mock imtihonlar" linki qo'shing:

```tsx
<NavItem to={`/${slug}/admin/mock-sessions`} icon="🎯" active={active === "mock-sessions"}>
  Mock imtihonlar
</NavItem>
```

---

## 10-bosqich: Sample data — sinash uchun

```bash
python manage.py shell
```

```python
from datetime import date, time
from django.contrib.auth import get_user_model
from apps.centers.models import Center
from apps.tests.models import Test
from apps.mock_exams.models import MockExamSession
from apps.mock_exams.services.sessions import create_mock_session, add_participants, open_for_checkin

User = get_user_model()

center = Center.objects.first()
admin = User.objects.filter(user_type="b2b_admin", center=center).first()

# 3 ta test tanlash
listening = Test.objects.filter(section_type="listening").first()
reading = Test.objects.filter(section_type="reading").first()
writing = Test.objects.filter(section_type="writing").first()

session = create_mock_session(
    center=center,
    name="Test Mock — 12 May 2026",
    date=date(2026, 5, 12),
    start_time=time(10, 0),
    end_time=time(13, 0),
    listening_test=listening,
    reading_test=reading,
    writing_test=writing,
    instructions="Iltimos, telefoningizni o'chiring. Yon-atrofga qaramang.",
    created_by=admin,
)

students = User.objects.filter(user_type="b2b_student", center=center)[:5]
participants = add_participants(session, students)

for p in participants:
    print(f"{p.exam_taker_id} — {p.student.get_full_name()}")

open_for_checkin(session)
print(f"Session ready: {session.id}")
```

---

## 11-bosqich: Manual test checklist

### Admin flow
- [ ] Yangi mock yaratish formasi ishlaydi
- [ ] 3 ta test tanlash (listening/reading/writing) kerakli filter bilan
- [ ] Talaba qo'shish: markaz studentlari ro'yxati, multi-select
- [ ] Qo'shilgan talabalarga exam_taker_id avtomatik berildi (IELTS-2026-0001, 0002, ...)
- [ ] Talaba olib tashlash (faqat REGISTERED holatda)
- [ ] "Check-in'ni ochish" → status open_for_checkin
- [ ] Real-time monitoring: nechta check-in, nechta in_progress
- [ ] "Mock'ni boshlash" → IN_PROGRESS

### Student flow
- [ ] `/<slug>/mock/<id>/` da ro'yxat ko'rinadi
- [ ] Boshqa talabaning ismini bossangiz — auth tekshiruvi to'g'ri (faqat o'zingizniki)
- [ ] O'z ismingizni bossangiz — exam_taker_id katta ko'rinadi, "Imtihon kutmoqda" xabari
- [ ] Admin "Boshlash" bosgach, talaba auto-redirect Listening sahifasiga
- [ ] Listening tugagach Reading, Reading tugagach Writing
- [ ] Writing'da Task 1 va Task 2 alohida, word counter ishlaydi
- [ ] Hammasi tugagach "Topshirildi" sahifa
- [ ] **Talaba hech qayerda o'z band ballini ko'ra olmaydi**
- [ ] Dashboard, profil, history — hech qaerda mock natijasi ko'rinmaydi

### Auto-scoring
- [ ] Listening submit tugagach `auto_band` to'ldirildi
- [ ] Reading submit tugagach `auto_band` to'ldirildi
- [ ] Band score table to'g'ri ishlaydi (masalan 30/40 → 7.0)

### Grading
- [ ] Admin grading queue'da Writing essay'lar ro'yxati
- [ ] Har essayda **faqat exam_taker_id** ko'rinadi, ism YO'Q
- [ ] Task 1 va Task 2 alohida ekranlarda
- [ ] Band kiritish 0.5 qadam bilan
- [ ] Tezkor tugmalar (5, 5.5, 6, ...)
- [ ] Saqlangach attempt status "graded"
- [ ] Ikkala task baholangach Writing band hisoblanadi (Task1 + 2×Task2)/3
- [ ] Hammasi baholangach Overall band hisoblanadi

### Admin override
- [ ] Admin teacher bahosini o'zgartira oladi, sabab majburiy
- [ ] Override yozuvi saqlanadi (kim, qachon, qanday sabab)
- [ ] Effective band override_band ekanligi UI'da ko'rinadi

### Speaking
- [ ] Admin har participant uchun Speaking band'ni qo'lda kirita oladi
- [ ] Kiritilgach Overall band qayta hisoblanadi (4 bo'lim o'rtachasi)

### Export
- [ ] Excel eksport tugmasi ishlaydi
- [ ] Fayl tarkibi: Exam Taker ID, F.I.O, Email, L, R, W, S, Overall
- [ ] Saqlanmagan ballar uchun "—" yoki bo'sh
- [ ] Fayl nomi `mock_<sana>_<id>.xlsx`

### Permissions
- [ ] B2B teacher faqat grading qila oladi, mock yarata olmaydi
- [ ] B2C user mock URL'lariga kirsa — 403
- [ ] Boshqa center'ning admin'i shu mock'ka kirsa — 403
- [ ] Talaba boshqa talabaning ishini ko'ra olmaydi
- [ ] **Talaba o'z natijasini ko'ra olmaydi** (har joyda tekshirish)

---

## 12-bosqich: Git commit va push (MAJBURIY)

```bash
git add .
git commit -m "ETAP 21: B2B Mock Exam Session — exam taker IDs, anonymous grading, auto+manual scoring, Excel export"
git push origin feat/etap-21-mock-exams
```

---

## Yakuniy checklist

- [ ] `apps.mock_exams` app yaratilgan, INSTALLED_APPS'da
- [ ] 5 model: MockExamSession, MockExamParticipant, MockExamAttempt, WritingTaskResponse, WritingTaskGrade
- [ ] Exam Taker ID avtomatik generatsiya: `IELTS-YYYY-NNNN`
- [ ] Migration ishlagan
- [ ] `services/band_calculator.py` — Listening/Reading band table, Writing weighted, Overall, IELTS rounding
- [ ] `services/sessions.py` — create, add_participants, open_checkin, start
- [ ] `services/grading.py` — auto_score, grade_writing, override, set_speaking
- [ ] Student endpoint'lar: session info, check-in, start-section, submit-section
- [ ] Admin endpoint'lar: CRUD, monitoring, grading queue, override, set speaking, export
- [ ] Frontend admin: list, create, detail (5 status'ga turli ko'rinish), grading anonim
- [ ] Frontend student: check-in (ism tanlash + ID display), runner mock mode, complete screen
- [ ] **Natija talabaga ko'rinmaydi** — har joyda tekshirish
- [ ] **Anonim grading** — teacher ekran'da faqat ID
- [ ] Excel eksport: openpyxl bilan
- [ ] Test runner mock mode'da: submit'dan keyin natija sahifa yo'q
- [ ] Sidebar'da "Mock imtihonlar" linki
- [ ] Sample data shell snippet ishlatildi
- [ ] Permissions tekshirilgan
- [ ] Migration fayllar git'da
- [ ] `git push origin <branch>` muvaffaqiyatli

---

## Kelajak — ETAP 22+

Bu ETAP'dan keyin:

- **Speaking integratsiyasi** — audio yozish, teacher tinglash, anonim baholash
- **Re-take** — talaba mock'ni ikkinchi marta ishlay olishi (yangi attempt)
- **Family/parent access** — ota-onaga natija yuborish (Telegram bot orqali)
- **Comparison reports** — bir markazning bir necha mock'lari natijalarini taqqoslash
- **Anti-cheat** — fullscreen majburlash, copy-paste bloklash, tab switch detect
- **Multi-room mocks** — bir necha xona, bir mock — turli vaqtlarda boshlash

Hozirgi struktura bu kengaytmalar uchun foundation tayyor.
