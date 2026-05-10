"""HOTFIX — MockParticipant.audio_played_parts uchun idempotent migration.

Spec'ga ko'ra refresh-safe audio playback uchun MockParticipant'ga
audio_played_parts JSONField qo'shamiz. Ba'zi serverlarda bu ustun
oldingi qisman migration'lar sabab allaqachon mavjud bo'lishi mumkin
(ProgrammingError: column already exists).

Yechim: SeparateDatabaseAndState bilan idempotent. State'ga AddField
ro'yxatga olinadi, DB tomonida ALTER TABLE ... ADD COLUMN IF NOT EXISTS
ishlatamiz.
"""
from django.db import migrations, models


ADD_SQL = """
ALTER TABLE mock_participants
    ADD COLUMN IF NOT EXISTS audio_played_parts JSONB NOT NULL DEFAULT '[]'::jsonb;
"""

DROP_SQL = """
ALTER TABLE mock_participants DROP COLUMN IF EXISTS audio_played_parts;
"""


class Migration(migrations.Migration):

    dependencies = [
        ('mock', '0011_remove_pdf_test_fields'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AddField(
                    model_name='mockparticipant',
                    name='audio_played_parts',
                    field=models.JSONField(
                        blank=True, default=list,
                        help_text='List of part orders whose audio has finished: [1, 2, ...]',
                    ),
                ),
            ],
            database_operations=[
                migrations.RunSQL(sql=ADD_SQL, reverse_sql=DROP_SQL),
            ],
        ),
    ]
