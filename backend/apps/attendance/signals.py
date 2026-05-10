"""ETAP 28 — Attendance signal handler'lari.

AttendanceRecord saqlanganida:
1. Mavjud yozuv tahrirlangan bo'lsa edited_count'ni 1 ga oshiradi.
2. Status = 'absent' bo'lsa, escalation tekshiruvini ishga tushiradi.
"""
from __future__ import annotations

from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from .models import AttendanceRecord


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
