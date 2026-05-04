"""Super admin billing endpoint'lari."""

from datetime import timedelta
from decimal import Decimal

from django.db.models import Count, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.mock.models import MockSession
from apps.organizations.models import Organization
from apps.organizations.permissions import IsCenterAdmin, IsSuperAdmin

from .models import (
    BillingCycle,
    MockSessionCharge,
    PaymentHistory,
    PricingTier,
    SessionBillingLog,
    SubscriptionTier,
)


def _money(value) -> float:
    if value is None:
        return 0.0
    return float(value)


def _ensure_pricing(org: Organization) -> PricingTier:
    pricing, _created = PricingTier.objects.get_or_create(organization=org)
    return pricing


class BillingOverviewView(APIView):
    """GET /api/v1/super/billing/overview/ — barcha markazlar bo'yicha ko'rinish."""

    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def get(self, request):
        cycles = BillingCycle.objects.all()
        total_revenue = cycles.filter(status='paid').aggregate(
            total=Sum('paid_amount'),
        )['total'] or Decimal('0')
        pending_amount = cycles.filter(status__in=('pending', 'overdue')).aggregate(
            total=Sum('total_amount'),
        )['total'] or Decimal('0')

        first_of_month = timezone.now().date().replace(day=1)
        monthly_revenue = cycles.filter(
            status='paid', paid_at__date__gte=first_of_month,
        ).aggregate(total=Sum('paid_amount'))['total'] or Decimal('0')

        unbilled_logs = SessionBillingLog.objects.filter(is_billed=False).aggregate(
            count=Count('id'),
        )['count']

        organizations = []
        for org in Organization.objects.all():
            pricing = _ensure_pricing(org)
            session_qs = MockSession.objects.filter(organization=org)
            finished = session_qs.filter(status='finished').count()
            log_pending = SessionBillingLog.objects.filter(
                session__organization=org, is_billed=False,
            ).aggregate(amount=Sum('price_per_session'))['amount'] or Decimal('0')
            cycles_pending = cycles.filter(
                organization=org, status__in=('pending', 'overdue'),
            ).aggregate(amount=Sum('total_amount'))['amount'] or Decimal('0')

            organizations.append({
                'id': org.id,
                'name': org.name,
                'slug': org.slug,
                'status': org.status,
                'plan_expires_at': org.plan_expires_at.isoformat() if org.plan_expires_at else None,
                'sessions_total': session_qs.count(),
                'sessions_finished': finished,
                'current_price_per_session': float(pricing.price_for_count(finished)),
                'pending_amount': _money(cycles_pending + log_pending),
                'logo': org.logo.url if org.logo else None,
            })

        return Response({
            'totals': {
                'organizations': Organization.objects.count(),
                'sessions_finished': MockSession.objects.filter(status='finished').count(),
                'total_revenue': _money(total_revenue),
                'pending_amount': _money(pending_amount),
                'monthly_revenue': _money(monthly_revenue),
                'unbilled_sessions': unbilled_logs,
            },
            'organizations': organizations,
        })


class BillingOrganizationDetailView(APIView):
    """GET /api/v1/super/billing/organizations/<id>/ — bitta markaz tafsiloti."""

    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def get(self, request, org_id):
        org = get_object_or_404(Organization, pk=org_id)
        pricing = _ensure_pricing(org)

        cycles = BillingCycle.objects.filter(organization=org).order_by('-period_start')
        finished_sessions = MockSession.objects.filter(
            organization=org, status='finished',
        ).order_by('-date')[:30]

        unbilled_logs = SessionBillingLog.objects.filter(
            session__organization=org, is_billed=False,
        ).select_related('session')

        return Response({
            'organization': {
                'id': org.id,
                'name': org.name,
                'slug': org.slug,
                'status': org.status,
                'logo': org.logo.url if org.logo else None,
                'contact_email': org.contact_email,
                'contact_phone': org.contact_phone,
            },
            'pricing': {
                'tier_1': float(pricing.price_per_session_tier_1),
                'tier_2': float(pricing.price_per_session_tier_2),
                'tier_3': float(pricing.price_per_session_tier_3),
                'period': pricing.payment_period,
                'is_active': pricing.is_active,
            },
            'cycles': [
                {
                    'id': c.id,
                    'period_start': c.period_start.isoformat() if c.period_start else None,
                    'period_end': c.period_end.isoformat() if c.period_end else None,
                    'period_label': c.period_label,
                    'year': c.year,
                    'month': c.month,
                    'total_sessions': c.total_sessions,
                    'total_students': c.total_students,
                    'total_amount': float(c.total_amount),
                    'paid_amount': float(c.paid_amount),
                    'status': c.status,
                    'payment_method': c.payment_method,
                    'payment_date': c.payment_date.isoformat() if c.payment_date else None,
                    'invoice_number': c.invoice_number,
                    'paid_at': c.paid_at.isoformat() if c.paid_at else None,
                    'notes': c.notes,
                }
                for c in cycles
            ],
            'unbilled_sessions': [
                {
                    'session_id': log.session_id,
                    'session_name': log.session.name,
                    'session_date': log.session.date.isoformat(),
                    'price_per_session': float(log.price_per_session),
                    'participant_count': log.participant_count,
                    'created_at': log.created_at.isoformat(),
                }
                for log in unbilled_logs
            ],
            'recent_sessions': [
                {
                    'id': s.id,
                    'name': s.name,
                    'date': s.date.isoformat(),
                    'status': s.status,
                    'participants': s.participants.count(),
                }
                for s in finished_sessions
            ],
        })


