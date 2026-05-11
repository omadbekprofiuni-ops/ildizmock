from django.conf import settings
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import LoginSerializer, UserSerializer


def _set_cookies(response, access, refresh=None):
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


def _clear_cookies(response):
    response.delete_cookie(settings.AUTH_COOKIE_ACCESS)
    response.delete_cookie(settings.AUTH_COOKIE_REFRESH)
    return response


class ChangePasswordView(APIView):
    """POST /auth/change-password — body {old_password, new_password}."""

    def post(self, request):
        from rest_framework.permissions import IsAuthenticated
        if not request.user.is_authenticated:
            return Response({'detail': 'Sign in required'}, status=401)
        old = request.data.get('old_password') or ''
        new = request.data.get('new_password') or ''
        if not request.user.check_password(old):
            return Response({'detail': 'Wrong current password'}, status=400)
        if len(new) < 6:
            return Response({'detail': 'Password too short (min 6)'}, status=400)
        request.user.set_password(new)
        request.user.must_change_password = False
        request.user.save(update_fields=['password', 'must_change_password'])
        return Response({'detail': 'Password changed'})


class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = 'login'

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        refresh = RefreshToken.for_user(user)
        response = Response(UserSerializer(user).data)
        return _set_cookies(response, str(refresh.access_token), str(refresh))


class LogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        response = Response(status=status.HTTP_204_NO_CONTENT)
        return _clear_cookies(response)


class RefreshView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        raw = request.COOKIES.get(settings.AUTH_COOKIE_REFRESH)
        if not raw:
            return Response({'detail': 'Refresh token yo‘q'}, status=status.HTTP_401_UNAUTHORIZED)
        try:
            refresh = RefreshToken(raw)
        except TokenError:
            return Response({'detail': 'Refresh token yaroqsiz'}, status=status.HTTP_401_UNAUTHORIZED)
        response = Response({'detail': 'refreshed'})
        return _set_cookies(response, str(refresh.access_token))


class MeView(APIView):
    def get(self, request):
        # ETAP 14 — B2C user uchun B2C profile bilan boyitilgan serializer.
        if getattr(request.user, 'role', None) == 'b2c_user':
            from apps.b2c.serializers import B2CUserSerializer
            return Response(B2CUserSerializer(request.user).data)
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        if getattr(request.user, 'role', None) == 'b2c_user':
            return Response(
                {'detail': 'B2C foydalanuvchi /b2c/profile orqali yangilashi kerak.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
