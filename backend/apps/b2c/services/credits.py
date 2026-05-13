"""B2C credit operatsiyalari uchun servis.

Barcha grant/deduct operatsiyalari shu modul orqali bajariladi.
Atomic transaction + select_for_update yordamida balans buzilmaydi.
"""
from django.contrib.auth import get_user_model
from django.db import transaction

from ..models import CreditBalance, CreditTransaction

User = get_user_model()


class InsufficientCreditsError(Exception):
    """Foydalanuvchida yetarli kredit yo'q."""


def get_or_create_balance(user) -> CreditBalance:
    """Foydalanuvchining balance rowini olish (kerak bo'lsa yaratish)."""
    balance, _ = CreditBalance.objects.get_or_create(user=user, defaults={'balance': 0})
    return balance


@transaction.atomic
def grant_credits(
    *,
    user,
    amount: int,
    kind: str,
    note: str = '',
    created_by=None,
) -> CreditTransaction:
    """Foydalanuvchiga musbat miqdorda kredit qo'shadi.

    Atomic — balance va transaction birga yoziladi.
    """
    if amount <= 0:
        raise ValueError('grant_credits: amount musbat bo‘lishi kerak.')

    # Lock the balance row
    balance, _ = CreditBalance.objects.select_for_update().get_or_create(
        user=user, defaults={'balance': 0},
    )
    balance.balance += amount
    balance.save(update_fields=['balance', 'updated_at'])

    tx = CreditTransaction.objects.create(
        user=user,
        kind=kind,
        amount=amount,
        balance_after=balance.balance,
        note=note or '',
        created_by=created_by,
    )
    return tx


@transaction.atomic
def deduct_credits(
    *,
    user,
    amount: int,
    note: str = '',
    created_by=None,
    kind: str = CreditTransaction.Kind.ADMIN_DEDUCT,
) -> CreditTransaction:
    """Foydalanuvchidan musbat miqdorda kredit ayiradi.

    Agar balans yetmasa — `InsufficientCreditsError`.
    """
    if amount <= 0:
        raise ValueError('deduct_credits: amount musbat bo‘lishi kerak.')

    balance, _ = CreditBalance.objects.select_for_update().get_or_create(
        user=user, defaults={'balance': 0},
    )
    if balance.balance < amount:
        raise InsufficientCreditsError(
            f'Yetarli kredit yo‘q: kerak {amount}, mavjud {balance.balance}',
        )

    balance.balance -= amount
    balance.save(update_fields=['balance', 'updated_at'])

    tx = CreditTransaction.objects.create(
        user=user,
        kind=kind,
        amount=-amount,
        balance_after=balance.balance,
        note=note or '',
        created_by=created_by,
    )
    return tx
