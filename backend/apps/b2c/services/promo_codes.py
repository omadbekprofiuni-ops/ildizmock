"""Promo kod redeem servisi.

Atomic select_for_update orqali raqobat (race condition) bloklanadi.
"""
from django.db import transaction
from django.utils import timezone

from ..models import (
    CreditPromoCode,
    CreditPromoCodeRedemption,
    CreditTransaction,
)
from .credits import grant_credits


class PromoCodeError(Exception):
    """Promo kod qabul qilinmadi (sabab bilan)."""


@transaction.atomic
def redeem_promo_code(user, raw_code: str) -> dict:
    code = (raw_code or '').strip().upper()
    if not code:
        raise PromoCodeError('Promo kod kiriting.')

    try:
        promo = CreditPromoCode.objects.select_for_update().get(code=code)
    except CreditPromoCode.DoesNotExist:
        raise PromoCodeError('Bunday promo kod topilmadi.')

    # Tekshirishlar
    if not promo.is_active:
        raise PromoCodeError('Bu promo kod o‘chirilgan.')
    now = timezone.now()
    if promo.valid_from and now < promo.valid_from:
        raise PromoCodeError('Promo kod hali faollashmagan.')
    if promo.valid_until and now > promo.valid_until:
        raise PromoCodeError('Promo kod muddati o‘tgan.')
    if promo.max_uses is not None and promo.uses_count >= promo.max_uses:
        raise PromoCodeError('Promo kod limiti tugagan.')

    if CreditPromoCodeRedemption.objects.filter(promo_code=promo, user=user).exists():
        raise PromoCodeError('Siz bu kodni allaqachon ishlatgansiz.')

    tx = grant_credits(
        user=user, amount=promo.credits_amount,
        kind=CreditTransaction.Kind.PROMO_CODE,
        note=f'Promo kod: {promo.code}' + (f' — {promo.description}' if promo.description else ''),
    )
    CreditPromoCodeRedemption.objects.create(
        promo_code=promo, user=user, credit_transaction=tx,
    )
    promo.uses_count += 1
    promo.save(update_fields=['uses_count'])

    return {
        'credits_granted': promo.credits_amount,
        'new_balance': tx.balance_after,
        'code': promo.code,
        'description': promo.description,
    }
