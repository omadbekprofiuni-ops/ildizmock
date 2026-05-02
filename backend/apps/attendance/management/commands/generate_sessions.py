"""ETAP 15 — auto-generate attendance sessions from active schedules.

Har guruhning haftalik jadvali asosida keyingi N kunlar (default 30) uchun
AttendanceSession yozuvlarini avtomatik yaratadi. Talaba records'lari
default 'present' bilan to'ldiriladi.

Foydalanish:
    python manage.py generate_sessions               # +30 kun
    python manage.py generate_sessions --days 60     # +60 kun
    python manage.py generate_sessions --org edutech # faqat bitta markaz
"""

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.attendance.models import AttendanceRecord, AttendanceSession
from apps.organizations.models import StudentGroup


class Command(BaseCommand):
    help = 'Auto-generate attendance sessions from active group schedules.'

    def add_arguments(self, parser):
        parser.add_argument('--days', type=int, default=30,
                            help='Necha kun oldinga (default: 30)')
        parser.add_argument('--org', type=str, default=None,
                            help='Faqat berilgan markaz (slug)')

    def handle(self, *args, **opts):
        days = opts['days']
        org_slug = opts['org']

        today = timezone.now().date()
        end_date = today + timedelta(days=days)

        groups = StudentGroup.objects.filter(is_active=True)
        if org_slug:
            groups = groups.filter(organization__slug=org_slug)

        total_created = 0
        for group in groups.select_related('organization'):
            schedules = list(group.schedules.filter(is_active=True))
            if not schedules:
                continue

            current = today
            created_for_group = 0
            while current <= end_date:
                dow = current.weekday()
                for sch in schedules:
                    if sch.day_of_week != dow:
                        continue
                    if AttendanceSession.objects.filter(
                        group=group, date=current,
                    ).exists():
                        continue
                    session = AttendanceSession.objects.create(
                        group=group,
                        schedule=sch,
                        date=current,
                        start_time=sch.start_time,
                        end_time=sch.end_time,
                        created_by=None,
                    )
                    # Talaba yozuvlari default present
                    students = group.members.filter(role='student', is_active=True)
                    AttendanceRecord.objects.bulk_create([
                        AttendanceRecord(session=session, student=s, status='present')
                        for s in students
                    ])
                    created_for_group += 1
                current += timedelta(days=1)

            if created_for_group:
                self.stdout.write(
                    f'  {group.organization.slug}/{group.name}: '
                    f'+{created_for_group} sessiya'
                )
                total_created += created_for_group

        self.stdout.write(self.style.SUCCESS(
            f'=== {total_created} ta sessiya yaratildi ({days} kun ichida) ==='
        ))
