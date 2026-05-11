"""ETAP 16.6 — Test.source va source_custom_name field'lari.

Idempotent: `heal_schema` allaqachon ustunlarni qo'shgan bo'lishi mumkin
(local dev) yoki yo'q (yangi server). SeparateDatabaseAndState bilan:
  - state_operations: Django ORM state'iga AddField'larni qaydlaydi
  - database_operations: `ADD COLUMN IF NOT EXISTS` orqali ikkala holatda
    ham xavfsiz ishlaydi (mavjud ustunni qayta qo'shmaydi).
"""

from django.db import migrations, models


SOURCE_CHOICES = [
    ('cambridge_7', 'Cambridge 7'),
    ('cambridge_8', 'Cambridge 8'),
    ('cambridge_9', 'Cambridge 9'),
    ('cambridge_10', 'Cambridge 10'),
    ('cambridge_11', 'Cambridge 11'),
    ('cambridge_12', 'Cambridge 12'),
    ('cambridge_13', 'Cambridge 13'),
    ('cambridge_14', 'Cambridge 14'),
    ('cambridge_15', 'Cambridge 15'),
    ('cambridge_16', 'Cambridge 16'),
    ('cambridge_17', 'Cambridge 17'),
    ('cambridge_18', 'Cambridge 18'),
    ('cambridge_19', 'Cambridge 19'),
    ('cambridge_20', 'Cambridge 20'),
    ('real_exam_2024', 'Real Exam 2024'),
    ('real_exam_2025', 'Real Exam 2025'),
    ('real_exam_2026', 'Real Exam 2026'),
    ('ildiz_original', 'ILDIZ Original'),
    ('other', 'Boshqa'),
]

ADD_COLUMNS_SQL = """
ALTER TABLE tests_test
    ADD COLUMN IF NOT EXISTS source VARCHAR(30) NOT NULL DEFAULT 'other';
ALTER TABLE tests_test
    ADD COLUMN IF NOT EXISTS source_custom_name VARCHAR(100) NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS tests_test_source_idx ON tests_test (source);
"""

DROP_COLUMNS_SQL = """
DROP INDEX IF EXISTS tests_test_source_idx;
ALTER TABLE tests_test DROP COLUMN IF EXISTS source_custom_name;
ALTER TABLE tests_test DROP COLUMN IF EXISTS source;
"""


class Migration(migrations.Migration):

    dependencies = [
        ('tests', '0016_test_available_for_b2c_test_b2c_description_and_more'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AddField(
                    model_name='test',
                    name='source',
                    field=models.CharField(
                        choices=SOURCE_CHOICES,
                        db_index=True,
                        default='other',
                        max_length=30,
                    ),
                ),
                migrations.AddField(
                    model_name='test',
                    name='source_custom_name',
                    field=models.CharField(
                        blank=True, default='', max_length=100,
                        help_text=(
                            "source=OTHER bo'lsa, erkin nom yozish mumkin "
                            "(masalan, 'IELTS Original 2026')."
                        ),
                    ),
                ),
            ],
            database_operations=[
                migrations.RunSQL(
                    sql=ADD_COLUMNS_SQL,
                    reverse_sql=DROP_COLUMNS_SQL,
                ),
            ],
        ),
    ]
