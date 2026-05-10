"""HOTFIX — Mock Session test dropdown bug.

Yangi endpoint: GET /api/v1/tests/admin/available-for-mock/?type=<module>

Markaz administratori mock session yaratayotganda dropdown'lar bo'sh
ko'rinardi — sabab eski endpoint'lar faqat yo bitta scope'ni (org-only
yoki library-only) qaytarardi.

Bu yangi endpoint IKKALA scope'ni birlashtirib qaytaradi:
  - Markaz o'zi yaratgan published testlar (organization == request.org)
  - PLUS global library testlar (is_global=True yoki organization=null)

Query parametr:
  type=listening | reading | writing | speaking   (majburiy)
  include_drafts=1                                (ixtiyoriy)
"""
from django.db.models import Q
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Test
from .serializers import TestListSerializer


VALID_MODULES = {'listening', 'reading', 'writing', 'speaking'}


class AvailableTestsForMockView(APIView):
    """Mock-session yaratish forma'si uchun mavjud testlar.

    Markaz adminga ko'rinadigan testlar:
      - O'zining org'ida yaratilgan published test'lar
      - PLUS global library test'lar (is_global=True)

    Filterlar:
      - status='published' YOKI is_published=True (legacy testlar bilan
        moslik uchun)
      - is_deleted=False
      - module=<type>

    Superadmin uchun: shu type'dagi BARCHA published testlar.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        test_type = request.query_params.get('type', '').strip().lower()
        if test_type not in VALID_MODULES:
            return Response(
                {'error': f'type query param required, one of {sorted(VALID_MODULES)}'},
                status=400,
            )

        include_drafts = request.query_params.get('include_drafts') in (
            '1', 'true', 'yes',
        )

        user = request.user
        org = getattr(user, 'organization', None)

        qs = Test.objects.filter(module=test_type, is_deleted=False)

        if include_drafts:
            # Admin xohlasa drafts ham qaytariladi (frontend disabled holda
            # ko'rsatadi va 'publish qiling' hint beradi).
            pass
        else:
            qs = qs.filter(Q(status='published') | Q(is_published=True))

        if getattr(user, 'role', None) == 'superadmin' or user.is_superuser:
            # Superadmin barcha published testlarni ko'radi
            pass
        elif org is not None:
            # Markaz admini: o'z org tests + global library
            qs = qs.filter(
                Q(organization=org)
                | Q(is_global=True)
                | Q(organization__isnull=True),
            )
        else:
            # Org siz user — faqat global testlar
            qs = qs.filter(
                Q(is_global=True) | Q(organization__isnull=True),
            )

        qs = qs.distinct().order_by('-published_at', 'name')

        # TestListSerializer'ga is_global va organization'ni qo'shamiz —
        # frontend "Your center" / "Library" label uchun ishlatadi.
        data = []
        for t in qs:
            base = TestListSerializer(t).data
            base['is_library'] = bool(t.is_global) or t.organization_id is None
            base['is_own_center'] = (
                org is not None and t.organization_id == getattr(org, 'id', None)
            )
            base['status'] = t.status
            base['is_published'] = t.is_published
            data.append(base)

        return Response({
            'count': len(data),
            'results': data,
        })
