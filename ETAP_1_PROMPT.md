# 🎯 ILDIZmock — Etap 1: Multi-Tenancy + SuperAdmin

> **Maqsad:** SuperAdmin edu centerlar yaratadi va ularga login/parol beradi.
> **Vaqt:** 1-2 ish kuni (sekin va sifatli).
> **Sessiya:** Bu Claude Code da yangi sessiya bo'lsin.

---

## CONTEXT — Avval o'qing

Hozirgi loyiha: `mock_exam/` papkada
- Backend: Django (Python) + DRF + JWT
- Frontend: React 18 + Vite + TypeScript + Tailwind
- Database: PostgreSQL

Hozir bor:
- ✅ SuperAdmin login: `jasmina/jasmina`
- ✅ User modeli (role: superadmin, student, teacher)
- ✅ Test, Question, Attempt modellari
- ✅ Reading va Listening testlar (4 ta dan, har xil daraja)
- ✅ Talaba test topshirish flow

Endi qo'shamiz:
- **Edu Center (markaz) modeli**
- SuperAdmin markazlar yaratadi
- Har markaz uchun path: `/taredu`, `/brightedu`
- Admin panel: SuperAdmin → Centers
- Markaz logosi yuklash
- Markaz uchun edu_admin login/parol yaratish

---

## QISM 1: BACKEND — Edu Center modeli (40 daqiqa)

### 1.1 Yangi app: `organizations`

```bash
cd backend
.venv/bin/python manage.py startapp organizations
mv organizations apps/
```

`apps/organizations/apps.py`:
```python
class OrganizationsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.organizations'
```

`config/settings.py` INSTALLED_APPS ga qo'sh:
```python
'apps.organizations',
```

### 1.2 Organization model

`apps/organizations/models.py`:

```python
from django.db import models
from django.utils import timezone


class Organization(models.Model):
    """Edu Center (markaz)"""
    
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('suspended', 'Suspended'),
    ]
    
    name = models.CharField(max_length=200)
    slug = models.SlugField(
        unique=True, 
        help_text='URL path (e.g. "taredu" → ildizmock.uz/taredu)'
    )
    
    # Branding
    logo = models.ImageField(upload_to='org_logos/', null=True, blank=True)
    primary_color = models.CharField(
        max_length=7, default='#0F172A',
        help_text='Hex color, e.g. #DC2626'
    )
    
    # Contact
    contact_phone = models.CharField(max_length=20, blank=True)
    contact_email = models.EmailField(blank=True)
    address = models.CharField(max_length=300, blank=True)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    
    notes = models.TextField(blank=True, help_text='Internal notes (only superadmin sees)')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['name']
    
    def __str__(self):
        return self.name
    
    @property
    def students_count(self):
        return self.users.filter(role='student').count()
    
    @property
    def teachers_count(self):
        return self.users.filter(role='teacher').count()
    
    @property
    def admins_count(self):
        return self.users.filter(role='center_admin').count()
```

### 1.3 User model yangilash

`apps/accounts/models.py` — quyidagilarni qo'sh:

```python
class User(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = [
        ('superadmin', 'Super Admin'),
        ('center_admin', 'Center Admin'),  # YANGI
        ('teacher', 'Teacher'),
        ('student', 'Student'),
    ]
    
    # ... mavjud fieldlar ...
    
    # YANGI: organization
    organization = models.ForeignKey(
        'organizations.Organization',
        on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='users',
        help_text='Null only for superadmin'
    )
    
    # mavjud:
    # username, password, role, first_name, last_name, phone, ...
    
    def clean(self):
        super().clean()
        # Validation: superadmin must have no org, others must have org
        if self.role == 'superadmin' and self.organization:
            raise ValidationError("Superadmin should not belong to an organization")
        if self.role != 'superadmin' and not self.organization:
            raise ValidationError("This role requires an organization")
```

### 1.4 Migration

```bash
.venv/bin/python manage.py makemigrations organizations accounts
.venv/bin/python manage.py migrate
```

