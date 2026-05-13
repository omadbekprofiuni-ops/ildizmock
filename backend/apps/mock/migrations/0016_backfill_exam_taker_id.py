"""ETAP 21 — Mavjud MockParticipant'larga Exam Taker ID berish.

`IELTS-YYYY-NNNN` formatida. Sessiya date'ining yiliga qarab bo'linib,
joined_at bo'yicha tartiblanib, har biriga ketma-ket raqam beriladi.
"""

from django.db import migrations


def backfill_exam_taker_ids(apps, schema_editor):
    MockParticipant = apps.get_model('mock', 'MockParticipant')

    qs = (
        MockParticipant.objects
        .select_related('session')
        .order_by('session__date', 'joined_at', 'id')
    )

    year_counters: dict[int, int] = {}
    for p in qs:
        if p.exam_taker_id:
            continue
        year = p.session.date.year
        year_counters[year] = year_counters.get(year, 0) + 1
        p.exam_taker_id = f'IELTS-{year}-{year_counters[year]:04d}'
        p.save(update_fields=['exam_taker_id'])


def noop_reverse(apps, schema_editor):
    """Reverse — exam_taker_id'larni bo'shatish (idempotent uchun)."""
    MockParticipant = apps.get_model('mock', 'MockParticipant')
    MockParticipant.objects.update(exam_taker_id='')


class Migration(migrations.Migration):

    dependencies = [
        ('mock', '0015_mockparticipant_exam_taker_id_and_more'),
    ]

    operations = [
        migrations.RunPython(backfill_exam_taker_ids, noop_reverse),
    ]
