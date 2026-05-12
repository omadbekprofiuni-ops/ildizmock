from django.conf import settings
from django.core.paginator import Paginator
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .catalog_serializers import (
    B2CCatalogTestDetailSerializer,
    B2CCatalogTestListSerializer,
)
from .serializers import (
    B2CGoogleAuthSerializer,
    B2CLoginSerializer,
    B2CProfileUpdateSerializer,
    B2CSignupSerializer,
    B2CUserSerializer,
)
from .services import catalog as catalog_service


def _set_auth_cookies(response, access: str, refresh: str | None = None):
    response.set_cookie(
        settings.AUTH_COOKIE_ACCESS, access,
        httponly=True,
        secure=settings.AUTH_COOKIE_SECURE,
        samesite=settings.AUTH_COOKIE_SAMESITE,
        max_age=int(settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds()),
    )
    if refresh is not None:
        response.set_cookie(
            settings.AUTH_COOKIE_REFRESH, refresh,
            httponly=True,
            secure=settings.AUTH_COOKIE_SECURE,
            samesite=settings.AUTH_COOKIE_SAMESITE,
            max_age=int(settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds()),
        )
    return response


def _clear_auth_cookies(response):
    response.delete_cookie(settings.AUTH_COOKIE_ACCESS)
    response.delete_cookie(settings.AUTH_COOKIE_REFRESH)
    return response


def _issue_tokens_response(user):
    refresh = RefreshToken.for_user(user)
    payload = B2CUserSerializer(user).data
    response = Response(payload, status=status.HTTP_200_OK)
    return _set_auth_cookies(response, str(refresh.access_token), str(refresh))


class B2CSignupView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = 'login'

    def post(self, request):
        serializer = B2CSignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return _issue_tokens_response(user)


class B2CLoginView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = 'login'

    def post(self, request):
        serializer = B2CLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        return _issue_tokens_response(user)


class B2CGoogleAuthView(APIView):
    """ETAP 15 — Sign in / sign up with Google ID token.

    Frontend Google Identity Services tugmasini bossadi va `credential`
    (ID token) qaytariladi. Shu token bilan POST /api/v1/b2c/auth/google
    chaqiriladi; foydalanuvchi yaratiladi (yangi) yoki topiladi (mavjud),
    keyin cookie JWT qaytadi.
    """
    permission_classes = [AllowAny]
    throttle_scope = 'login'

    def post(self, request):
        serializer = B2CGoogleAuthSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return _issue_tokens_response(user)


class B2CLogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        response = Response(status=status.HTTP_204_NO_CONTENT)
        return _clear_auth_cookies(response)