**MUHIM:** Mavjud user'lar `organization=null`. Ular hozircha shunday qoladi. Migration da default `null=True, blank=True` bo'lgani uchun avtomatik OK.

### 1.5 Test model'ga organization qo'sh

`apps/tests/models.py`:

```python
class Test(models.Model):
    # mavjud fieldlar
    
    # YANGI:
    organization = models.ForeignKey(
        'organizations.Organization',
        on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='tests',
        help_text='Null = global test (created by superadmin, available to all)'
    )
    
    is_global = models.BooleanField(
        default=False,
        help_text='If True, all centers can use this test'
    )
```

Migration:
```bash
.venv/bin/python manage.py makemigrations tests
.venv/bin/python manage.py migrate
```

Mavjud testlar: `organization=null, is_global=True` qilib qo'y (ular SuperAdmin yaratgan global testlar).

```python
# Migration data fix
Test.objects.filter(organization__isnull=True).update(is_global=True)
```

Yoki shell da:
```bash
.venv/bin/python manage.py shell -c "
from apps.tests.models import Test
Test.objects.filter(organization__isnull=True).update(is_global=True)
print('Global tests:', Test.objects.filter(is_global=True).count())
"
```

---

## QISM 2: BACKEND — SuperAdmin API (30 daqiqa)

### 2.1 Permissions

`apps/organizations/permissions.py`:

```python
from rest_framework.permissions import BasePermission

class IsSuperAdmin(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and 
            request.user.role == 'superadmin'
        )

class IsCenterAdmin(BasePermission):
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.user.role == 'superadmin':
            return True  # superadmin has all permissions
        return request.user.role == 'center_admin'

class IsCenterMember(BasePermission):
    """Object-level: must belong to same organization"""
    def has_object_permission(self, request, view, obj):
        if request.user.role == 'superadmin':
            return True
        return getattr(obj, 'organization_id', None) == request.user.organization_id
```

### 2.2 Serializers

`apps/organizations/serializers.py`:

```python
from rest_framework import serializers
from .models import Organization
from apps.accounts.models import User


class OrganizationSerializer(serializers.ModelSerializer):
    students_count = serializers.IntegerField(read_only=True)
    teachers_count = serializers.IntegerField(read_only=True)
    admins_count = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = Organization
        fields = [
            'id', 'name', 'slug', 'logo', 'primary_color',
            'contact_phone', 'contact_email', 'address',
            'status', 'notes',
            'students_count', 'teachers_count', 'admins_count',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']
    
    def validate_slug(self, value):
        # Reserved slugs
        reserved = ['super', 'admin', 'login', 'register', 'api', 
                    'static', 'media', 'tests', 'auth']
        if value.lower() in reserved:
            raise serializers.ValidationError(f"'{value}' is reserved")
        return value.lower()


class CreateCenterAdminSerializer(serializers.Serializer):
    """SuperAdmin creates first admin for a new center"""
    username = serializers.CharField()
    password = serializers.CharField(min_length=4)
    first_name = serializers.CharField()
    last_name = serializers.CharField(required=False, allow_blank=True)
    
    def validate_username(self, value):
        value = value.lower().strip()
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Username already taken")
        return value


class CenterCreationSerializer(serializers.Serializer):
    """Single endpoint to create center + admin together"""
    # Center
    name = serializers.CharField()
    slug = serializers.SlugField()
    primary_color = serializers.CharField(default='#0F172A')
    contact_phone = serializers.CharField(required=False, allow_blank=True)
    contact_email = serializers.EmailField(required=False, allow_blank=True)
    address = serializers.CharField(required=False, allow_blank=True)
    notes = serializers.CharField(required=False, allow_blank=True)
    
    # Admin
    admin_username = serializers.CharField()
    admin_password = serializers.CharField(min_length=4)
    admin_first_name = serializers.CharField()
    admin_last_name = serializers.CharField(required=False, allow_blank=True)
    
    def validate_slug(self, value):
        reserved = ['super', 'admin', 'login', 'register', 'api']
        if value.lower() in reserved:
            raise serializers.ValidationError(f"'{value}' is reserved")
        if Organization.objects.filter(slug=value.lower()).exists():
            raise serializers.ValidationError("Slug already exists")
        return value.lower()
    
    def validate_admin_username(self, value):
        value = value.lower().strip()
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Username already taken")
        return value
```

