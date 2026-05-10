"""ETAP 28 — Davomat escalation logikasi.

Talaba so'nggi 30 kun ichida 3 / 5 / 10 ta sababsiz absent qoldirganida
markaz adminiga ogohlantirish (AttendanceEscalation) avtomatik yaratiladi.

Idempotent: agar tier allaqachon yaratilgan va resolved emas — qayta
yaratilmaydi.
"""
from __future__ import annotations

from datetime import timedelta

from django.utils import timezone

from ..models import AttendanceEscalation, AttendanceRecord


# Tier'lar (count, tier_value) — eng katta count'dan boshlab tekshiriladi.
THRESHOLDS = [
    (10, AttendanceEscalation.TIER_CHOICES[2][0]),  # removal
    (5, AttendanceEscalation.TIER_CHOICES[1][0]),   # reprimand
    (3, AttendanceEscalation.TIER_CHOICES[0][0]),   # warning
]


def count_recent_absences(student, group, since_days: int = 30) -> int:
    """So'nggi `since_days` kunda shu guruhda 'absent' bo'lgan yozuvlar soni."""
    cutoff = timezone.now().date() - timedelta(days=since_days)
    return AttendanceRecord.objects.filter(
        student=student,
        session__group=group,
        session__date__gte=cutoff,
        status='absent',
    ).count()


def check_and_create_escalations(
    student, group, since_days: int = 30,
) -> list[AttendanceEscalation]:
    """Threshold'larni tekshiradi va kerak bo'lsa yangi escalation yaratadi.

    Returns: yangi yaratilgan AttendanceEscalation ro'yxati (bo'sh
    bo'lishi mumkin agar yangi tier kesib o'tilmagan bo'lsa).
    """
    if not student or not group:
        return []

    count = count_recent_absences(student, group, since_days=since_days)
    if count < THRESHOLDS[-1][0]:  # < 3 — hech narsa qilmaymiz
        return []

    created: list[AttendanceEscalation] = []

    for threshold, tier in THRESHOLDS:
        if count < threshold:
            continue
        # Idempotent: shu tier allaqachon hal qilinmagan bo'lsa, qayta yaratmaymiz
        already = AttendanceEscalation.objects.filter(
            student=student,
            group=group,
            tier=tier,
            resolved_at__isnull=True,
        ).exists()
        if already:
            continue
        esc = AttendanceEscalation.objects.create(
            student=student,
            group=group,
            tier=tier,
            absence_count=count,
        )
        created.append(esc)

    return created
