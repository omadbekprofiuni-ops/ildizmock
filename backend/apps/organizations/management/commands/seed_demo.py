from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.organizations.models import Organization, Payment, Plan

User = get_user_model()


class Command(BaseCommand):
    help = 'Demo seed: 1 superadmin + 2 markaz + admin/teacher/student.'

    @transaction.atomic
    def handle(self, *args, **opts):
        # 1. Superadmin
        superadmin, created = User.objects.update_or_create(
            phone='+998900000000',
            defaults={
                'first_name': 'Super', 'last_name': 'Admin',
                'role': 'superadmin',
                'is_staff': True, 'is_superuser': True, 'is_active': True,
                'organization': None,
            },
        )
        superadmin.set_password('admin123')
        superadmin.save()
        self.stdout.write(self.style.SUCCESS(
            f"  {'+' if created else '~'} Superadmin: {superadmin.phone}"))

        pro = Plan.objects.get(code='pro')
        starter = Plan.objects.get(code='starter')

        # 2. Two demo organizations
        Organization.objects.filter(slug__in=['edutech', 'future']).delete()

        edutech = Organization.objects.create(
            name='EduTech Tashkent', slug='edutech',
            primary_color='#DC2626',
            contact_phone='+998901234567',
            contact_email='info@edutech.uz',
            address='Toshkent, Yunusobod',
            plan=pro, status='active',
            plan_starts_at=timezone.now(),
            plan_expires_at=timezone.now() + timedelta(days=25),
        )
        future = Organization.objects.create(
            name='Future Academy Samarqand', slug='future',
            primary_color='#2563EB',
            contact_phone='+998711234567',
            contact_email='info@future.uz',
            address='Samarqand markaz',
            plan=starter, status='active',
            plan_starts_at=timezone.now(),
            plan_expires_at=timezone.now() + timedelta(days=15),
        )
        for org in (edutech, future):
            Payment.objects.create(
                organization=org, plan=org.plan,
                amount_usd=org.plan.price_usd, status='paid',
                marked_paid_by=superadmin,
                paid_at=timezone.now(),
                notes='Demo seed initial payment',
            )
            self.stdout.write(self.style.SUCCESS(
                f'  + {org.slug}: {org.name} ({org.plan.name}, {org.days_remaining}d)'))

        # 3. Org admins (one per org)
        admin_specs = [
            ('+998901100001', 'EduTech', 'Admin', edutech),
            ('+998902100002', 'Future', 'Admin', future),
        ]
        for phone, fn, ln, org in admin_specs:
            User.objects.filter(phone=phone).delete()
            u = User.objects.create_user(
                phone=phone, password='admin123',
                first_name=fn, last_name=ln,
                role='org_admin', organization=org, is_active=True,
            )
            self.stdout.write(self.style.SUCCESS(
                f'  + Org admin {org.slug}: {u.phone} (admin123)'))

        # 4. EduTech teacher + 3 students
        User.objects.filter(phone='+998900000001').delete()
        teacher = User.objects.create_user(
            phone='+998900000001', password='teacher123',
            first_name='Aziz', last_name='Karimov',
            role='teacher', organization=edutech, is_active=True,
        )
        self.stdout.write(self.style.SUCCESS(
            f'  + Teacher (edutech): {teacher.phone} (teacher123)'))

        STUDENTS = [
            ('+998901111111', 'Dilnoza', 'Rahimova', '7.0'),
            ('+998902222222', 'Sardor', 'Karimov', '6.5'),
            ('+998903333333', 'Nilufar', 'Yusupova', '8.0'),
        ]
        for phone, fn, ln, target in STUDENTS:
            User.objects.filter(phone=phone).delete()
            User.objects.create_user(
                phone=phone, password='student123',
                first_name=fn, last_name=ln,
                role='student', organization=edutech, teacher=teacher,
                target_band=target, is_active=True,
            )
        self.stdout.write(self.style.SUCCESS(
            f'  + 3 students assigned to {teacher} in {edutech.slug}'))

        self.stdout.write(self.style.SUCCESS('=== Demo seed complete ==='))
        self.stdout.write(self.style.WARNING(
            '  Login: +998900000000 / admin123  (superadmin)\n'
            '  Login: +998901100001 / admin123  (EduTech admin)\n'
            '  Login: +998902100002 / admin123  (Future admin)\n'
            '  Login: +998900000001 / teacher123 (Aziz, edutech)\n'
            '  Login: +998901111111 / student123 (Dilnoza, edutech)\n'
        ))
