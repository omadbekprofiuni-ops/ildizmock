"""B2C signal handler'lari.

Yangi B2C profil yaratilganda foydalanuvchiga `B2C_SIGNUP_BONUS_CREDITS` (3 credit)
avtomatik beriladi. Bonus faqat profil birinchi marta yaratilganda yoziladi va
shu user uchun ikkinchi signup_bonus tranzaksiya bo'lmasligi tekshiriladi.
"""
import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import (
    B2C_SIGNUP_BONUS_CREDITS,
    B2CProfile,
    CreditTransaction,
)

log = logging.getLogger(__name__)


@receiver(post_save, sender=B2CProfile)
def grant_signup_bonus(sender, instance, created, **kwargs):
    if not created:
        return
    user = instance.user
    # Idempotent — agar shu user uchun signup_bonus mavjud bo'lsa, qayta bermaymiz
    if CreditTransaction.objects.filter(
        user=user, kind=CreditTransaction.Kind.SIGNUP_BONUS,
    ).exists():
        return
    from .services.credits import grant_credits
    try:
        grant_credits(
            user=user,
            amount=B2C_SIGNUP_BONUS_CREDITS,
            kind=CreditTransaction.Kind.SIGNUP_BONUS,
            note=f'Ro‘yxatdan o‘tish bonusi ({B2C_SIGNUP_BONUS_CREDITS} credit)',
        )
    except Exception:  # pragma: no cover
        log.exception('Signup bonus grant qilishda xatolik: user_id=%s', user.id)
