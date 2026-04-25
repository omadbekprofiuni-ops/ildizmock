from django.core.management.base import BaseCommand

from apps.organizations.models import Plan


PLANS = [
    {'code': 'trial', 'name': 'Sinov',
     'max_students': 5, 'max_teachers': 1,
     'duration_days': 14, 'price_usd': 0,
     'features': []},
    {'code': 'starter', 'name': 'Starter',
     'max_students': 25, 'max_teachers': 2,
     'duration_days': 30, 'price_usd': 99,
     'features': ['analytics']},
    {'code': 'pro', 'name': 'Pro',
     'max_students': 100, 'max_teachers': 5,
     'duration_days': 30, 'price_usd': 299,
     'features': ['analytics', 'writing_priority']},
    {'code': 'enterprise', 'name': 'Enterprise',
     'max_students': -1, 'max_teachers': -1,
     'duration_days': 365, 'price_usd': 2400,
     'features': ['analytics', 'writing_priority', 'custom_brand']},
]


class Command(BaseCommand):
    help = 'Tarif rejalarini seed qiladi.'

    def handle(self, *args, **opts):
        for p in PLANS:
            obj, created = Plan.objects.update_or_create(code=p['code'], defaults=p)
            self.stdout.write(self.style.SUCCESS(
                f"  {'+' if created else '~'} {obj.code}: {obj.name} ({obj.max_students} talaba, ${obj.price_usd})"
            ))
        self.stdout.write(self.style.SUCCESS('=== Plans seeded ==='))
