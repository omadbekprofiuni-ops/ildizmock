"""ETAP 20 — Attendance redesign: 3-tab grid / today / analytics service'lari.

Bu modul yangi davomat sahifasining business-logic'ini ushlab turadi:
- Tab 1 (Bugungi davomat) — `get_today_session`, `bulk_mark`
- Tab 2 (Oylik jadval)   — `get_monthly_grid`, `mark_single`
- Tab 3 (Tahlil)         — `get_attendance_trend`, `get_at_risk_students`
- Student detail         — `get_student_history`
"""
from __future__ import annotations

from calendar import monthrange
from collections import defaultdict
from datetime import date, timedelta
from typing import Any

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from ..models import AttendanceRecord, AttendanceSession

User = get_user_model()


# Status-uchun davomatga sanaladigan ro'yxat. ETAP 20 spec: present + late.
ATTENDED_STATUSES = ('present', 'late')
# Sababli kelmaganlik (excused/sick) — davomatga sanalmaydi, lekin "marked"
# hisoblanadi va jazolanmaydi.


def _ensure_marked(status: str, note: str) -> None:
    """Status `excused` bo'lsa note majburiy."""
    if status == 'excused' and not (note or '').strip():
        raise ValidationError({'note': "Sababli kelmagan holat uchun izoh majburiy."})


def mark_single(record: AttendanceRecord, status: str, note: str, marked_by) -> AttendanceRecord:
    """Bitta yozuvni belgilash (Tab 2 hujayrasi)."""
    _ensure_marked(status, note)
    record.status = status
    record.notes = note or ''
    record.marked_by = marked_by
    record.save(update_fields=['status', 'notes', 'marked_by', 'marked_at'])
    return record


@transaction.atomic
def bulk_mark(session: AttendanceSession, items: list[dict], marked_by) -> int:
    """Tab 1 — bir martada barcha talabalarni belgilash.

    items: [{record_id?, student_id?, status, note}, ...]

    Agar `record_id` berilsa shuni yangilaymiz. Bo'lmasa `student_id`
    bo'yicha topamiz (ehtiyot uchun).
    """
    saved = 0
    for it in items:
        status = it.get('status')
        note = it.get('note') or it.get('notes') or ''
        if not status:
            continue
        _ensure_marked(status, note)

        record = None
        if it.get('record_id'):
            record = AttendanceRecord.objects.select_for_update().filter(
                pk=it['record_id'], session=session,
            ).first()
        if record is None and it.get('student_id'):
            record = AttendanceRecord.objects.select_for_update().filter(
                session=session, student_id=it['student_id'],
            ).first()
        if record is None:
            continue

        record.status = status
        record.notes = note
        record.marked_by = marked_by
        record.save(update_fields=['status', 'notes', 'marked_by', 'marked_at'])
        saved += 1

    # Hammasi belgilangan bo'lsa va session hali yakunlanmagan bo'lsa,
    # `is_finalized=False` qoldiramiz — admin alohida tugma bilan yakunlaydi.
    return saved


def get_today_session(group, *, requested_date: date | None = None):
    """Tab 1 uchun: belgilangan sananing sessiyasini topish (default = bugun)."""
    target_date = requested_date or timezone.localdate()
    return AttendanceSession.objects.filter(group=group, date=target_date).first()


def get_monthly_grid(group, year: int, month: int) -> dict[str, Any]:
    """Tab 2 uchun: oylik jadval ma'lumotlari.

    Return: {
        students: [User, ...],
        sessions: [AttendanceSession, ...],
        cells: {(student_id, session_id): {status, note, record_id}},
        summary: {student_id: {present, late, absent, excused, ...}},
        group_stats: {avg_percent, today_percent, at_risk_count},
    }
    """
    first = date(year, month, 1)
    last = date(year, month, monthrange(year, month)[1])

    sessions = list(
        AttendanceSession.objects.filter(
            group=group, date__gte=first, date__lte=last,
        ).order_by('date', 'start_time')
    )
    students = list(group.members.filter(role='student', is_active=True).order_by(
        'first_name', 'last_name', 'username',
    ))

    records = AttendanceRecord.objects.filter(
        session__in=sessions, student__in=students,
    ).select_related('student', 'session')

    cells: dict[tuple[int, int], dict] = {}
    for r in records:
        cells[(r.student_id, r.session_id)] = {
            'record_id': r.id,
            'status': r.status,
            'note': r.notes or '',
        }

    summary: dict[int, dict] = {}
    for s in students:
        counts = {'present': 0, 'late': 0, 'absent': 0, 'excused': 0, 'sick': 0, 'unmarked': 0}
        for sess in sessions:
            cell = cells.get((s.id, sess.id))
            if not cell or not cell['status']:
                counts['unmarked'] += 1
                continue
            counts[cell['status']] = counts.get(cell['status'], 0) + 1

        # Davomat % — marked bo'lganlardan, present+late attended.
        marked = counts['present'] + counts['late'] + counts['absent'] + counts['excused'] + counts['sick']
        attended = counts['present'] + counts['late']
        percent = round(attended / marked * 100, 1) if marked else None

        summary[s.id] = {
            **counts,
            'marked': marked,
            'total_sessions': len(sessions),
            'percent': percent,
        }

    # Group-wide stats.
    percents = [v['percent'] for v in summary.values() if v['percent'] is not None]
    avg_percent = round(sum(percents) / len(percents), 1) if percents else None
    at_risk = sum(1 for p in percents if p < 70)

    today = timezone.localdate()
    today_sessions = [s for s in sessions if s.date == today]
    today_percent = None
    if today_sessions:
        today_records = [r for r in records if r.session_id in {s.id for s in today_sessions}]
        marked_recs = [r for r in today_records if r.status]
        attended_recs = [r for r in marked_recs if r.status in ATTENDED_STATUSES]
        today_percent = round(len(attended_recs) / len(marked_recs) * 100, 1) if marked_recs else None

    return {
        'students': students,
        'sessions': sessions,
        'cells': cells,
        'summary': summary,
        'group_stats': {
            'avg_percent': avg_percent,
            'today_percent': today_percent,
            'at_risk_count': at_risk,
            'total_students': len(students),
            'total_sessions': len(sessions),
        },
    }


