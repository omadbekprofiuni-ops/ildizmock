from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db.models import Avg, Count, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.generics import RetrieveAPIView
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.attempts.models import Attempt

from .models import Organization, OrganizationMembership, Payment, Plan
from .permissions import IsSuperAdmin
from .serializers import (
    CenterAdminCreateSerializer,
    OrganizationCreateSerializer,
    OrganizationDetailSerializer,
    OrganizationListSerializer,
    PaymentSerializer,
    PlanSerializer,
    PublicOrgSerializer,
)

User = get_user_model()


# =====================================================================
# SUPERADMIN
# =====================================================================

class SuperAdminStatsView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        orgs = Organization.objects.all()
        active = orgs.filter(status='active').count()
        trial = orgs.filter(status='trial').count()
        expired = orgs.filter(status='expired').count()
        blocked = orgs.filter(status='blocked').count()

        revenue = Payment.objects.filter(status='paid').aggregate(
            total=Sum('amount_usd'),
        )['total'] or 0

        # Bu oy
        month_start = timezone.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        attempts_this_month = Attempt.objects.filter(
            started_at__gte=month_start,
        ).count()

        recent_payments = Payment.objects.filter(status='paid').select_related(
            'organization', 'plan',
        ).order_by('-paid_at')[:5]

        recent_students = User.objects.filter(role='student').select_related(
            'organization',
        ).order_by('-created_at')[:5]

        # Tarif tugayotganlar (7 kundan kam qolgan)
        soon_expiring = orgs.filter(
            status='active',
            plan_expires_at__lte=timezone.now() + timedelta(days=7),
            plan_expires_at__gte=timezone.now(),
        ).order_by('plan_expires_at')[:5]

        # Modul bo'yicha attempts va o'rtacha band
        from apps.attempts.models import Attempt as _Attempt
        from apps.tests.models import Test
        from apps.mock.models import MockSession, MockParticipant

        graded_attempts = _Attempt.objects.filter(status='graded')
        by_module = {}
        for module in ('listening', 'reading', 'writing', 'speaking'):
            mqs = graded_attempts.filter(test__module=module)
            avg = mqs.aggregate(a=Avg('band_score'))['a']
            by_module[module] = {
                'attempts': mqs.count(),
                'avg_band': round(float(avg), 2) if avg else None,
            }

        # Mock testlar bo'yicha
        mock_completed = MockParticipant.objects.filter(
            overall_band_score__isnull=False,
        )
        avg_mock_overall = mock_completed.aggregate(a=Avg('overall_band_score'))['a']

        return Response({
            'orgs_total': orgs.count(),
            'orgs_by_status': {
                'active': active, 'trial': trial,
                'expired': expired, 'blocked': blocked,
            },
            'students_total': User.objects.filter(role='student').count(),
            'teachers_total': User.objects.filter(role='teacher').count(),
            'tests_total': Test.objects.count(),
            'tests_global': Test.objects.filter(organization__isnull=True).count(),
            'mock_sessions_total': MockSession.objects.count(),
            'mock_sessions_finished': MockSession.objects.filter(status='finished').count(),
            'mock_completed_count': mock_completed.count(),
            'mock_avg_overall': round(float(avg_mock_overall), 2) if avg_mock_overall else None,
            'attempts_this_month': attempts_this_month,
            'attempts_total': _Attempt.objects.count(),
            'attempts_by_module': by_module,
            'revenue_total_usd': float(revenue),
            'recent_payments': PaymentSerializer(recent_payments, many=True).data,
            'recent_students': [{
                'username': u.username,
                'name': f'{u.first_name} {u.last_name}'.strip() or u.username,
                'org_name': u.organization.name if u.organization else None,
                'org_slug': u.organization.slug if u.organization else None,
                'created_at': u.created_at.isoformat(),
            } for u in recent_students],
            'soon_expiring': [{
                'id': o.id, 'name': o.name, 'slug': o.slug,
                'days_remaining': o.days_remaining,
                'plan_name': o.plan.name,
            } for o in soon_expiring],
        })


