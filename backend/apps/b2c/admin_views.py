"""Super-admin uchun B2C foydalanuvchilar boshqaruvi.

ETAP 19 — list/detail/credit-grant/credit-deduct.
"""
from django.contrib.auth import get_user_model
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.organizations.permissions import IsSuperAdmin

from .models import (
    B2CProfile,
    CreditPromoCode,
    CreditPromoCodeRedemption,
    CreditTransaction,
    generate_promo_code,
)
from .services import credits as credit_service

User = get_user_model()


def _serialize_user_row(u: 'User') -> dict:
    profile = getattr(u, 'b2c_profile', None)
    balance = getattr(u, 'credit_balance', None)
    return {
        'id': u.id,
        'username': u.username,
        'email': u.email or '',
        'first_name': u.first_name or '',
        'last_name': u.last_name or '',
        'full_name': f'{u.first_name or ""} {u.last_name or ""}'.strip() or u.username,
        'phone': profile.phone_number if profile else (u.phone or ''),
        'preferred_language': profile.preferred_language if profile else 'uz',
        'signup_source': profile.signup_source if profile else '',
        'target_exam': profile.target_exam if profile else '',
        'target_band': float(profile.target_band) if profile and profile.target_band else None,
        'exam_date': profile.exam_date if profile else None,
        'balance': balance.balance if balance else 0,
        'is_active': u.is_active,
        'date_joined': u.date_joined,
        'last_login': u.last_login,
    }


class B2CUsersListView(APIView):
    """GET /api/v1/super/b2c-users/

    Query params:
      - q: email/ism/familiya/telefon bo'yicha qidiruv
      - signup_source: all | email | google | admin
      - min_balance, max_balance: int
      - limit: default 200
    """
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        qs = (
            User.objects.filter(role='b2c_user')
            .select_related('b2c_profile', 'credit_balance')
            .order_by('-date_joined')
        )

        q = (request.query_params.get('q') or '').strip()
        if q:
            qs = qs.filter(
                Q(email__icontains=q)
                | Q(username__icontains=q)
                | Q(first_name__icontains=q)
                | Q(last_name__icontains=q)
                | Q(phone__icontains=q)
                | Q(b2c_profile__phone_number__icontains=q),
            )

        signup_source = request.query_params.get('signup_source', 'all')
        if signup_source != 'all':
            qs = qs.filter(b2c_profile__signup_source=signup_source)

        try:
            min_balance = int(request.query_params.get('min_balance')) \
                if request.query_params.get('min_balance') is not None else None
        except (TypeError, ValueError):
            min_balance = None
        try:
            max_balance = int(request.query_params.get('max_balance')) \
                if request.query_params.get('max_balance') is not None else None
        except (TypeError, ValueError):
            max_balance = None

        try:
            limit = max(1, min(500, int(request.query_params.get('limit', 200))))
        except (TypeError, ValueError):
            limit = 200

        rows = []
        for u in qs[:limit]:
            row = _serialize_user_row(u)
            if min_balance is not None and row['balance'] < min_balance:
                continue
            if max_balance is not None and row['balance'] > max_balance:
                continue
            rows.append(row)

        # Summary
        total = User.objects.filter(role='b2c_user').count()
        new_30d_count = User.objects.filter(role='b2c_user').count()  # placeholder
        from datetime import timedelta
        from django.utils import timezone
        new_30d_count = User.objects.filter(
            role='b2c_user',
            date_joined__gte=timezone.now() - timedelta(days=30),
        ).count()

        return Response({
            'summary': {
                'total': total,
                'new_30d': new_30d_count,
                'shown': len(rows),
            },
            'users': rows,
        })


