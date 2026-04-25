from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.organizations.models import Organization, Payment, Plan

User = get_user_model()


class Command(BaseCommand):
    help = 'Demo seed: 1 superadmin + 2 centers + admin/teacher/student users.'

    @transaction.atomic
    def handle(self, *args, **opts):
        # 1. Superadmin
        superadmin, _ = User.objects.update_or_create(
            username='jasmina',
            defaults={
                'first_name': 'Jasmina', 'last_name': '',
                'role': 'superadmin',
                'is_staff': True, 'is_superuser': True, 'is_active': True,
                'organization': None,
            },
        )
        superadmin.set_password('jasmina')
        superadmin.save()

        try:
            pro = Plan.objects.get(code='pro')
            starter = Plan.objects.get(code='starter')
        except Plan.DoesNotExist:
            self.stdout.write(self.style.ERROR(
                'Plans not seeded. Run: manage.py seed_plans'))
            return

        # 2. Two demo organizations
        Organization.objects.filter(slug__in=['edutech', 'future']).delete()
        edutech = Organization.objects.create(
            name='EduTech Tashkent', slug='edutech',
            primary_color='#DC2626',
            contact_phone='+998901234567', contact_email='info@edutech.uz',
            address='Tashkent, Yunusobod',
            plan=pro, status='active',
            plan_starts_at=timezone.now(),
            plan_expires_at=timezone.now() + timedelta(days=25),
        )
        future = Organization.objects.create(
            name='Future Academy Samarqand', slug='future',
            primary_color='#2563EB',
            contact_phone='+998711234567', contact_email='info@future.uz',
            address='Samarqand center',
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
                notes='Initial demo seed payment',
            )

        # 3. Org admins
        admins = [
            ('edutech_admin', 'EduTech', 'Admin', edutech),
            ('future_admin', 'Future', 'Admin', future),
        ]
        for username, fn, ln, org in admins:
            User.objects.filter(username=username).delete()
            User.objects.create_user(
                username=username, password='admin',
                first_name=fn, last_name=ln,
                role='org_admin', organization=org, is_active=True,
            )

        # 4. EduTech teacher
        User.objects.filter(username='aziz').delete()
        teacher = User.objects.create_user(
            username='aziz', password='teacher',
            first_name='Aziz', last_name='Karimov',
            role='teacher', organization=edutech, is_active=True,
        )

        # 5. EduTech students
        STUDENTS = [
            ('dilnoza', 'Dilnoza', 'Rakhimova', '7.0'),
            ('sardor', 'Sardor', 'Karimov', '6.5'),
            ('nilufar', 'Nilufar', 'Yusupova', '8.0'),
        ]
        for username, fn, ln, target in STUDENTS:
            User.objects.filter(username=username).delete()
            User.objects.create_user(
                username=username, password='student',
                first_name=fn, last_name=ln,
                role='student', organization=edutech, teacher=teacher,
                target_band=target, is_active=True,
            )

        self.stdout.write(self.style.SUCCESS('=== Demo seed complete ==='))
        self.stdout.write(self.style.WARNING(
            '  Superadmin:    jasmina / jasmina\n'
            '  EduTech admin: edutech_admin / admin\n'
            '  Future admin:  future_admin / admin\n'
            '  Teacher:       aziz / teacher\n'
            '  Students:      dilnoza, sardor, nilufar / student\n'
        ))
