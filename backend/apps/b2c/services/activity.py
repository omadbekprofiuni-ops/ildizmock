"""Dashboard'da ko'rsatiladigan KPI/streak/heatmap aggregatsiyalari.

Hammasi `B2CActivityEvent` jadvalidan o'qiydi va bo'sh datada ham xavfsiz
ishlaydi (None / 0 qaytaradi, hech qachon exception emas).
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from django.db.models import Avg, Sum

from ..models import B2CActivityEvent


def get_kpi_stats(user) -> dict[str, Any]:
    """Top-4 KPI tile uchun."""
    events = B2CActivityEvent.objects.filter(user=user)
    profile = getattr(user, 'b2c_profile', None)

    tests_taken = events.count()
    avg_score = events.exclude(score__isnull=True).aggregate(v=Avg('score'))['v']
    practice_days = events.values('activity_date').distinct().count()

    exam_in_days = None
    if profile and profile.exam_date:
        delta = (profile.exam_date - date.today()).days
        exam_in_days = delta if delta >= 0 else 0

    return {
        'practice_days': practice_days,
        'tests_taken': tests_taken,
        'avg_score': float(round(avg_score, 1)) if avg_score is not None else None,
        'exam_in_days': exam_in_days,
    }


def get_streak_stats(user) -> dict[str, int]:
    """Joriy va eng uzun streak (kun bo'yicha)."""
    dates = list(
        B2CActivityEvent.objects.filter(user=user)
        .values_list('activity_date', flat=True)
        .distinct()
    )
    if not dates:
        return {'current_streak': 0, 'best_streak': 0}

    dates_set = set(dates)
    today = date.today()

    # Current streak — bugundan (yoki kechagidan, agar bugun mashq yo'q bo'lsa)
    # orqaga davom etayotgan ketma-ket kunlar.
    current = 0
    cursor = today if today in dates_set else today - timedelta(days=1)
    while cursor in dates_set:
        current += 1
        cursor -= timedelta(days=1)

    # Best streak — istalgan vaqtdagi eng uzun ketma-ket kunlar tasmasi.
    sorted_dates = sorted(dates_set)
    best = 0
    run = 0
    prev: date | None = None
    for d in sorted_dates:
        if prev is None or (d - prev).days == 1:
            run += 1
        else:
            run = 1
        if run > best:
            best = run
        prev = d

    return {'current_streak': current, 'best_streak': best}


def get_weekly_progress(user) -> dict[str, int]:
    """Haftalik maqsad — dushanbadan boshlab."""
    profile = getattr(user, 'b2c_profile', None)
    today = date.today()
    week_start = today - timedelta(days=today.weekday())

    week_events = B2CActivityEvent.objects.filter(
        user=user, activity_date__gte=week_start,
    )
    sessions_done = week_events.values('activity_date').distinct().count()
    minutes = week_events.aggregate(s=Sum('minutes_spent'))['s'] or 0

    goal = (profile.weekly_goal_sessions if profile else None) or 5
    pct = min(100, int(round((sessions_done / goal) * 100))) if goal else 0

    return {
        'sessions_done': sessions_done,
        'sessions_goal': goal,
        'percent': pct,
        'minutes_this_week': minutes,
    }


def _band_for_minutes(minutes: int) -> int:
    """0 / 1–15 / 16–30 / 31–60 / 60+ → 0..4."""
    if minutes <= 0:
        return 0
    if minutes <= 15:
        return 1
    if minutes <= 30:
        return 2
    if minutes <= 60:
        return 3
    return 4


def get_heatmap_data(user, weeks: int = 12) -> list[list[dict | None]]:
    """7 qator (Mon..Sun) × `weeks` ustun.

    Har bir hujayra: {date, minutes, band} yoki None (kelajak kun).
    """
    today = date.today()
    current_monday = today - timedelta(days=today.weekday())
    start = current_monday - timedelta(weeks=weeks - 1)

    events = (
        B2CActivityEvent.objects.filter(
            user=user, activity_date__gte=start, activity_date__lte=today,
        )
        .values('activity_date')
        .annotate(total_minutes=Sum('minutes_spent'))
    )
    by_date = {e['activity_date']: e['total_minutes'] or 0 for e in events}

    grid: list[list[dict | None]] = []
    for weekday in range(7):
        row: list[dict | None] = []
        for w in range(weeks):
            d = start + timedelta(weeks=w, days=weekday)
            if d > today:
                row.append(None)
            else:
                minutes = by_date.get(d, 0)
                row.append({
                    'date': d.isoformat(),
                    'minutes': minutes,
                    'band': _band_for_minutes(minutes),
                })
        grid.append(row)
    return grid


def get_getting_started(user) -> dict[str, Any]:
    """Onboarding checklist holatlari."""
    profile = getattr(user, 'b2c_profile', None)
    has_phone = bool(profile.phone_number) if profile else False
    has_target = bool(
        profile and profile.target_exam and profile.target_band is not None
    )
    has_first_event = B2CActivityEvent.objects.filter(user=user).exists()
    completed = bool(profile and profile.has_completed_onboarding)

    items = [
        {
            'key': 'profile',
            'label': "Profilni to'ldiring (telefon va maqsad)",
            'done': has_phone and has_target,
            'href': '/b2c/profile',
        },
        {
            'key': 'first_test',
            'label': 'Birinchi testni boshlang',
            'done': has_first_event,
            'href': '/b2c/catalog',
        },
        {
            'key': 'credits',
            'label': 'Kredit balansini tekshiring',
            'done': completed,
            'href': '/b2c/dashboard',
        },
        {
            'key': 'results',
            'label': "Natijalaringizni ko'ring",
            'done': has_first_event,
            'href': '/history',
        },
    ]
    done_count = sum(1 for i in items if i['done'])
    total = len(items)
    percent = int(round((done_count / total) * 100)) if total else 0

    return {
        'items': items,
        'done_count': done_count,
        'total': total,
        'percent': percent,
    }


def get_section_overview() -> list[dict[str, Any]]:
    """Section overview — B2C katalogdagi real testlar soni."""
    from . import catalog as catalog_service
    counts = catalog_service.get_section_counts()
    return [
        {
            'key': 'listening', 'name': 'Listening',
            'count': counts['listening'], 'accent': 'blue',
            'ready': counts['listening'] > 0,
        },
        {
            'key': 'reading', 'name': 'Reading',
            'count': counts['reading'], 'accent': 'rose',
            'ready': counts['reading'] > 0,
        },
        {
            'key': 'writing', 'name': 'Writing',
            'count': counts['writing'], 'accent': 'emerald',
            'ready': counts['writing'] > 0,
        },
        {
            'key': 'full_mock', 'name': 'Full Mock',
            'count': counts['full_mock'], 'accent': 'violet',
            'ready': counts['full_mock'] > 0,
        },
    ]