class B2CUserDetailView(APIView):
    """GET /api/v1/super/b2c-users/<id>/

    Profile + balance + last 100 transactions.
    """
    permission_classes = [IsSuperAdmin]

    def get(self, request, user_id: int):
        user = get_object_or_404(
            User.objects.select_related('b2c_profile', 'credit_balance'),
            pk=user_id, role='b2c_user',
        )
        balance = credit_service.get_or_create_balance(user)

        txs = (
            CreditTransaction.objects.filter(user=user)
            .select_related('created_by')
            .order_by('-created_at')[:100]
        )

        return Response({
            'user': _serialize_user_row(user),
            'balance': balance.balance,
            'transactions': [
                {
                    'id': t.id,
                    'kind': t.kind,
                    'kind_display': t.get_kind_display(),
                    'amount': t.amount,
                    'balance_after': t.balance_after,
                    'note': t.note,
                    'created_by': (
                        t.created_by.username if t.created_by_id else None
                    ),
                    'created_at': t.created_at,
                }
                for t in txs
            ],
        })


class B2CCreditGrantView(APIView):
    """POST /api/v1/super/b2c-users/<id>/credit-grant/

    body: {amount: int >0, note: str (majburiy), action: 'grant'|'deduct'}
    """
    permission_classes = [IsSuperAdmin]

    def post(self, request, user_id: int):
        user = get_object_or_404(User, pk=user_id, role='b2c_user')
        try:
            amount = int(request.data.get('amount', 0))
        except (TypeError, ValueError):
            return Response({'amount': 'Miqdor son bo‘lishi kerak.'}, status=400)
        if amount <= 0:
            return Response({'amount': 'Miqdor musbat bo‘lishi kerak.'}, status=400)

        note = (request.data.get('note') or '').strip()
        if not note:
            return Response({'note': 'Izoh majburiy.'}, status=400)

        action = request.data.get('action') or 'grant'
        try:
            if action == 'grant':
                tx = credit_service.grant_credits(
                    user=user, amount=amount,
                    kind=CreditTransaction.Kind.ADMIN_GRANT,
                    note=note, created_by=request.user,
                )
            elif action == 'deduct':
                tx = credit_service.deduct_credits(
                    user=user, amount=amount,
                    note=note, created_by=request.user,
                )
            else:
                return Response({'action': 'grant yoki deduct bo‘lishi kerak.'}, status=400)
        except credit_service.InsufficientCreditsError as e:
            return Response({'detail': str(e)}, status=400)

        return Response({
            'transaction_id': tx.id,
            'new_balance': tx.balance_after,
            'kind_display': tx.get_kind_display(),
        })


# ============================================================
# ETAP 19 — Promo kodlar admin
# ============================================================

def _serialize_promo(p: CreditPromoCode) -> dict:
    return {
        'id': p.id,
        'code': p.code,
        'description': p.description,
        'credits_amount': p.credits_amount,
        'max_uses': p.max_uses,
        'uses_count': p.uses_count,
        'valid_from': p.valid_from,
        'valid_until': p.valid_until,
        'is_active': p.is_active,
        'is_redeemable': p.is_redeemable,
        'created_at': p.created_at,
        'created_by': p.created_by.username if p.created_by_id else None,
    }


