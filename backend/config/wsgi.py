"""WSGI entry point.

Production'da `AUTO_MIGRATE=1` (default) bo'lsa, gunicorn worker ishga
tushganda pending migrationlarni avtomatik qo'llaymiz. Bu kichik
deployment'lar uchun foydali — har gal yangi kod chiqarilganida qo'lda
"manage.py migrate" ishga tushirish shart bo'lmaydi.
"""

import logging
import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

application = get_wsgi_application()


def _auto_migrate() -> None:
    if os.environ.get('AUTO_MIGRATE', '1') != '1':
        return
    try:
        from django.core.management import call_command
        call_command('migrate', '--noinput', verbosity=0)
    except Exception as exc:  # noqa: BLE001 — startup xatoni shunchaki log qilamiz
        logging.getLogger(__name__).warning('auto-migrate skipped: %s', exc)


_auto_migrate()
