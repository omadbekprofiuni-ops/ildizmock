"""Production safety net: birinchi so'rovda pending migration'larni qo'llaydi.

`config/wsgi.py` da auto-migrate hookimiz bor, lekin ba'zi deploy
oqimlarida (zero-downtime hot-reload, eski gunicorn worker) u ishlamasligi
mumkin. Bu middleware har process'da bir marta DB schema'ni tekshiradi va
agar pending migration bo'lsa qo'llaydi.

Idempotent — Django migration jadvalini lock qiladi, parallel workerlar
xavfsiz.
"""

import logging
import os
import threading

logger = logging.getLogger(__name__)

_migration_lock = threading.Lock()
_migration_done = False


def _ensure_migrated() -> None:
    global _migration_done
    if _migration_done:
        return
    if os.environ.get('AUTO_MIGRATE', '1') != '1':
        _migration_done = True
        return
    with _migration_lock:
        if _migration_done:
            return
        try:
            from django.db import connection
            from django.db.migrations.executor import MigrationExecutor

            executor = MigrationExecutor(connection)
            targets = executor.loader.graph.leaf_nodes()
            plan = executor.migration_plan(targets)
            if plan:
                from django.core.management import call_command
                logger.warning(
                    'auto-migrate: %d pending migration qo\'llanyapti', len(plan),
                )
                call_command('migrate', '--noinput', verbosity=0)
            # django_migrations jadvali "applied" desa-da, ba'zi serverlarda
            # haqiqiy ustun yo'q (--fake migrate yoki DB snapshot tiklanishi
            # sabab). schema'ni model bilan solishtirib yetishmaganlarni
            # qo'shamiz.
            from django.core.management import call_command
            call_command('heal_schema', '--apply', verbosity=0)
        except Exception as exc:  # noqa: BLE001
            logger.warning('auto-migrate middleware skipped: %s', exc)
        finally:
            _migration_done = True


class AutoMigrateMiddleware:
    """Birinchi request'da pending migration'larni qo'llaydi."""

    def __init__(self, get_response):
        self.get_response = get_response
        # Process boot vaqti — birinchi keladigan request'gacha kechiktiramiz
        # ki, manage.py buyruqlari ham ishlaydi (test/migrate o'zi).

    def __call__(self, request):
        _ensure_migrated()
        return self.get_response(request)