class PromoCodesListCreateView(APIView):
    """GET — ro'yxat; POST — yangi kod yaratish."""
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        qs = CreditPromoCode.objects.all().select_related('created_by').order_by('-created_at')[:300]
        # Summary
        total = CreditPromoCode.objects.count()
        active = CreditPromoCode.objects.filter(is_active=True).count()
        from django.db.models import Sum
        total_granted = (
            CreditPromoCodeRedemption.objects.aggregate(
                v=Sum('promo_code__credits_amount'),
            )['v'] or 0
        )
        return Response({
            'summary': {
                'total': total, 'active': active,
                'total_granted_credits': total_granted,
                'total_redemptions': CreditPromoCodeRedemption.objects.count(),
            },
            'codes': [_serialize_promo(p) for p in qs],
        })

    def post(self, request):
        from datetime import datetime
        from django.utils import timezone as dj_tz

        code = (request.data.get('code') or '').strip().upper() or generate_promo_code()
        try:
            credits_amount = int(request.data.get('credits_amount', 0))
        except (TypeError, ValueError):
            return Response({'credits_amount': 'Son bo‘lishi kerak.'}, status=400)
        if credits_amount <= 0:
            return Response({'credits_amount': 'Musbat son bo‘lishi kerak.'}, status=400)
        if CreditPromoCode.objects.filter(code=code).exists():
            return Response({'code': f'"{code}" kod allaqachon mavjud.'}, status=400)

        max_uses = request.data.get('max_uses')
        try:
            max_uses = int(max_uses) if max_uses not in (None, '') else None
        except (TypeError, ValueError):
            return Response({'max_uses': 'Son bo‘lishi kerak.'}, status=400)

        def _parse_dt(value):
            """ISO date yoki datetime string'ni aware datetime'ga aylantirish."""
            if not value:
                return None
            if isinstance(value, datetime):
                dt = value
            else:
                value = str(value).strip()
                if not value:
                    return None
                try:
                    dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
                except ValueError:
                    # Faqat date format (YYYY-MM-DD) bo'lsa, kun oxiri (23:59) ga aylantiramiz
                    try:
                        dt = datetime.strptime(value, '%Y-%m-%d').replace(
                            hour=23, minute=59, second=59,
                        )
                    except ValueError:
                        return None
            if dj_tz.is_naive(dt):
                dt = dj_tz.make_aware(dt, dj_tz.get_current_timezone())
            return dt

        promo = CreditPromoCode.objects.create(
            code=code,
            description=(request.data.get('description') or '').strip(),
            credits_amount=credits_amount,
            max_uses=max_uses,
            valid_from=_parse_dt(request.data.get('valid_from')),
            valid_until=_parse_dt(request.data.get('valid_until')),
            is_active=bool(request.data.get('is_active', True)),
            created_by=request.user,
        )
        return Response(_serialize_promo(promo), status=201)


class PromoCodeDetailView(APIView):
    """PATCH — tahrirlash; POST /deactivate; DELETE; GET /redemptions/."""
    permission_classes = [IsSuperAdmin]

    def patch(self, request, pk):
        from datetime import datetime
        from django.utils import timezone as dj_tz

        def _parse_dt(value):
            if not value:
                return None
            if isinstance(value, datetime):
                dt = value
            else:
                value = str(value).strip()
                if not value:
                    return None
                try:
                    dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
                except ValueError:
                    try:
                        dt = datetime.strptime(value, '%Y-%m-%d').replace(
                            hour=23, minute=59, second=59,
                        )
                    except ValueError:
                        return None
            if dj_tz.is_naive(dt):
                dt = dj_tz.make_aware(dt, dj_tz.get_current_timezone())
            return dt

        promo = get_object_or_404(CreditPromoCode, pk=pk)
        for field in ('description', 'max_uses', 'valid_from', 'valid_until', 'is_active'):
            if field in request.data:
                value = request.data[field]
                if field in ('valid_from', 'valid_until'):
                    value = _parse_dt(value)
                elif field == 'max_uses' and value in ('', None):
                    value = None
                setattr(promo, field, value)
        promo.save()
        return Response(_serialize_promo(promo))

    def delete(self, request, pk):
        promo = get_object_or_404(CreditPromoCode, pk=pk)
        if promo.uses_count > 0:
            # Ishlatilgan kodni o'chirib bo'lmaydi — faqat deaktiv qilish mumkin
            promo.is_active = False
            promo.save(update_fields=['is_active'])
            return Response({'detail': 'Ishlatilgan kod faqat o‘chiriladi (deaktiv).'}, status=200)
        promo.delete()
        return Response(status=204)


# ============================================================
# ETAP 19 — Super-admin Kreditlar sahifa
# ============================================================

