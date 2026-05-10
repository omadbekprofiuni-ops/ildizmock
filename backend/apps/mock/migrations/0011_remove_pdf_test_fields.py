"""HOTFIX — MockSession'dan listening_pdf_test va reading_pdf_test
fieldlarini olib tashlash.

Spec aytadi: PDF approach tashlab qoldirildi, ETAP 30 HTML-based test'larga
o'tildi. Bu fieldlar mock_sessions jadvalida tartibsiz holatda edi:
ba'zi serverlarda ustun mavjud, ba'zilarida yo'q (ProgrammingError:
column "listening_pdf_test_id" does not exist).

Yechim: SeparateDatabaseAndState bilan idempotent DROP COLUMN IF EXISTS.
- state_operations: Django state'idan field olib tashlanadi (model bilan
  moslik).
- database_operations: ustun mavjud bo'lsa DROP qilinadi, bo'lmasa
  hech narsa qilinmaydi (xato chiqmaydi — IF EXISTS).
"""
from django.db import migrations


DROP_SQL = """
ALTER TABLE mock_sessions DROP COLUMN IF EXISTS listening_pdf_test_id CASCADE;
ALTER TABLE mock_sessions DROP COLUMN IF EXISTS reading_pdf_test_id CASCADE;
"""


class Migration(migrations.Migration):

    dependencies = [
        ('mock', '0010_mocksession_pdf_tests'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.RemoveField(
                    model_name='mocksession',
                    name='listening_pdf_test',
                ),
                migrations.RemoveField(
                    model_name='mocksession',
                    name='reading_pdf_test',
                ),
            ],
            database_operations=[
                migrations.RunSQL(
                    sql=DROP_SQL,
                    reverse_sql=migrations.RunSQL.noop,
                ),
            ],
        ),
    ]