def get_attendance_trend(group, *, months_back: int = 6) -> list[dict]:
    """Tahlil — oxirgi N oydagi guruh davomat trend (oy bo'yicha %)."""
    today = timezone.localdate()
    start = today.replace(day=1) - timedelta(days=months_back * 31)

    sessions = AttendanceSession.objects.filter(
        group=group, date__gte=start,
    ).only('id', 'date')

    by_month: dict[str, dict] = defaultdict(lambda: {'marked': 0, 'attended': 0})
    sess_to_month: dict[int, str] = {}
    for sess in sessions:
        key = sess.date.strftime('%Y-%m')
        sess_to_month[sess.id] = key

    if sess_to_month:
        records = AttendanceRecord.objects.filter(
            session_id__in=sess_to_month.keys(), status__isnull=False,
        ).values('session_id', 'status')
        for r in records:
            month_key = sess_to_month[r['session_id']]
            by_month[month_key]['marked'] += 1
            if r['status'] in ATTENDED_STATUSES:
                by_month[month_key]['attended'] += 1

    trend = []
    for month_key in sorted(by_month.keys()):
        m = by_month[month_key]
        percent = round(m['attended'] / m['marked'] * 100, 1) if m['marked'] else None
        trend.append({'month': month_key, 'percent': percent, 'marked': m['marked']})
    return trend


def get_at_risk_students(organization, *, threshold: int = 70, months_back: int = 3) -> list[dict]:
    """Tahlil — markazning davomati < threshold% bo'lgan talabalari."""
    since = timezone.localdate() - timedelta(days=months_back * 31)
    students = User.objects.filter(
        organization=organization, role='student', is_active=True,
    ).only('id', 'first_name', 'last_name', 'username')

    result = []
    for s in students:
        recs = AttendanceRecord.objects.filter(
            student=s, session__date__gte=since, status__isnull=False,
        ).values_list('status', flat=True)
        recs_list = list(recs)
        if len(recs_list) < 5:  # juda kam ma'lumot bo'lsa hisobga olmaymiz
            continue
        attended = sum(1 for st in recs_list if st in ATTENDED_STATUSES)
        percent = round(attended / len(recs_list) * 100, 1)
        if percent < threshold:
            result.append({
                'student_id': s.id,
                'student_name': f'{s.first_name} {s.last_name}'.strip() or s.username,
                'username': s.username,
                'percent': percent,
                'marked': len(recs_list),
                'attended': attended,
            })

    return sorted(result, key=lambda x: x['percent'])


def get_student_history(student, *, limit: int = 50) -> dict:
    """Talaba detail sahifa uchun: oxirgi sessiyalar va statistikalar."""
    qs = (
        AttendanceRecord.objects.filter(student=student)
        .select_related('session', 'session__group')
        .order_by('-session__date', '-session__start_time')
    )
    records = list(qs[:limit])

    # Statistika butun tarix bo'yicha (limit-ga bog'liq emas).
    full = AttendanceRecord.objects.filter(student=student, status__isnull=False)
    marked_total = full.count()
    by_status = {
        'present': full.filter(status='present').count(),
        'late': full.filter(status='late').count(),
        'absent': full.filter(status='absent').count(),
        'excused': full.filter(status='excused').count(),
        'sick': full.filter(status='sick').count(),
    }
    attended = by_status['present'] + by_status['late']
    overall = round(attended / marked_total * 100, 1) if marked_total else None

    return {
        'records': records,
        'overall_percent': overall,
        'total_marked': marked_total,
        'by_status': by_status,
    }
