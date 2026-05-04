from datetime import timedelta
from pathlib import Path

from decouple import Csv, config

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = config('DJANGO_SECRET_KEY', default='dev-secret-change-me')
DEBUG = config('DJANGO_DEBUG', default=True, cast=bool)
ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='localhost,127.0.0.1', cast=Csv())

# AI question generation (Claude API) — passage text -> IELTS questions
ANTHROPIC_API_KEY = config('ANTHROPIC_API_KEY', default='')

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
    'apps.organizations',
    'apps.accounts',
    'apps.tests',
    'apps.attempts',
    'apps.center',
    'apps.mock',
    'apps.billing',
    'apps.attendance',  # mahalliy: center/urls.py attendance.urls import qiladi
    'apps._startup',  # heal_schema management command + AutoMigrateMiddleware
]

MIDDLEWARE = [
    'apps._startup.middleware.AutoMigrateMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'apps.organizations.middleware.OrganizationContextMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': config('POSTGRES_DB', default='ildizmock'),
        'USER': config('POSTGRES_USER', default='ildizmock'),
        'PASSWORD': config('POSTGRES_PASSWORD', default='dev123'),
        'HOST': config('POSTGRES_HOST', default='localhost'),
        'PORT': config('POSTGRES_PORT', default='5432'),
    }
}

AUTH_USER_MODEL = 'accounts.User'

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
     'OPTIONS': {'min_length': 6}},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Tashkent'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = config('STATIC_ROOT', default=str(BASE_DIR / 'staticfiles'))
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# File upload limits (50 MB) — for listening MP3 files
FILE_UPLOAD_MAX_MEMORY_SIZE = 52_428_800  # 50 MB
DATA_UPLOAD_MAX_MEMORY_SIZE = 52_428_800

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'apps.accounts.authentication.CookieJWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    # ETAP 14 BUG #22 — throttling. Pagination DEFAULT qo'yilmaydi
    # (existing frontend kod oddiy arraylarni kutadi). Specific viewset'lar
    # opt-in: `pagination_class = PageNumberPagination`.
    'DEFAULT_THROTTLE_CLASSES': (
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
        'rest_framework.throttling.ScopedRateThrottle',
    ),
    'DEFAULT_THROTTLE_RATES': {
        'anon': '120/min',
        'user': '600/min',
        'login': '5/min',          # phone/password attempts
        'mock_join': '10/min',     # talaba sessiya'ga join
        'speaking_upload': '6/hour',
    },
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=30),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'AUTH_HEADER_TYPES': ('Bearer',),
}

AUTH_COOKIE_ACCESS = 'access_token'
AUTH_COOKIE_REFRESH = 'refresh_token'
AUTH_COOKIE_SECURE = config('AUTH_COOKIE_SECURE', default=False, cast=bool)
AUTH_COOKIE_SAMESITE = 'Lax'

CORS_ALLOWED_ORIGINS = config(
    'CORS_ALLOWED_ORIGINS',
    default='http://localhost:5173,http://127.0.0.1:5173',
    cast=Csv(),
)
CORS_ALLOW_CREDENTIALS = True

# ETAP 20 — Sertifikat verification URL'i (PDF'da QR/link uchun)
FRONTEND_URL = config('FRONTEND_URL', default='http://localhost:5173')

# Frontend custom headerlari (SuperAdmin context switch + guest attempt token).
# django-cors-headers default ro'yxatida yo'q — preflight rad qilmasin.
from corsheaders.defaults import default_headers  # noqa: E402

CORS_ALLOW_HEADERS = list(default_headers) + [
    'x-org-context',
    'x-guest-token',
]


# ============================================
# ETAP 14 BUG #17 — Production-only security
# ============================================
# Settingni alohida fayllarga bo'lishning o'rniga shu yerda DEBUG flag bilan
# ajratamiz — har deployment bitta DJANGO_DEBUG env'dan boshqariladi.
if not DEBUG:
    AUTH_COOKIE_SECURE = True
    AUTH_COOKIE_SAMESITE = 'Lax'
    SECURE_SSL_REDIRECT = config('SECURE_SSL_REDIRECT', default=True, cast=bool)
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_HSTS_SECONDS = 31_536_000  # 1 yil
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    X_FRAME_OPTIONS = 'DENY'
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')


# ============================================
# ETAP 14 BUG #15 — Logging
# ============================================
import os  # noqa: E402

LOGS_DIR = BASE_DIR / 'logs'
os.makedirs(LOGS_DIR, exist_ok=True)

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {name} {message}',
            'style': '{',
        },
        'simple': {
            'format': '{levelname} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'level': 'INFO',
            'class': 'logging.StreamHandler',
            'formatter': 'simple',
        },
        'file': {
            'level': 'INFO',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': str(LOGS_DIR / 'ildizmock.log'),
            'maxBytes': 10 * 1024 * 1024,  # 10 MB
            'backupCount': 5,
            'formatter': 'verbose',
        },
        'error_file': {
            'level': 'ERROR',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': str(LOGS_DIR / 'errors.log'),
            'maxBytes': 10 * 1024 * 1024,
            'backupCount': 5,
            'formatter': 'verbose',
        },
    },
    'loggers': {
        'django.request': {
            'handlers': ['error_file', 'console'],
            'level': 'ERROR',
            'propagate': False,
        },
        'apps': {
            'handlers': ['console', 'file'],
            'level': 'DEBUG' if DEBUG else 'INFO',
            'propagate': False,
        },
    },
    'root': {
        'handlers': ['console', 'file'],
        'level': 'INFO',
    },
}