class AdminCreditsOverviewView(APIView):
    """GET /api/v1/super/credits/

    Umumiy: aylanmadagi credit, bugungi grant/spend, oxirgi tranzaksiyalar.
    """
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        from datetime import timedelta
        from django.db.models import Sum
        from django.utils import timezone
        from .models import CreditBalance

        now = timezone.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_ago = now - timedelta(days=7)

        total_in_circulation = CreditBalance.objects.aggregate(
            v=Sum('balance'),
        )['v'] or 0

        today_grant = CreditTransaction.objects.filter(
            kind__in=[
                CreditTransaction.Kind.ADMIN_GRANT,
                CreditTransaction.Kind.SIGNUP_BONUS,
                CreditTransaction.Kind.PROMO_CODE,
                CreditTransaction.Kind.REFUND,
            ],
            created_at__gte=today_start,
        ).aggregate(v=Sum('amount'))['v'] or 0

        today_spend = CreditTransaction.objects.filter(
            kind=CreditTransaction.Kind.SPEND, created_at__gte=today_start,
        ).aggregate(v=Sum('amount'))['v'] or 0
        today_spend = abs(today_spend)

        week_grant = CreditTransaction.objects.filter(
            kind__in=[
                CreditTransaction.Kind.ADMIN_GRANT,
                CreditTransaction.Kind.SIGNUP_BONUS,
                CreditTransaction.Kind.PROMO_CODE,
                CreditTransaction.Kind.REFUND,
            ],
            created_at__gte=week_ago,
        ).aggregate(v=Sum('amount'))['v'] or 0

        # Filter
        kind_filter = request.query_params.get('kind', 'all')
        q_user = (request.query_params.get('user') or '').strip()

        txs = CreditTransaction.objects.select_related('user', 'created_by').order_by('-created_at')
        if kind_filter != 'all':
            txs = txs.filter(kind=kind_filter)
        if q_user:
            txs = txs.filter(user__username__icontains=q_user)
        txs = txs[:200]

        return Response({
            'summary': {
                'total_in_circulation': total_in_circulation,
                'today_grant': today_grant,
                'today_spend': today_spend,
                'week_grant': week_grant,
            },
            'transactions': [
                {
                    'id': t.id,
                    'user': t.user.username,
                    'user_id': t.user_id,
                    'kind': t.kind,
                    'kind_display': t.get_kind_display(),
                    'amount': t.amount,
                    'balance_after': t.balance_after,
                    'note': t.note,
                    'created_by': t.created_by.username if t.created_by_id else None,
                    'created_at': t.created_at,
                }
                for t in txs
            ],
        })


class AdminCreditsBulkGrantView(APIView):
    """POST /api/v1/super/credits/bulk-grant/

    Body: {filter_type: 'all'|'zero_balance'|'last_n_days', amount, note, days?, preview?: bool}
    """
    permission_classes = [IsSuperAdmin]

    def post(self, request):
        from datetime import timedelta
        from django.contrib.auth import get_user_model
        from django.db import transaction as db_tx
        from django.utils import timezone

        User = get_user_model()
        filter_type = request.data.get('filter_type', 'all')
        try:
            amount = int(request.data.get('amount', 0))
        except (TypeError, ValueError):
            return Response({'amount': 'Son bo‘lishi kerak.'}, status=400)
        if amount <= 0:
            return Response({'amount': 'Musbat son bo‘lishi kerak.'}, status=400)
        note = (request.data.get('note') or '').strip()
        if not note:
            return Response({'note': 'Izoh majburiy.'}, status=400)

        qs = User.objects.filter(role='b2c_user', is_active=True)
        if filter_type == 'zero_balance':
            qs = qs.filter(credit_balance__balance=0)
        elif filter_type == 'last_n_days':
            try:
                days = int(request.data.get('days', 30))
            except (TypeError, ValueError):
                days = 30
            qs = qs.filter(date_joined__gte=timezone.now() - timedelta(days=days))
        elif filter_type != 'all':
            return Response({'filter_type': 'Noma‘lum filter turi.'}, status=400)

        users = list(qs[:5000])
        if request.data.get('preview'):
            return Response({
                'preview': True,
                'users_count': len(users),
                'total_credits_to_grant': len(users) * amount,
            })

        granted = 0
        with db_tx.atomic():
            for u in users:
                try:
                    credit_service.grant_credits(
                        user=u, amount=amount,
                        kind=CreditTransaction.Kind.ADMIN_GRANT,
                        created_by=request.user,
                        note=f'[BULK] {note}',
                    )
                    granted += 1
                except Exception:
                    continue
        return Response({
            'status': 'completed',
            'granted_to': granted,
            'total_credits': granted * amount,
        })

