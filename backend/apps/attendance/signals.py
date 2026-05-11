"""ETAP 28 — Attendance signal handler'lari.

AttendanceRecord saqlanganida:
1. Mavjud yozuv tahrirlangan bo'lsa edited_count'ni 1 ga oshiradi.
2. Status = 'absent' bo'lsa, escalation tekshiruvini ishga tushiradi.

ETAP 20 — Yangi AttendanceSession yaratilganda guruhdagi har talabaga
avtomatik AttendanceRecord (status=null) yaratiladi.
"""
from __future__ import annotations

from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from .models import AttendanceRecord, AttendanceSession


@receiver(post_save, sender=AttendanceSession)
def _bootstrap_records_for_session(sender, instance: AttendanceSession, created: bool, **kwargs):
    """ETAP 20 — Sessiya yaratilganda guruhdagi har faol talabaga bo'sh record.

    Idempotent: `unique_together=(session, student)` tufayli `ignore_conflicts=True`
    bilan ishonchli — eskidan mavjud yozuvlarga tegmaydi (masalan, mavjud
    `CenterAttendanceSessionViewSet.create` allaqachon `status='present'` bilan
    yaratgan bo'lsa).
    """
    if not created:
        return
    group = getattr(instance, 'group', None)
    if group is None:
        return
    students = group.members.filter(role='student', is_active=True)
    records = [
        AttendanceRecord(session=instance, student=s, status=None)
        for s in students
    ]
    if records:
        AttendanceRecord.objects.bulk_create(records, ignore_conflicts=True)


@receiver(pre_save, sender=AttendanceRecord)
def _bump_edited_count(sender, instance: AttendanceRecord, **kwargs):
    """Mavjud yozuvning statusi yoki notes maydoni o'zgargan bo'lsa
    edited_count'ni oshiramiz. Yangi yozuvga ta'sir qilmaydi.
    """
    if not instance.pk:
        return
    try:
        old = sender.objects.get(pk=instance.pk)
    except sender.DoesNotExist:
        return
    if old.status != instance.status or old.notes != instance.notes:
        instance.edited_count = (old.edited_count or 0) + 1


@receiver(post_save, sender=AttendanceRecord)
def _trigger_escalation(sender, instance: AttendanceRecord, **kwargs):
    """Status='absent' bo'lsa shu talaba uchun escalation tekshiruvini
    ishga tushiradi (idempotent).
    """
    if instance.status != 'absent':
        return
    # Lazy import: import vaqtida circular import oldini olamiz.
    from .services.escalation import check_and_create_escalations

    group = instance.session.group if instance.session_id else None
    if group is None:
        return
    check_and_create_escalations(instance.student, group)
