"""ETAP 14 — B2B/B2C URL isolation middleware.

`UserTypeRouteMiddleware` belgilangan prefiksli API yo'llarga foydalanuvchi
turi mos kelmasa 403 qaytaradi. Bu defense-in-depth qatlam — view'lardagi
permission class'lar (IsCenterAdmin, IsSuperAdmin va h.k.) ham himoya
qiladi, lekin middleware routing-darajasida darhol rad etadi.

Spec (ETAP_14_B2C_Foundation.md, 6-bosqich) Django templates'da prefix-based
redirectni so'raydi. Bu kod-bazada esa backend faqat API beradi va frontend
SPA — shu sababli redirect emas, 403 JSON qaytaramiz; redirect frontend
route guard'larida hal qilinadi.
"""

from __future__ import annotations

from django.conf import settings
from django.http import JsonResponse
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken


# B2C foydalanuvchi tegmasligi kerak bo'lgan API prefikslari (B2B-only).
B2B_API_PREFIXES: tuple[str, ...] = (
    '/api/v1/admin/',
    '/api/v1/super/',
    '/api/v1/superadmin/',
    '/api/v1/center/',
)

# B2B foydalanuvchi tegmasligi kerak bo'lgan B2C-only prefikslari.
# B2C auth endpoint'lari (login/signup/google) anon foydalanuvchi uchun ham
# ochiq, shu sababli ularni bloklamaymiz; faqat profil B2C-ga maxsus.
B2C_RESTRICTED_PREFIXES: tuple[str, ...] = (
    '/api/v1/b2c/profile',
    '/api/v1/b2c/auth/me',
    '/api/v1/b2c/dashboard',
)


def _starts_with_any(path: str, prefixes: tuple[str, ...]) -> bool:
    return any(path.startswith(p) for p in prefixes)


def _peek_role_from_jwt(request) -> str | None:
    """JWT cookie'dan user_id'ni olib, role'ni o'qiydi.

    DRF authentication'dan oldin ishlaydi, shu sababli `request.user` hali
    AnonymousUser. Token noto'g'ri bo'lsa None qaytariladi — view o'zi
    401'ga aylantiradi.
    """
    raw = request.COOKIES.get(settings.AUTH_COOKIE_ACCESS)
    if not raw:
        # Authorization headerda ham bo'lishi mumkin.
        header = request.META.get('HTTP_AUTHORIZATION', '')
        if header.startswith('Bearer '):
            raw = header.split(' ', 1)[1].strip()
    if not raw:
        return None
    try:
        token = AccessToken(raw)
    except TokenError:
        return None
    user_id = token.get('user_id')
    if not user_id:
        return None
    # Cache'siz har request'da bitta query — kelajakda LRU cache qo'shsa
    # bo'ladi, lekin hozircha minimal va to'g'ri yondashuv shu.
    from apps.accounts.models import User
    return User.objects.filter(pk=user_id).values_list('role', flat=True).first()


class UserTypeRouteMiddleware:
    """Defense-in-depth: B2C ↔ B2B URL kesishuvini bekitadi."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path
        # Tezkor exit: agar path B2B yoki B2C zonasiga umuman tegmasa.
        is_b2b_zone = _starts_with_any(path, B2B_API_PREFIXES)
        is_b2c_zone = _starts_with_any(path, B2C_RESTRICTED_PREFIXES)
        if not (is_b2b_zone or is_b2c_zone):
            return self.get_response(request)

        role = _peek_role_from_jwt(request)
        # Anon foydalanuvchi — view o'zi 401 qaytaradi, biz aralashmaymiz.
        if role is None:
            return self.get_response(request)

        if is_b2b_zone and role == 'b2c_user':
            return JsonResponse(
                {'detail': 'Bu sahifa individual foydalanuvchilar uchun '
                           'mavjud emas.'},
                status=403,
            )
        if is_b2c_zone and role != 'b2c_user':
            return JsonResponse(
                {'detail': 'Bu sahifa faqat individual foydalanuvchilar '
                           'uchun.'},
                status=403,
            )
        return self.get_response(request)