class CenterSubscriptionView(APIView):
    """ETAP 17 — Center adminining hozirgi obuna + joriy oydagi quota usage.

    GET /api/v1/billing/subscription/?org=<slug>
    """

    permission_classes = [IsAuthenticated, IsCenterAdmin]

    def get(self, request):
        slug = request.query_params.get('org')
        org = get_object_or_404(Organization, slug=slug)

        tier, _ = SubscriptionTier.objects.get_or_create(
            organization=org,
            defaults={'plan_type': 'pay_per_test'},
        )

        today = timezone.now().date()
        month_start = today.replace(day=1)

        total_count = MockSessionCharge.objects.filter(
            session__organization=org, is_charged=True,
        ).count()
        month_count = MockSessionCharge.objects.filter(
            session__organization=org,
            is_charged=True,
            charged_at__date__gte=month_start,
        ).count()

        next_amount = tier.amount_for_next_charge(
            total_charged_count=total_count,
            month_charged_count=month_count,
        )

        if tier.monthly_quota is None:
            quota_remaining = None
        else:
            quota_remaining = max(0, tier.monthly_quota - month_count)

        return Response({
            'plan_type': tier.plan_type,
            'plan_label': tier.get_plan_type_display(),
            'monthly_price': float(tier.monthly_price),
            'monthly_quota': tier.monthly_quota,
            'pay_per_test_threshold': tier.pay_per_test_threshold,
            'pay_per_test_first_price': float(tier.pay_per_test_first_price),
            'pay_per_test_after_price': float(tier.pay_per_test_after_price),
            'usage': {
                'total_charged_count': total_count,
                'month_charged_count': month_count,
                'quota_remaining': quota_remaining,
                'next_charge_amount': float(next_amount),
            },
            'is_active': tier.is_active,
            'starts_at': tier.starts_at.isoformat() if tier.starts_at else None,
            'ends_at': tier.ends_at.isoformat() if tier.ends_at else None,
        })


