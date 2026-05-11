"""B2C catalog uchun queryset filterlari va aggregatsiyalar.

Test modelining `available_for_b2c=True` bo'lgan instance'larigina ko'rinadi.
Bu xizmat B2C foydalanuvchi sahifalari (catalog list/detail) hamda dashboard
section overview uchun ishlatiladi.
"""

from __future__ import annotations

from django.db.models import Count, Q

from apps.tests.models import Test


SECTION_CHOICES = [
    ('all', 'Barchasi'),
    ('listening', 'Listening'),
    ('reading', 'Reading'),
    ('writing', 'Writing'),
    ('full_mock', 'Full Mock'),
]

DIFFICULTY_CHOICES = [
    ('all', 'Barcha darajalar'),
    ('easy', 'Oson'),
    ('medium', "O'rta"),
    ('hard', 'Qiyin'),
]

# Test modeli `module` field ishlatadi (`section_type` emas).
SECTION_FIELD = 'module'


def get_published_tests():
    """Faqat B2C uchun chiqarilgan, o'chirilmagan testlar."""
    return Test.objects.filter(
        available_for_b2c=True,
        is_deleted=False,
    )


def filter_catalog(section: str | None = None,
                   difficulty: str | None = None,
                   source: str | None = None,
                   query: str | None = None):
    qs = get_published_tests()

    if section and section != 'all':
        qs = qs.filter(module=section)

    if difficulty and difficulty != 'all':
        # Test modeli `easy/medium/hard` aliaslarini ham qo'llab-quvvatlaydi
        # shuning uchun to'g'ridan-to'g'ri uzatamiz.
        qs = qs.filter(difficulty=difficulty)

    if source and source != 'all':
        qs = qs.filter(source=source)

    if query:
        qs = qs.filter(
            Q(name__icontains=query)
            | Q(b2c_display_name__icontains=query)
            | Q(b2c_description__icontains=query)
            | Q(source_custom_name__icontains=query),
        )

    return qs.order_by('source', '-b2c_published_at', '-created_at')


def get_section_counts() -> dict[str, int]:
    """Dashboard kartochkalari uchun module bo'yicha sonlar."""
    qs = get_published_tests()
    rows = qs.values('module').annotate(c=Count('id'))
    by_module = {r['module']: r['c'] for r in rows}
    return {
        'listening': by_module.get('listening', 0),
        'reading': by_module.get('reading', 0),
        'writing': by_module.get('writing', 0),
        'full_mock': by_module.get('full_mock', 0),
        'total': qs.count(),
    }


def get_available_sources() -> list[dict[str, str]]:
    """Catalog dropdown'i uchun manbalar — faqat ishlatilayotgan source'lar.

    Bo'sh (testi yo'q) source'lar dropdown'ga tushmaydi. Tartib:
    TextChoices'dagi tartib (Cambridge 7 → 20 → Real Exam → ILDIZ → Other).
    """
    used = (
        get_published_tests()
        .exclude(source='')
        .values_list('source', flat=True)
        .distinct()
    )
    used_set = set(used)

    sources: list[dict[str, str]] = [{'key': 'all', 'label': 'Barcha manbalar'}]
    for choice_key, choice_label in Test.Source.choices:
        if choice_key in used_set:
            sources.append({'key': choice_key, 'label': choice_label})
    return sources
