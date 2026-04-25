from django.core.management.base import BaseCommand

from apps.accounts.models import User


class Command(BaseCommand):
    help = 'Create or reset the platform superadmin (jasmina / jasmina).'

    def handle(self, *args, **opts):
        user, created = User.objects.update_or_create(
            username='jasmina',
            defaults={
                'role': 'superadmin',
                'first_name': 'Jasmina',
                'last_name': '',
                'is_staff': True,
                'is_superuser': True,
                'is_active': True,
                'must_change_password': False,
                'organization': None,
            },
        )
        user.set_password('jasmina')
        user.save()
        action = 'Created' if created else 'Reset'
        self.stdout.write(self.style.SUCCESS(
            f'{action} superadmin: jasmina / jasmina'
        ))