### 2.3 Views

`apps/organizations/views.py`:

```python
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from .models import Organization
from .serializers import OrganizationSerializer, CenterCreationSerializer, CreateCenterAdminSerializer
from .permissions import IsSuperAdmin
from apps.accounts.models import User


class OrganizationViewSet(viewsets.ModelViewSet):
    queryset = Organization.objects.all()
    serializer_class = OrganizationSerializer
    permission_classes = [IsSuperAdmin]
    
    @action(detail=False, methods=['post'])
    def create_with_admin(self, request):
        """Create center + first admin in one step"""
        serializer = CenterCreationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        
        with transaction.atomic():
            # Create org
            org = Organization.objects.create(
                name=data['name'],
                slug=data['slug'],
                primary_color=data.get('primary_color', '#0F172A'),
                contact_phone=data.get('contact_phone', ''),
                contact_email=data.get('contact_email', ''),
                address=data.get('address', ''),
                notes=data.get('notes', ''),
            )
            
            # Create admin
            admin = User.objects.create_user(
                username=data['admin_username'],
                password=data['admin_password'],
                first_name=data['admin_first_name'],
                last_name=data.get('admin_last_name', ''),
                role='center_admin',
                organization=org,
            )
        
        return Response({
            'organization': OrganizationSerializer(org).data,
            'admin': {
                'id': admin.id,
                'username': admin.username,
                'first_name': admin.first_name,
                'last_name': admin.last_name,
            },
            'message': f'Center "{org.name}" created. Admin login: {admin.username}'
        }, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'])
    def add_admin(self, request, pk=None):
        """Add additional admin to existing center"""
        org = self.get_object()
        serializer = CreateCenterAdminSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        admin = User.objects.create_user(
            username=serializer.validated_data['username'],
            password=serializer.validated_data['password'],
            first_name=serializer.validated_data['first_name'],
            last_name=serializer.validated_data.get('last_name', ''),
            role='center_admin',
            organization=org,
        )
        
        return Response({
            'id': admin.id,
            'username': admin.username,
            'message': f'Admin "{admin.username}" added to "{org.name}"'
        })
    
    @action(detail=True, methods=['post'])
    def reset_admin_password(self, request, pk=None):
        """Reset password for an admin in this center"""
        org = self.get_object()
        admin_id = request.data.get('admin_id')
        new_password = request.data.get('new_password')
        
        if not new_password or len(new_password) < 4:
            return Response({'error': 'Password too short'}, status=400)
        
        try:
            admin = User.objects.get(id=admin_id, organization=org, role='center_admin')
        except User.DoesNotExist:
            return Response({'error': 'Admin not found'}, status=404)
        
        admin.set_password(new_password)
        admin.save()
        
        return Response({'message': f'Password reset for {admin.username}'})
    
    @action(detail=True, methods=['get'])
    def admins(self, request, pk=None):
        """List admins of a center"""
        org = self.get_object()
        admins = org.users.filter(role='center_admin')
        return Response([
            {
                'id': a.id,
                'username': a.username,
                'first_name': a.first_name,
                'last_name': a.last_name,
                'is_active': a.is_active,
                'last_login': a.last_login,
            }
            for a in admins
        ])
```

### 2.4 URLs

`apps/organizations/urls.py`:

```python
from rest_framework.routers import DefaultRouter
from .views import OrganizationViewSet

router = DefaultRouter()
router.register(r'organizations', OrganizationViewSet, basename='organization')

urlpatterns = router.urls
```

`config/urls.py` — qo'sh:
```python
path('api/v1/super/', include('apps.organizations.urls')),
```

### 2.5 Public endpoint — markaz ma'lumoti (talaba uchun)

`apps/organizations/views.py` ga qo'sh:

