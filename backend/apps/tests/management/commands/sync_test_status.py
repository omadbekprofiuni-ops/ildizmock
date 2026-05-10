"""ETAP fix — `Test.status` va `Test.is_published` maydonlarini sinxronlash.

Test modelida ikkita status indikatori bor:
- is_published (Bool, eski) — default=True
- status (CharField, ETAP 2'da qo'shilgan) — default='draft'

Eski testlar status='draft' bilan tug'ilgan, lekin is_published=True
bo'lishi mumkin. Bu admin/mock endpoint filterlariga zarar yetkazadi.

Buyruq:
    python manage.py sync_test_status

Mantiq:
- is_published=True va is_deleted=False bo'lgan testlarni status='published'
  ga o'tkazadi.
- is_published=False bo'lganlar tegilmaydi (admin ataylab unpublish qilgan).
"""
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.tests.models import Test


class Command(BaseCommand):
    help = (
        "Sync Test.status='published' for legacy tests where is_published=True "
        "but status='draft' (idempotent)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run', action='store_true',
            help='Show what would change without writing to DB',
        )

    def handle(self, *args, **opts):
        dry = opts.get('dry_run', False)

        qs = Test.objects.filter(
            is_published=True,
            is_deleted=False,
        ).exclude(status='published')

        total = qs.count()
        self.stdout.write(f'Found {total} test(s) to sync.')

        if dry:
            for t in qs[:20]:
                self.stdout.write(
                    f'  [dry-run] {t.id} — {t.name[:60]} '
                    f'(status={t.status} → published)',
                )
            if total > 20:
                self.stdout.write(f'  ... and {total - 20} more.')
            return

        now = timezone.now()
        updated = 0
        for t in qs:
            t.status = 'published'
            if not t.published_at:
                t.published_at = now
            t.save(update_fields=['status', 'published_at'])
            updated += 1
            if updated % 50 == 0:
                self.stdout.write(f'  Updated {updated}/{total}...')

        self.stdout.write(
            self.style.SUCCESS(f'Done. Updated {updated} test(s).'),
        )
