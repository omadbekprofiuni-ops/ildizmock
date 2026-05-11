from django.conf import settings
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import (
    B2CGoogleAuthSerializer,
    B2CLoginSerializer,
    B2CProfileUpdateSerializer,
    B2CSignupSerializer,
    B2CUserSerializer,
)


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