```python
from rest_framework.permissions import AllowAny
from rest_framework.generics import RetrieveAPIView


class PublicOrganizationView(RetrieveAPIView):
    """For students visiting /taredu — get center branding"""
    queryset = Organization.objects.filter(status='active')
    serializer_class = OrganizationSerializer
    permission_classes = [AllowAny]
    lookup_field = 'slug'
```

URL:
```python
path('api/v1/public/orgs/<str:slug>/', PublicOrganizationView.as_view()),
```

### 2.6 Test API

```bash
# SuperAdmin login
curl -X POST http://127.0.0.1:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"jasmina","password":"jasmina"}' \
  -c /tmp/cookies.txt

# Create center
curl -X POST http://127.0.0.1:8000/api/v1/super/organizations/create_with_admin/ \
  -H "Content-Type: application/json" \
  -b /tmp/cookies.txt \
  -d '{
    "name": "Taraqqiyot Edu",
    "slug": "taredu",
    "primary_color": "#DC2626",
    "contact_phone": "+998901234567",
    "admin_username": "taredu_admin",
    "admin_password": "taredu2026",
    "admin_first_name": "Aziz",
    "admin_last_name": "Karimov"
  }'

# List centers
curl http://127.0.0.1:8000/api/v1/super/organizations/ -b /tmp/cookies.txt

# Public endpoint (no auth)
curl http://127.0.0.1:8000/api/v1/public/orgs/taredu/
```

---

## QISM 3: FRONTEND — SuperAdmin Centers UI (60 daqiqa)

### 3.1 Sidebar yangila

`src/components/SuperAdminLayout.tsx` ga **Centers** ni qo'sh:

```tsx
const menuItems = [
  { href: '/super', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/super/organizations', label: 'Centers', icon: Building2 },
  // bu 2 ta hozircha yetarli
]
```

### 3.2 Centers Page

`src/pages/super/CentersPage.tsx`:

```tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Plus, Building2, Users, Edit, Eye, Trash2 } from 'lucide-react'
import CreateCenterDialog from './CreateCenterDialog'
import { toast } from 'sonner'

export default function CentersPage() {
  const [showCreate, setShowCreate] = useState(false)
  
  const { data: centers, isLoading } = useQuery({
    queryKey: ['centers'],
    queryFn: async () => {
      const { data } = await api.get('/super/organizations/')
      return data.results || data
    }
  })
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Centers</h1>
          <p className="text-gray-500 mt-1">Manage education centers</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Center
        </Button>
      </div>
      
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : centers?.length === 0 ? (
        <EmptyState onAdd={() => setShowCreate(true)} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {centers?.map((center: any) => (
            <CenterCard key={center.id} center={center} />
          ))}
        </div>
      )}
      
      <CreateCenterDialog open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  )
}

function CenterCard({ center }: { center: any }) {
  const accentStyle = { 
    borderTopColor: center.primary_color, 
    borderTopWidth: '4px' 
  }
  
  return (
    <div className="border border-gray-200 rounded-xl bg-white overflow-hidden 
                    hover:shadow-lg transition-shadow"
         style={accentStyle}>
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {center.logo ? (
              <img src={center.logo} alt={center.name} 
                   className="w-12 h-12 rounded-lg object-cover" />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center 
                              justify-center">
                <Building2 className="w-6 h-6 text-gray-400" />
              </div>
            )}
            <div>
              <h3 className="font-semibold text-lg leading-tight">{center.name}</h3>
              <p className="text-xs text-gray-500 font-mono">/{center.slug}</p>
            </div>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
            center.status === 'active' 
              ? 'bg-green-50 text-green-700' 
              : 'bg-gray-100 text-gray-600'
          }`}>
            {center.status}
          </span>
        </div>
        
        <div className="grid grid-cols-3 gap-2 mb-4 pt-4 border-t border-gray-100">
          <div>
            <div className="text-xl font-bold">{center.students_count}</div>
            <div className="text-xs text-gray-500">Students</div>
          </div>
          <div>
            <div className="text-xl font-bold">{center.teachers_count}</div>
            <div className="text-xs text-gray-500">Teachers</div>
          </div>
          <div>
            <div className="text-xl font-bold">{center.admins_count}</div>
            <div className="text-xs text-gray-500">Admins</div>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Link to={`/super/organizations/${center.id}`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full">
              <Eye className="w-4 h-4 mr-1" /> View
            </Button>
          </Link>
          <a href={`/${center.slug}`} target="_blank" rel="noopener" 
             className="flex-1">
            <Button variant="outline" size="sm" className="w-full">
              Open Site
            </Button>
          </a>
        </div>
      </div>
    </div>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="border border-dashed border-gray-300 rounded-xl p-12 text-center 
                    bg-gray-50">
      <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
      <h3 className="text-lg font-semibold mb-2">No centers yet</h3>
      <p className="text-gray-500 text-sm mb-6">
        Create your first education center to get started.
      </p>
      <Button onClick={onAdd}>
        <Plus className="w-4 h-4 mr-2" /> Add First Center
      </Button>
    </div>
  )
}
```

### 3.3 Create Center Dialog

`src/pages/super/CreateCenterDialog.tsx`:

```tsx
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } 
  from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Copy, Check } from 'lucide-react'