class B2CMeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != 'b2c_user':
            return Response(
                {'detail': 'Faqat individual foydalanuvchilar uchun.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return Response(B2CUserSerializer(request.user).data)


class B2CProfileView(APIView):
    """PATCH /api/v1/b2c/profile — telefon, til, target_exam, ism/familiya."""
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        if request.user.role != 'b2c_user':
            return Response(
                {'detail': 'Faqat individual foydalanuvchilar uchun.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = B2CProfileUpdateSerializer(
            instance=request.user, data=request.data, partial=True,
        )
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(B2CUserSerializer(user).data)


class B2CDashboardView(APIView):
    """GET /api/v1/b2c/dashboard — KPI + streak + heatmap + getting started."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != 'b2c_user':
            return Response(
                {'detail': 'Faqat individual foydalanuvchilar uchun.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        from .services import activity as activity_service
        user = request.user
        return Response({
            'user': B2CUserSerializer(user).data,
            'kpi': activity_service.get_kpi_stats(user),
            'streak': activity_service.get_streak_stats(user),
            'weekly': activity_service.get_weekly_progress(user),
            'heatmap': activity_service.get_heatmap_data(user, weeks=12),
            'getting_started': activity_service.get_getting_started(user),
            'sections': activity_service.get_section_overview(),
        })


def _ensure_b2c(request):
    """B2C foydalanuvchi tekshiruvi (boshqa rol → 403)."""
    if request.user.role != 'b2c_user':
        return Response(
            {'detail': 'Faqat individual foydalanuvchilar uchun.'},
            status=status.HTTP_403_FORBIDDEN,
        )
    return None


class B2CCatalogListView(APIView):
    """GET /api/v1/b2c/catalog?section=&difficulty=&source=&q=&page=&page_size=

    Faqat `available_for_b2c=True` testlar. Paginated (default 24).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        forbidden = _ensure_b2c(request)
        if forbidden:
            return forbidden

        section = request.GET.get('section', 'all')
        difficulty = request.GET.get('difficulty', 'all')
        source = request.GET.get('source', 'all')
        query = (request.GET.get('q') or '').strip()
        try:
            page_number = max(1, int(request.GET.get('page', 1)))
        except ValueError:
            page_number = 1
        try:
            # ETAP 16.6 — default 12 → 24 (dense 4-column grid uchun)
            page_size = max(1, min(48, int(request.GET.get('page_size', 24))))
        except ValueError:
            page_size = 24

        qs = catalog_service.filter_catalog(
            section=section, difficulty=difficulty,
            source=source, query=query,
        )
        paginator = Paginator(qs, page_size)
        page = paginator.get_page(page_number)
        results = B2CCatalogTestListSerializer(page.object_list, many=True).data

        counts = catalog_service.get_section_counts()
        return Response({
            'results': results,
            'pagination': {
                'page': page.number,
                'num_pages': paginator.num_pages,
                'total': paginator.count,
                'page_size': page_size,
                'has_next': page.has_next(),
                'has_previous': page.has_previous(),
            },
            'filters': {
                'section': section,
                'difficulty': difficulty,
                'source': source,
                'q': query,
            },
            'meta': {
                'section_choices': catalog_service.SECTION_CHOICES,
                'difficulty_choices': catalog_service.DIFFICULTY_CHOICES,
                'section_counts': counts,
                'sources': catalog_service.get_available_sources(),
            },
        })


class B2CCatalogDetailView(APIView):
    """GET /api/v1/b2c/catalog/<uuid:pk> — bitta testning preview ma'lumotlari."""
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        forbidden = _ensure_b2c(request)
        if forbidden:
            return forbidden
        test = get_object_or_404(catalog_service.get_published_tests(), pk=pk)
        return Response(B2CCatalogTestDetailSerializer(test).data)


class B2CStartTestView(APIView):
    """POST /api/v1/b2c/catalog/<uuid:pk>/start

    B2C testni boshlash. Atomic:
    1. Test catalog'da available_for_b2c bo'lishi shart
    2. Kreditni ushlab turish (deduct)
    3. Attempt yaratish (status=in_progress)
    4. Attempt id'sini qaytarish — frontend /take/<id>'ga o'tkazadi

    Kredit yetarli emas bo'lsa — 402 Payment Required.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        forbidden = _ensure_b2c(request)
        if forbidden:
            return forbidden
        from django.db import transaction as db_tx
        from apps.attempts.models import Attempt
        from .models import CreditTransaction
        from .services.credits import InsufficientCreditsError, deduct_credits

        test = get_object_or_404(catalog_service.get_published_tests(), pk=pk)

        # ETAP 19 default cost — har test 1 credit (b2c_credits_cost field
        # ETAP 17 ga qo'shilganda undan o'qiladi)
        cost = getattr(test, 'b2c_credits_cost', None) or 1

        try:
            with db_tx.atomic():
                tx = deduct_credits(
                    user=request.user, amount=cost,
                    kind=CreditTransaction.Kind.SPEND,
                    note=f'Test boshlash: {test.name}',
                )
                attempt = Attempt.objects.create(
                    user=request.user, test=test,
                    status='in_progress',
                )
        except InsufficientCreditsError as e:
            return Response({'detail': str(e), 'code': 'insufficient_credits'}, status=402)

        return Response({
            'attempt_id': str(attempt.id),
            'credits_spent': cost,
            'new_balance': tx.balance_after,
        }, status=status.HTTP_201_CREATED)


class B2CCancelAttemptView(APIView):
    """POST /api/v1/b2c/attempts/<uuid>/cancel

    Foydalanuvchi Test rules gate'da Cancel bossa, attempt boshlanmagan
    (started_at IS NULL) holatda kreditni qaytarib beradi.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        forbidden = _ensure_b2c(request)
        if forbidden:
            return forbidden
        from django.db import transaction as db_tx
        from apps.attempts.models import Attempt
        from .models import CreditTransaction
        from .services.credits import grant_credits

        try:
            attempt = Attempt.objects.get(pk=pk, user=request.user)
        except Attempt.DoesNotExist:
            return Response({'detail': 'Attempt topilmadi.'}, status=404)

        # Faqat boshlanmagan attempt'larni bekor qilish mumkin
        if attempt.started_at is not None:
            return Response(
                {'detail': 'Test allaqachon boshlangan, bekor qilib bo‘lmaydi.'},
                status=400,
            )
        if attempt.status not in ('in_progress',):
            return Response({'detail': 'Bu attempt allaqachon yopilgan.'}, status=400)

        # SPEND tranzaksiyasini topib, REFUND beramiz
        spend_tx = (
            CreditTransaction.objects
            .filter(
                user=request.user, kind=CreditTransaction.Kind.SPEND,
                note__icontains=f'Test boshlash: {attempt.test.name}',
            )
            .order_by('-created_at').first()
        )
        refunded = 0
        if spend_tx and spend_tx.amount < 0:
            refunded = abs(spend_tx.amount)

        with db_tx.atomic():
            attempt.status = 'expired'
            attempt.save(update_fields=['status'])
            if refunded > 0:
                grant_credits(
                    user=request.user, amount=refunded,
                    kind=CreditTransaction.Kind.REFUND,
                    note=f'Test bekor qilindi: {attempt.test.name}',
                )

        return Response({
            'refunded': refunded,
            'attempt_id': str(attempt.id),
        })


class B2CRedeemPromoCodeView(APIView):
    """POST /api/v1/b2c/credits/redeem-promo

    Body: {code: "ABC123"}
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        forbidden = _ensure_b2c(request)
        if forbidden:
            return forbidden
        from .services.promo_codes import PromoCodeError, redeem_promo_code

        try:
            result = redeem_promo_code(request.user, request.data.get('code') or '')
        except PromoCodeError as e:
            return Response({'detail': str(e)}, status=400)
        return Response(result)


class B2CCreditsView(APIView):
    """GET /api/v1/b2c/credits — joriy balans + oxirgi 100 ta tranzaksiya.

    ETAP 19 — B2C user o'z kredit tarixini ko'rishi uchun.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        forbidden = _ensure_b2c(request)
        if forbidden:
            return forbidden
        from .models import CreditTransaction
        from .services.credits import get_or_create_balance

        balance = get_or_create_balance(request.user)
        txs = (
            CreditTransaction.objects
            .filter(user=request.user)
            .order_by('-created_at')[:100]
        )
        return Response({
            'balance': balance.balance,
            'transactions': [
                {
                    'id': t.id,
                    'kind': t.kind,
                    'kind_display': t.get_kind_display(),
                    'amount': t.amount,
                    'balance_after': t.balance_after,
                    'note': t.note,
                    'created_at': t.created_at,
                }
                for t in txs
            ],
        })
