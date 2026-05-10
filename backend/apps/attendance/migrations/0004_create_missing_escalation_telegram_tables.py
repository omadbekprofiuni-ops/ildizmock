"""ETAP 28 hotfix — AttendanceEscalation + TelegramBinding jadvallarini
qo'lda yaratish.

Migration 0003 `migrate --fake` qilingan vaqtda (chunki AttendanceSession.
locked_at va boshqa ustunlar prod'da allaqachon mavjud edi) — yangi
CreateModel operatsiyalari ham fake bo'lib o'tdi. Bu fix migration shu
ikki jadvalni IF NOT EXISTS bilan idempotent yaratadi.
"""
from django.db import migrations


CREATE_TABLES_SQL = """
CREATE TABLE IF NOT EXISTS attendance_escalations (
    id BIGSERIAL PRIMARY KEY,
    tier VARCHAR(16) NOT NULL,
    absence_count SMALLINT NOT NULL CHECK (absence_count >= 0),
    triggered_at TIMESTAMPTZ NOT NULL,
    resolved_at TIMESTAMPTZ NULL,
    resolution_note TEXT NOT NULL DEFAULT '',
    student_id BIGINT NOT NULL REFERENCES accounts_user(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
    group_id BIGINT NOT NULL REFERENCES organizations_studentgroup(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
    resolved_by_id BIGINT NULL REFERENCES accounts_user(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX IF NOT EXISTS attendance__student_3612c6_idx
    ON attendance_escalations (student_id, tier, resolved_at);

CREATE TABLE IF NOT EXISTS attendance_telegram_bindings (
    id BIGSERIAL PRIMARY KEY,
    chat_id VARCHAR(32) NOT NULL,
    parent_name VARCHAR(100) NOT NULL DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    bound_at TIMESTAMPTZ NOT NULL,
    student_id BIGINT NOT NULL REFERENCES accounts_user(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
    UNIQUE (student_id, chat_id)
);
CREATE INDEX IF NOT EXISTS attendance__chat_id_a3e6ac_idx
    ON attendance_telegram_bindings (chat_id);
"""

DROP_TABLES_SQL = """
DROP TABLE IF EXISTS attendance_telegram_bindings CASCADE;
DROP TABLE IF EXISTS attendance_escalations CASCADE;
"""


class Migration(migrations.Migration):

    dependencies = [
        ('attendance', '0003_attendancerecord_edited_count_and_more'),
    ]

    operations = [
        migrations.RunSQL(
            sql=CREATE_TABLES_SQL,
            reverse_sql=DROP_TABLES_SQL,
        ),
    ]
