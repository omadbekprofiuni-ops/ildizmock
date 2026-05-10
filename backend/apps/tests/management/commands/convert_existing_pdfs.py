"""Mavjud PDFTest'lar uchun pdf_pages'ni to'ldiradigan backfill.

Ishga tushirish:
    python manage.py convert_existing_pdfs

Avval `poppler-utils` paket o'rnatilganligiga ishonch hosil qiling
(server: `sudo apt install -y poppler-utils`, mac: `brew install poppler`).
"""

from django.core.management.base import BaseCommand

from apps.tests.models import PDFTest
from apps.tests.utils.pdf_convert import convert_pdf_to_pages


class Command(BaseCommand):
    help = "PDF testlarda pdf_pages bo'sh bo'lganlarini PNG'ga aylantiradi."

    def add_arguments(self, parser):
        parser.add_argument(
            '--force', action='store_true',
            help='Allaqachon konvertatsiya qilinganlarni ham qaytadan aylantirish.',
        )
        parser.add_argument(
            '--dpi', type=int, default=150,
            help='Sahifa DPI (default 150). 200 — keskinroq, lekin sekinroq.',
        )

    def handle(self, *args, **opts):
        qs = PDFTest.objects.exclude(pdf_file='').exclude(pdf_file__isnull=True)
        if not opts['force']:
            qs = qs.filter(pdf_page_count=0)

        total = qs.count()
        self.stdout.write(f'Konvertatsiya: {total} ta PDF...')

        ok = 0
        failed = 0
        for i, t in enumerate(qs, start=1):
            try:
                pages = convert_pdf_to_pages(
                    t.pdf_file.path,
                    f'pdf_pages/{t.public_id}',
                    dpi=opts['dpi'],
                )
                t.pdf_pages = pages
                t.pdf_page_count = len(pages)
                t.save(update_fields=['pdf_pages', 'pdf_page_count'])
                self.stdout.write(
                    f'  [{i}/{total}] {t.public_id} — {t.name!r} → {len(pages)} sahifa',
                )
                ok += 1
            except Exception as e:
                self.stderr.write(
                    f'  [{i}/{total}] FAILED {t.public_id} — {t.name!r}: {e}',
                )
                failed += 1

        self.stdout.write(
            self.style.SUCCESS(f'\nTugadi — muvaffaqiyatli: {ok}, xatolik: {failed}'),
        )