class GenerateBillingCycleView(APIView):
    """POST /api/v1/super/billing/cycles/generate/ — oxirgi oy bo'yicha cycle yaratadi."""

    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def post(self, request):
        org_id = request.data.get('organization_id')
        if not org_id:
            return Response(
                {'detail': 'organization_id required'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        org = get_object_or_404(Organization, pk=org_id)

        today = timezone.now().date()
        first_this_month = today.replace(day=1)
        last_prev = first_this_month - timedelta(days=1)
        period_start = last_prev.replace(day=1)
        period_end = last_prev

        cycle, created = BillingCycle.objects.get_or_create(
            organization=org,
            period_start=period_start,
            period_end=period_end,
        )

        unbilled_logs = SessionBillingLog.objects.filter(
            session__organization=org,
            is_billed=False,
            session__date__gte=period_start,
            session__date__lte=period_end,
        )

        total = sum(
            (log.price_per_session for log in unbilled_logs),
            start=Decimal('0'),
        )
        cycle.total_sessions = unbilled_logs.count()
        cycle.total_amount = total
        if cycle.status == 'pending' and total > 0:
            cycle.save()
        else:
            cycle.save()

        unbilled_logs.update(
            billing_cycle=cycle,
            is_billed=True,
            billed_at=timezone.now(),
        )
        cycle.ensure_invoice_number()

        return Response({
            'id': cycle.id,
            'period_start': cycle.period_start.isoformat(),
            'period_end': cycle.period_end.isoformat(),
            'total_sessions': cycle.total_sessions,
            'total_amount': float(cycle.total_amount),
            'invoice_number': cycle.invoice_number,
            'status': cycle.status,
            'created': created,
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class MarkBillingPaidView(APIView):
    """POST /api/v1/super/billing/cycles/<id>/mark-paid/.

    ETAP 16: PaymentHistory ham yaratiladi (audit log).
    """

    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def post(self, request, cycle_id):
        from datetime import date as _date

        cycle = get_object_or_404(BillingCycle, pk=cycle_id)

        amount = request.data.get('paid_amount') or cycle.total_amount
        try:
            amount_dec = Decimal(str(amount))
        except Exception:
            return Response(
                {'detail': 'Noto‘g‘ri summa'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Payment date — frontend yuborgan yoki bugun
        payment_date_raw = request.data.get('payment_date')
        if payment_date_raw:
            try:
                payment_date = _date.fromisoformat(payment_date_raw)
            except (TypeError, ValueError):
                payment_date = timezone.now().date()
        else:
            payment_date = timezone.now().date()

        cycle.mark_as_paid(
            payment_method=request.data.get('payment_method') or 'other',
            payment_date=payment_date,
            amount_paid=amount_dec,
            marked_paid_by=request.user,
            notes=request.data.get('notes', ''),
        )

        return Response({
            'id': cycle.id,
            'status': cycle.status,
            'paid_amount': float(cycle.paid_amount),
            'paid_at': cycle.paid_at.isoformat(),
            'payment_date': cycle.payment_date.isoformat() if cycle.payment_date else None,
            'invoice_number': cycle.invoice_number,
        })


class PaymentHistoryView(APIView):
    """ETAP 16 — GET /api/v1/super/billing/organizations/<id>/payments/."""

    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def get(self, request, org_id):
        org = get_object_or_404(Organization, pk=org_id)
        history = PaymentHistory.objects.filter(
            organization=org,
        ).select_related('billing_cycle', 'received_by').order_by(
            '-payment_date', '-created_at',
        )
        return Response([
            {
                'id': p.id,
                'amount_paid': float(p.amount_paid),
                'payment_method': p.payment_method,
                'payment_method_label': p.get_payment_method_display(),
                'payment_date': p.payment_date.isoformat(),
                'receipt_number': p.receipt_number,
                'received_by': (
                    p.received_by.get_full_name() or p.received_by.username
                    if p.received_by else None
                ),
                'invoice_number': p.billing_cycle.invoice_number if p.billing_cycle else '',
                'cycle_period': p.billing_cycle.period_label if p.billing_cycle else '',
                'notes': p.notes,
                'created_at': p.created_at.isoformat(),
            }
            for p in history
        ])


class PricingTierUpdateView(APIView):
    """PATCH /api/v1/super/billing/organizations/<id>/pricing/."""

    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def patch(self, request, org_id):
        org = get_object_or_404(Organization, pk=org_id)
        pricing = _ensure_pricing(org)

        for field in (
            'price_per_session_tier_1',
            'price_per_session_tier_2',
            'price_per_session_tier_3',
        ):
            if field in request.data:
                try:
                    setattr(pricing, field, Decimal(str(request.data[field])))
                except Exception:
                    return Response(
                        {'detail': f'Noto‘g‘ri qiymat: {field}'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

        if 'payment_period' in request.data:
            pricing.payment_period = request.data['payment_period']
        if 'is_active' in request.data:
            pricing.is_active = bool(request.data['is_active'])
        if 'notes' in request.data:
            pricing.notes = request.data['notes']

        pricing.save()
        return Response({
            'tier_1': float(pricing.price_per_session_tier_1),
            'tier_2': float(pricing.price_per_session_tier_2),
            'tier_3': float(pricing.price_per_session_tier_3),
            'period': pricing.payment_period,
            'is_active': pricing.is_active,
            'notes': pricing.notes,
        })
