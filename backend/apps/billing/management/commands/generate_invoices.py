"""ETAP 16 — oylik invoice'larni generatsiya qilish.

Har markaz uchun shu davrda yaratilgan, lekin hali biron BillingCycle'ga
biriktirilmagan MockSessionCharge'larni shu oyning BillingCycle'iga ulaydi.
total_sessions / total_students / total_amount qayta hisoblanadi va
invoice_number tayinlanadi.

Foydalanish:
    python manage.py generate_invoices                   # o'tgan oy
    python manage.py generate_invoices --month 5 --year 2026
    python manage.py generate_invoices --org edutech     # faqat bitta markaz
"""

from datetime import date

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.billing.models import BillingCycle, MockSessionCharge
from apps.organizations.models import Organization


def _previous_month(today: date) -> tuple[int, int]:
    if today.month == 1:
        return today.year - 1, 12
    return today.year, today.month - 1


def _month_range(year: int, month: int) -> tuple[date, date]:
    start = date(year, month, 1)
    if month == 12:
        end = date(year + 1, 1, 1)
    else:
        end = date(year, month + 1, 1)
    return start, end


class Command(BaseCommand):
    help = 'ETAP 16 — oylik invoice generatsiya (har markaz uchun BillingCycle).'

    def add_arguments(self, parser):
        parser.add_argument('--month', type=int, default=None)
        parser.add_argument('--year', type=int, default=None)
        parser.add_argument('--org', type=str, default=None,
                            help='Faqat bitta markaz (slug)')

    def handle(self, *args, **opts):
        today = timezone.now().date()
        if opts['month'] and opts['year']:
            year, month = opts['year'], opts['month']
        else:
            year, month = _previous_month(today)

        period_start, period_end = _month_range(year, month)
        self.stdout.write(self.style.SUCCESS(
            f'=== Invoice davri: {year}-{month:02d} ==='
        ))

        orgs = Organization.objects.all()
        if opts['org']:
            orgs = orgs.filter(slug=opts['org'])

        total_created = 0
        for org in orgs:
            charges = MockSessionCharge.objects.filter(
                session__organization=org,
                session__status='finished',
                is_charged=True,
                billing_cycle__isnull=True,
                charged_at__gte=period_start,
                charged_at__lt=period_end,
            )
            count = charges.count()
            if count == 0:
                self.stdout.write(f'  - {org.slug}: charge yo\'q')
                continue

            cycle, created = BillingCycle.objects.get_or_create(
                organization=org,
                year=year,
                month=month,
                defaults={
                    'period_start': period_start,
                    'period_end': period_end - (period_end - period_start) * 0,
                    'status': 'pending',
                },
            )
            charges.update(billing_cycle=cycle)
            cycle.calculate_totals()
            cycle.ensure_invoice_number()

            label = '+' if created else '~'
            self.stdout.write(self.style.SUCCESS(
                f'  {label} {org.slug}: {cycle.invoice_number} · '
                f'{cycle.total_sessions} sessiya · '
                f'{cycle.total_students} talaba · '
                f'{cycle.total_amount:,.0f} so\'m'
            ))
            total_created += 1

        self.stdout.write(self.style.SUCCESS(
            f'=== Jami {total_created} ta invoice yaratildi ==='
        ))
