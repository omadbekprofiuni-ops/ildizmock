"""DB schema'ni model bilan solishtirib, yetishmayotgan ustunlarni qo'shadi.

Muammo: ba'zi server'larda `django_migrations` jadvali "applied" deb yozadi,
lekin `migrate --fake` ishga tushirilgan yoki DB boshqa snapshot'dan tiklanganligi
sababli haqiqiy ustun yo'q. Oddiy `migrate` ishlamaydi (Django pending yo'q deb
o'ylaydi).

Bu buyruq Django introspection bilan har modelni jadval ustunlari bilan
solishtiradi va yetishmaganlarini schema_editor orqali qo'shadi. Idempotent —
mavjudlarni qayta qo'shmaydi.

Foydalanish:
    python manage.py heal_schema           # quruq tekshiruv (faqat o'qiydi)
    python manage.py heal_schema --apply   # haqiqatda ALTER TABLE ishga tushiradi
"""

from django.apps import apps
from django.core.management.base import BaseCommand
from django.db import connection


class Command(BaseCommand):
    help = 'Model va DB schema farqini topib yetishmayotgan ustunlarni qo‘shadi.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--apply', action='store_true',
            help='Haqiqatda ALTER TABLE ishga tushiriladi. Aks holda faqat hisobot.',
        )
        parser.add_argument(
            '--app', default=None,
            help='Faqat bitta app uchun (masalan: mock).',
        )

    def handle(self, *args, **opts):
        apply = opts['apply']
        only_app = opts['app']

        try:
            existing_tables = set(connection.introspection.table_names())
        except Exception as exc:  # noqa: BLE001
            self.stderr.write(f'DB ulanmadi: {exc}')
            return

        missing_total = 0
        for model in apps.get_models():
            if only_app and model._meta.app_label != only_app:
                continue
            table = model._meta.db_table
            if table not in existing_tables:
                # Jadvalning o'zi yo'q — bu boshqa muammo (migrate kerak)
                self.stdout.write(self.style.WARNING(
                    f'JADVAL YO‘Q: {table}  (app={model._meta.app_label})'
                ))
                continue

            with connection.cursor() as cursor:
                description = connection.introspection.get_table_description(
                    cursor, table,
                )
            existing_cols = {col.name for col in description}

            missing = []
            for field in model._meta.local_fields:
                if not field.column:
                    continue
                if field.column in existing_cols:
                    continue
                missing.append(field)

            if not missing:
                continue

            missing_total += len(missing)
            self.stdout.write(self.style.NOTICE(
                f'{table}: {len(missing)} ustun yetishmayapti'
            ))
            for field in missing:
                self.stdout.write(f'  - {field.column} ({field.__class__.__name__})')

            if apply:
                with connection.schema_editor() as editor:
                    for field in missing:
                        try:
                            editor.add_field(model, field)
                            self.stdout.write(self.style.SUCCESS(
                                f'  + qo‘shildi: {field.column}'
                            ))
                        except Exception as exc:  # noqa: BLE001
                            self.stderr.write(
                                f'  ! {field.column}: {type(exc).__name__}: {exc}'
                            )

        if missing_total == 0:
            self.stdout.write(self.style.SUCCESS('Schema to‘liq mos — yetishmayotgan ustun yo‘q.'))
        elif not apply:
            self.stdout.write(self.style.WARNING(
                f'\nJami {missing_total} ustun yetishmayapti. '
                "Haqiqatda qo'shish uchun: python manage.py heal_schema --apply"
            ))
        else:
            self.stdout.write(self.style.SUCCESS(
                f'\nJami {missing_total} ustun qo‘shildi.'
            ))