const schema = z.object({
  name: z.string().min(2, 'Name is required'),
  slug: z.string()
    .min(2)
    .regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers, and hyphens'),
  primary_color: z.string().default('#0F172A'),
  contact_phone: z.string().optional(),
  contact_email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  notes: z.string().optional(),
  
  admin_username: z.string()
    .min(3)
    .regex(/^[a-z0-9_]+$/, 'Only lowercase letters, numbers, and underscores'),
  admin_password: z.string().min(4, 'At least 4 characters'),
  admin_first_name: z.string().min(1),
  admin_last_name: z.string().optional(),
})

export default function CreateCenterDialog({ 
  open, onClose 
}: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [createdCredentials, setCreatedCredentials] = useState<any>(null)
  const [copied, setCopied] = useState(false)
  
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      slug: '',
      primary_color: '#0F172A',
      admin_username: '',
      admin_password: generatePassword(),
      admin_first_name: '',
    }
  })
  
  // Auto-generate slug from name
  const watchName = form.watch('name')
  const handleNameBlur = () => {
    if (!form.getValues('slug') && watchName) {
      const slug = watchName.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .slice(0, 30)
      form.setValue('slug', slug)
    }
  }
  
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const { data: result } = await api.post(
        '/super/organizations/create_with_admin/', 
        data
      )
      return result
    },
    onSuccess: (data) => {
      setCreatedCredentials({
        url: `${window.location.origin}/${data.organization.slug}`,
        username: data.admin.username,
        password: form.getValues('admin_password'),
        centerName: data.organization.name,
      })
      queryClient.invalidateQueries({ queryKey: ['centers'] })
      form.reset()
    },
    onError: (error: any) => {
      const msg = error?.response?.data
      if (typeof msg === 'object') {
        Object.entries(msg).forEach(([key, val]) => {
          form.setError(key as any, { message: String(val) })
        })
      } else {
        toast.error('Failed to create center')
      }
    }
  })
  
  const handleClose = () => {
    setCreatedCredentials(null)
    form.reset()
    onClose()
  }
  
  const copyCredentials = () => {
    if (!createdCredentials) return
    const text = `Center: ${createdCredentials.centerName}
URL: ${createdCredentials.url}
Username: ${createdCredentials.username}
Password: ${createdCredentials.password}`
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Copied to clipboard')
  }
  
  if (createdCredentials) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Center Created Successfully</DialogTitle>
          </DialogHeader>
          
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 my-4">
            <p className="text-sm text-green-800 mb-3">
              Save these credentials. They will not be shown again.
            </p>
            <div className="bg-white rounded p-3 font-mono text-sm space-y-1">
              <div><strong>Center:</strong> {createdCredentials.centerName}</div>
              <div><strong>URL:</strong> {createdCredentials.url}</div>
              <div><strong>Username:</strong> {createdCredentials.username}</div>
              <div><strong>Password:</strong> {createdCredentials.password}</div>
            </div>
            <Button 
              onClick={copyCredentials} 
              variant="outline" 
              size="sm" 
              className="mt-3 w-full"
            >
              {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
              {copied ? 'Copied' : 'Copy all credentials'}
            </Button>
          </div>
          
          <DialogFooter>
            <Button onClick={handleClose}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }
  
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Center</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} 
              className="space-y-6">
          
          <div>
            <h3 className="font-semibold mb-3">Center Information</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Center Name *</Label>
                <Input {...form.register('name')} 
                       placeholder="Taraqqiyot Edu Center"
                       onBlur={handleNameBlur} />
                {form.formState.errors.name && (
                  <p className="text-red-500 text-xs mt-1">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>
              <div>
                <Label>URL Slug *</Label>
                <Input {...form.register('slug')} placeholder="taredu" />
                <p className="text-xs text-gray-500 mt-1">
                  URL: ildizmock.uz/<strong>{form.watch('slug') || 'slug'}</strong>
                </p>
                {form.formState.errors.slug && (
                  <p className="text-red-500 text-xs mt-1">
                    {form.formState.errors.slug.message}
                  </p>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <Label>Primary Color</Label>
                <div className="flex gap-2">
                  <Input {...form.register('primary_color')} type="color" 
                         className="w-16 p-1 h-10" />
                  <Input {...form.register('primary_color')} placeholder="#0F172A" />
                </div>
              </div>
              <div>
                <Label>Contact Phone</Label>
                <Input {...form.register('contact_phone')} 
                       placeholder="+998 90 123 45 67" />
              </div>
            </div>
            
            <div className="mt-3">
              <Label>Address</Label>
              <Input {...form.register('address')} 
                     placeholder="Tashkent, Yunusobod 12-3" />
            </div>
          </div>
          
          <div className="pt-4 border-t">
            <h3 className="font-semibold mb-3">First Admin Account</h3>
            <p className="text-sm text-gray-500 mb-3">
              This admin will manage students, teachers, and tests for this center.
            </p>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Username *</Label>
                <Input {...form.register('admin_username')} 
                       placeholder="taredu_admin" />
                {form.formState.errors.admin_username && (
                  <p className="text-red-500 text-xs mt-1">
                    {form.formState.errors.admin_username.message}
                  </p>
                )}
              </div>
              <div>
                <Label>Password *</Label>
                <div className="flex gap-2">
                  <Input {...form.register('admin_password')} 
                         placeholder="At least 4 characters" />
                  <Button type="button" variant="outline" size="sm"
                          onClick={() => form.setValue('admin_password', generatePassword())}>
                    Generate
                  </Button>
                </div>
                {form.formState.errors.admin_password && (
                  <p className="text-red-500 text-xs mt-1">
                    {form.formState.errors.admin_password.message}
                  </p>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <Label>Admin First Name *</Label>
                <Input {...form.register('admin_first_name')} placeholder="Aziz" />
              </div>
              <div>
                <Label>Admin Last Name</Label>
                <Input {...form.register('admin_last_name')} placeholder="Karimov" />
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create Center'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function generatePassword(): string {
  // Simple password: word + 4 digits
  const words = ['edu', 'mock', 'test', 'study', 'learn']
  const word = words[Math.floor(Math.random() * words.length)]
  const num = Math.floor(1000 + Math.random() * 9000)
  return `${word}${num}`
}
```

### 3.4 Center Detail Page

`src/pages/super/CenterDetailPage.tsx`:

```tsx
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import api from '@/lib/api'
import { ArrowLeft, Plus, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

export default function CenterDetailPage() {
  const { id } = useParams()
  
  const { data: center } = useQuery({
    queryKey: ['center', id],
    queryFn: async () => {
      const { data } = await api.get(`/super/organizations/${id}/`)
      return data
    }
  })
  
  const { data: admins } = useQuery({
    queryKey: ['center', id, 'admins'],
    queryFn: async () => {
      const { data } = await api.get(`/super/organizations/${id}/admins/`)
      return data
    }
  })
  
  if (!center) return <div>Loading...</div>
  
  return (
    <div className="space-y-6 max-w-4xl">
      <Link to="/super/organizations" 
            className="text-sm text-gray-500 hover:text-black flex items-center gap-1">
        <ArrowLeft className="w-4 h-4" /> Back to Centers
      </Link>
      
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">{center.name}</h1>
          <p className="text-gray-500 font-mono mt-1">
            ildizmock.uz/{center.slug}
          </p>
        </div>
        <a href={`/${center.slug}`} target="_blank" rel="noopener">
          <Button variant="outline">Open Site</Button>
        </a>
      </div>
      
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Students" value={center.students_count} />
        <StatCard label="Teachers" value={center.teachers_count} />
        <StatCard label="Admins" value={center.admins_count} />
      </div>
      
      <div className="border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Admins</h2>
          <Button size="sm" variant="outline">
            <Plus className="w-4 h-4 mr-1" /> Add Admin
          </Button>
        </div>
        
        <div className="space-y-2">
          {admins?.map((admin: any) => (
            <div key={admin.id} 
                 className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <div className="font-medium">
                  {admin.first_name} {admin.last_name}
                </div>
                <div className="text-sm text-gray-500 font-mono">
                  {admin.username}
                </div>
              </div>
              <Button size="sm" variant="ghost">
                <KeyRound className="w-4 h-4 mr-1" />
                Reset Password
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-gray-200 rounded-xl p-6 bg-white">
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
    </div>
  )
}
```

### 3.5 Routes

`src/App.tsx` ga qo'sh:

```tsx
{ path: '/super/organizations', element: <CentersPage /> },
{ path: '/super/organizations/:id', element: <CenterDetailPage /> },
```

---

## QISM 4: TALABA UCHUN MARKAZ SAHIFASI (30 daqiqa)

### 4.1 Slug bilan markaz sahifasi

`src/pages/CenterPage.tsx` (path: `/:slug` masalan `/taredu`):

```tsx
import { useParams, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

export default function CenterPage() {
  const { slug } = useParams()
  
  const { data: center, isLoading, error } = useQuery({
    queryKey: ['public-org', slug],
    queryFn: async () => {
      const { data } = await api.get(`/public/orgs/${slug}/`)
      return data
    },
    retry: false,
  })
  
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }
  
  if (error || !center) {
    return <Navigate to="/" replace />
  }
  
  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Co-brand */}
            <div className="flex items-center gap-3">
              <span className="text-xl font-bold">ILDIZmock</span>
              <span className="text-gray-300">×</span>
              {center.logo ? (
                <img src={center.logo} alt={center.name} className="h-8" />
              ) : (
                <span className="text-xl font-semibold" 
                      style={{ color: center.primary_color }}>
                  {center.name}
                </span>
              )}
            </div>
          </div>
          <a href={`/login?center=${center.slug}`} 
             className="px-4 py-2 rounded-lg text-white font-medium"
             style={{ backgroundColor: center.primary_color }}>
            Sign In
          </a>
        </div>
      </nav>
      
      <main className="max-w-4xl mx-auto px-6 py-20 text-center">
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-6">
          Welcome to {center.name}
        </h1>
        <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-12">
          Practice IELTS in real exam format. Sign in with your credentials 
          provided by the center administrator.
        </p>
        
        <a href={`/login?center=${center.slug}`} 
           className="inline-block px-8 py-3 rounded-lg text-white font-semibold text-lg"
           style={{ backgroundColor: center.primary_color }}>
          Sign In to Practice
        </a>
      </main>
      
      <footer className="border-t border-gray-200 px-6 py-6 mt-20 text-center 
                         text-sm text-gray-500">
        © 2026 {center.name} · Powered by ILDIZmock
      </footer>
    </div>
  )
}
```

### 4.2 Routes — slug catch-all

`src/App.tsx`:

```tsx
// Mavjud routelar yuqorida...

// Pastda — eng oxirida (catch-all):
{ path: '/:slug', element: <CenterPage /> },
{ path: '/:slug/login', element: <CenterLoginPage /> },  // keyin yaratamiz
```

**MUHIM:** `:slug` route eng oxirgi bo'lsin, aks holda `/super`, `/login` ham slug deb tushuniladi.

---

## QISM 5: SINOV — NIMA BO'LSA QILGANI ISHLAYAPTI? (15 daqiqa)

### 5.1 Backend test

```bash
# 1. Login as superadmin
curl -X POST http://127.0.0.1:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"jasmina","password":"jasmina"}' \
  -c /tmp/super.txt

# 2. Create center
curl -X POST http://127.0.0.1:8000/api/v1/super/organizations/create_with_admin/ \
  -H "Content-Type: application/json" \
  -b /tmp/super.txt \
  -d '{
    "name": "Taraqqiyot Edu",
    "slug": "taredu",
    "primary_color": "#DC2626",
    "admin_username": "taredu_admin",
    "admin_password": "taredu2026",
    "admin_first_name": "Aziz"
  }'

# 3. List centers
curl http://127.0.0.1:8000/api/v1/super/organizations/ -b /tmp/super.txt | python -m json.tool

# 4. Public endpoint (no auth)
curl http://127.0.0.1:8000/api/v1/public/orgs/taredu/ | python -m json.tool

# 5. Try to login as new center admin
curl -X POST http://127.0.0.1:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"taredu_admin","password":"taredu2026"}' \
  -c /tmp/admin.txt
```

### 5.2 Frontend test

1. `localhost:5173/login` → `jasmina/jasmina`
2. `/super/organizations` ga o't
3. "+ New Center" tugmasini bos
4. Forma to'ldir (name: "Bright Academy", slug: "bright")
5. Admin username/password generate qil
6. Saqla → kredensiallar ekrani
7. "Copy" tugmasini bos
8. "Done"
9. Centers list da yangi karta ko'rinadi
10. `/bright` ga ot — center page ko'rinadi (ILDIZmock × Bright)

### 5.3 Login as new admin

1. Logout qil
2. `/login` ga ot
3. `taredu_admin` / `taredu2026` bilan kir
4. **Hozircha** dashboard yo'q — keyingi etapda yaratamiz
5. Hech bo'lmasa 401 emas, login muvaffaqiyatli bo'lsin

---

## TUGAGACH

Quyidagilarni tasdiqla:

- [ ] SuperAdmin centers yarata oladi (forma orqali)
- [ ] Har center uchun avtomatik 1-ta admin yaratiladi
- [ ] Kredensiallar ekranda ko'rinadi va copy qilinadi
- [ ] `/taredu` URL ochiladi va center landing ko'rinadi
- [ ] Center landing da co-brand: ILDIZmock × CenterName
- [ ] Center admin login qila oladi
- [ ] API endpointlar ishlaydi (curl bilan tekshirilgan)
- [ ] Centers list sahifasi (CentersPage) ishlaydi
- [ ] Center detail page (admins ro'yxati) ishlaydi
- [ ] Eski jasmina/jasmina hali ham ishlaydi

Agar hammasi ✅ bo'lsa "**ETAP 1 DONE**" deb ayt va menga screenshot yubor.

Agar xato bo'lsa terminal output va brauzer console ni yubor.

---

## ETAP 1 TUGAGACH KEYINGI

Etap 2 da:
- Edu admin paneli (talabalar, ustozlar)
- Test bazasi yaratish (admin uchun)
- Global testlar katalogi (SuperAdmin yaratgan testlar)
- Edu admin "Mening bazaga qo'shish" funksiyasi

Bu prompt davom etmaydi. **Faqat ETAP 1 ni tugat va menga ayt.**

---

## ESLATMALAR

1. **Eski testlar** (`is_global=True` qilingan)— hammaga ko'rinadi, lekin endi global flag bilan
2. **Eski user'lar** (jasmina, talabalar) — `organization=null` qoladi (jasmina superadmin uchun OK)
3. **`/login` route** — hozircha o'zgarmaydi, hamma role uchun bir xil
4. **Sinov uchun centerlar oson yaratilsin** — agar xato bo'lsa, qaytadan urinib ko'rish oson

Boshlang. Savol berma, kod yoz. Tugagach screenshot va xulosa yubor.
