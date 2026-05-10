"""ETAP 29 hotfix — TestSecurityViolation jadvalini qo'lda yaratish.

Migration 0004 `migrate --fake` qilingan vaqtda (chunki Attempt'ning ba'zi
ustunlari prod'da allaqachon mavjud edi) — lekin CreateModel operatsiyasi
ham fake bo'lib o'tdi va `attempts_testsecurityviolation` jadvali
yaratilmadi. Bu fix migration shu jadvalni IF NOT EXISTS bilan idempotent
yaratadi.

state_operations=[] — Django'ning ichki state'iga ta'sir qilmaymiz, chunki
0004 model'ni state'da allaqachon yaratgan. Faqat database tomonida
o'tkazib yuborilgan DDL'ni qaytaramiz.
"""
from django.db import migrations


CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS attempts_testsecurityviolation (
    id BIGSERIAL PRIMARY KEY,
    type VARCHAR(32) NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    duration_ms INTEGER NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    counted BOOLEAN NOT NULL DEFAULT TRUE,
    attempt_id UUID NOT NULL REFERENCES attempts_attempt(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX IF NOT EXISTS attempts_te_attempt_9ae96f_idx
    ON attempts_testsecurityviolation (attempt_id, type);
CREATE INDEX IF NOT EXISTS attempts_te_occurre_f7ade4_idx
    ON attempts_testsecurityviolation (occurred_at);
"""

DROP_TABLE_SQL = """
DROP TABLE IF EXISTS attempts_testsecurityviolation CASCADE;
"""


class Migration(migrations.Migration):

    dependencies = [
        ('attempts', '0004_attempt_auto_submit_reason_attempt_auto_submitted_and_more'),
    ]

    operations = [
        migrations.RunSQL(
            sql=CREATE_TABLE_SQL,
            reverse_sql=DROP_TABLE_SQL,
        ),
    ]