class SuperAdminOrganizationViewSet(viewsets.ModelViewSet):
    permission_classes = [IsSuperAdmin]
    queryset = Organization.objects.select_related('plan').all()

    def get_serializer_class(self):
        if self.action == 'create':
            return OrganizationCreateSerializer
        if self.action in ('retrieve',):
            return OrganizationDetailSerializer
        return OrganizationListSerializer

    def create(self, request, *args, **kwargs):
        ser = OrganizationCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        plan = data.get('plan') or Plan.objects.filter(code='trial').first()
        if plan is None:
            return Response({'plan': 'No plan available. Create a Plan first.'}, status=400)

        # 1. Org create
        org = Organization.objects.create(
            name=data['name'], slug=data['slug'],
            primary_color=data.get('primary_color', '#DC2626'),
            contact_phone=data.get('contact_phone', ''),
            contact_email=data.get('contact_email', ''),
            address=data.get('address', ''),
            notes=data.get('notes', ''),
            plan=plan, status='active',
            plan_starts_at=timezone.now(),
            plan_expires_at=timezone.now() + timedelta(days=plan.duration_days),
        )

        # 2. Org admin user
        from apps.accounts.serializers import _validate_username_format
        admin_username = _validate_username_format(data['admin_username'])
        if User.objects.filter(username=admin_username).exists():
            return Response({'admin_username': 'Username already taken.'}, status=400)
        admin = User.objects.create_user(
            username=admin_username,
            password=data['admin_password'],
            first_name=data['admin_first_name'],
            last_name=data.get('admin_last_name', '') or '',
            role='org_admin', organization=org, is_active=True,
        )
        OrganizationMembership.objects.get_or_create(
            user=admin, organization=org, role='admin',
        )

        # 3. Initial payment (status=paid, marked by current superadmin)
        Payment.objects.create(
            organization=org, plan=plan,
            amount_usd=plan.price_usd, status='paid',
            marked_paid_by=request.user, paid_at=timezone.now(),
            notes='Org creation initial payment',
        )

        out = OrganizationDetailSerializer(org).data
        out['admin'] = {
            'username': admin.username,
            'name': f'{admin.first_name} {admin.last_name}'.strip(),
        }
        return Response(out, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def renew(self, request, pk=None):
        """Tarifni yangilash (qo'lda to'lov belgilash)."""
        org = self.get_object()
        plan_id = request.data.get('plan_id') or org.plan_id
        plan = get_object_or_404(Plan, pk=plan_id)
        notes = request.data.get('notes', '')

        Payment.objects.create(
            organization=org, plan=plan,
            amount_usd=plan.price_usd, status='paid',
            marked_paid_by=request.user, paid_at=timezone.now(),
            notes=notes or 'Renewed by superadmin',
        )
        org.plan = plan
        org.plan_starts_at = timezone.now()
        org.plan_expires_at = timezone.now() + timedelta(days=plan.duration_days)
        org.status = 'active'
        org.save()
        return Response(OrganizationDetailSerializer(org).data)

    @action(detail=True, methods=['post'])
    def block(self, request, pk=None):
        org = self.get_object()
        org.status = 'blocked' if org.status != 'blocked' else 'active'
        org.save(update_fields=['status'])
        return Response(OrganizationDetailSerializer(org).data)

    @action(
        detail=True, methods=['post', 'delete'], url_path='logo',
        parser_classes=[MultiPartParser, FormParser],
    )
    def update_logo(self, request, pk=None):
        """Drag-and-drop logo upload (multipart) yoki DELETE qilib o'chirish."""
        org = self.get_object()
        if request.method == 'DELETE':
            if org.logo:
                org.logo.delete(save=False)
            org.logo = None
            org.save(update_fields=['logo'])
            return Response(OrganizationDetailSerializer(org).data)

        f = request.FILES.get('logo') or request.FILES.get('file')
        if not f:
            return Response({'detail': 'Fayl yuborilmagan.'}, status=400)
        org.logo = f
        org.save()
        return Response(OrganizationDetailSerializer(org).data)

    @action(detail=True, methods=['get'])
    def admins(self, request, pk=None):
        """List org_admin users for this center."""
        org = self.get_object()
        admins = org.users.filter(role='org_admin').order_by('-id')
        return Response([{
            'id': a.id,
            'username': a.username,
            'first_name': a.first_name,
            'last_name': a.last_name,
            'is_active': a.is_active,
            'last_login': a.last_login,
            'created_at': a.created_at,
        } for a in admins])

    @action(detail=True, methods=['post'])
    def add_admin(self, request, pk=None):
        """Add an additional admin to an existing center."""
        from apps.accounts.serializers import _validate_username_format
        org = self.get_object()
        ser = CenterAdminCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        username = _validate_username_format(ser.validated_data['username'])
        if User.objects.filter(username=username).exists():
            return Response({'username': 'Username already taken.'}, status=400)
        admin = User.objects.create_user(
            username=username,
            password=ser.validated_data['password'],
            first_name=ser.validated_data['first_name'],
            last_name=ser.validated_data.get('last_name', '') or '',
            role='org_admin', organization=org, is_active=True,
        )
        OrganizationMembership.objects.get_or_create(
            user=admin, organization=org, role='admin',
        )
        return Response({
            'id': admin.id,
            'username': admin.username,
            'first_name': admin.first_name,
            'last_name': admin.last_name,
            'message': f'Admin "{admin.username}" added to "{org.name}"',
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='reset_admin_password')
    def reset_admin_password(self, request, pk=None):
        """Reset password for one of this center's admins."""
        org = self.get_object()
        admin_id = request.data.get('admin_id')
        new_password = request.data.get('new_password') or ''
        if len(new_password) < 4:
            return Response({'new_password': 'Password too short (min 4).'}, status=400)
        try:
            admin = User.objects.get(id=admin_id, organization=org, role='org_admin')
        except User.DoesNotExist:
            return Response({'admin_id': 'Admin not found in this center.'}, status=404)
        admin.set_password(new_password)
        admin.save(update_fields=['password'])
        return Response({'message': f'Password reset for {admin.username}'})


class SuperAdminPlanViewSet(viewsets.ModelViewSet):
    permission_classes = [IsSuperAdmin]
    queryset = Plan.objects.all()
    serializer_class = PlanSerializer

    def destroy(self, request, *args, **kwargs):
        plan = self.get_object()
        if plan.organizations.exists():
            return Response(
                {'detail': 'Bu plan markazlarga biriktirilgan, o‘chirib bo‘lmaydi.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)


class SuperAdminPaymentViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsSuperAdmin]
    queryset = Payment.objects.select_related('organization', 'plan').all()
    serializer_class = PaymentSerializer


# =====================================================================
# PUBLIC
# =====================================================================

class PublicOrganizationView(RetrieveAPIView):
    """Markaz brand info — talaba register sahifasi uchun."""

    queryset = Organization.objects.filter(status__in=['active', 'trial'])
    lookup_field = 'slug'
    serializer_class = PublicOrgSerializer
    permission_classes = [AllowAny]


class PublicPlanListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response(PlanSerializer(Plan.objects.all(), many=True).data)


class PublicStudentRegisterView(APIView):
    """POST /public/register/ — student o'zi markaz slug bilan ro'yxatdan o'tadi."""

    permission_classes = [AllowAny]

    def post(self, request):
        from apps.accounts.serializers import UserSerializer, _validate_phone_format
        from apps.accounts.views import _set_cookies
        from rest_framework_simplejwt.tokens import RefreshToken

        slug = request.data.get('org_slug')
        if not slug:
            return Response({'detail': 'org_slug majburiy.'}, status=400)
        try:
            org = Organization.objects.get(slug=slug)
        except Organization.DoesNotExist:
            return Response({'detail': 'Markaz topilmadi.'}, status=404)
        if org.status not in ('active', 'trial'):
            return Response(
                {'detail': 'Markaz faol emas. Administratorga murojaat qiling.'},
                status=403,
            )
        if org.plan.max_students > 0 and org.students_count >= org.plan.max_students:
            return Response(
                {'detail': f'Markaz tarif limiti to‘ldi ({org.plan.max_students} ta talaba). '
                           'Markaz adminiga murojaat qiling.'},
                status=400,
            )

        phone = (request.data.get('phone') or '').strip()
        password = request.data.get('password') or ''
        first_name = (request.data.get('first_name') or '').strip()
        last_name = (request.data.get('last_name') or '').strip()

        try:
            _validate_phone_format(phone)
        except Exception as e:
            return Response({'phone': str(e)}, status=400)
        if len(password) < 8:
            return Response({'password': 'Parol kamida 8 ta belgi.'}, status=400)
        if User.objects.filter(phone=phone).exists():
            return Response(
                {'phone': 'Bu telefon allaqachon ro‘yxatdan o‘tgan.'},
                status=400,
            )

        user = User.objects.create_user(
            phone=phone, password=password,
            first_name=first_name, last_name=last_name,
            role='student', organization=org, is_active=True,
        )
        # Auto-login: JWT cookies set
        refresh = RefreshToken.for_user(user)
        response = Response(UserSerializer(user).data, status=201)
        return _set_cookies(response, str(refresh.access_token), str(refresh))
