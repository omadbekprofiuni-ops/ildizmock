# 🎯 ILDIZmock — Etap 2: Edu Admin Paneli + Test Bazasi (CRUD + Wizard)

> **Maqsad:** Markaz admini talabalar/ustozlar yaratadi. SuperAdmin global testlar yaratadi (audio, savollar). Markaz global katalogdan testlar nusxalaydi.
>
> **Vaqt:** 1-2 ish kuni (sekin va sifatli — shoshilmang).
>
> **Sessiya:** Bu Claude Code da YANGI sessiya bo'lsin. ETAP 1 sessiyasini yopib, yangidan boshlang.

---

## ⚠️ CONTEXT — Avval o'qing, hech narsa yozmang

### Loyiha holati (ETAP 1 dan keyin)

Hozirgi loyiha: `mock_exam/` papkada
- Backend: Django + DRF + JWT (httpOnly cookie) + PostgreSQL
- Frontend: React 18 + Vite + TypeScript + Tailwind + shadcn/ui
- Path: `/mnt/c/Users/Jasmina/Documents/Jasmina/Jasmina/mock_exam/`

### Kim bor (ETAP 1 dan keyin):

```
SuperAdmin: jasmina / jasmina
Center Admin: taredu_admin / taredu2026
   - Centerlar: taredu, brightedu (har biri o'z slug bilan)

Mavjud modellar:
   - User (role: superadmin, admin, teacher, student)
   - Organization (slug, name, logo, primary_color, status, notes)
   - OrganizationMembership (User ↔ Organization, role bo'yicha)
   - Test (organization FK + is_global field qo'shilgan)
   - Question (eski model — biz kengaytiramiz)
   - Attempt (eski model)

Mavjud API:
   - /api/v1/auth/login, /logout, /refresh, /me
   - /api/v1/super/orgs/ (CRUD, admins, add_admin, reset_admin_password)
   - /api/v1/public/orgs/<slug>/ (co-brand uchun ochiq)
```

### URL strukturasi (joriy)

```
ildizmock.uz/                  → Asosiy sayt
ildizmock.uz/login             → SuperAdmin login
ildizmock.uz/super             → SuperAdmin paneli
ildizmock.uz/super/centers     → Markazlar boshqaruvi
ildizmock.uz/super/centers/:id → Markaz detali

ildizmock.uz/taredu            → Co-brand landing (ILDIZmock × Taraqqiyot)
ildizmock.uz/taredu/login      → Markaz a'zolari login (admin/teacher/student)
ildizmock.uz/taredu/admin      → Markaz admin paneli ← BU ETAP DA QURAMIZ
```

### ETAP 2 da NIMA QURAMIZ

```
1. Backend: Test bazasini KENGAYTIRAMIZ
   - Test modeliga: difficulty, version, status, language, total_duration_minutes
   - YANGI: ListeningPart (4 ta, audio + transcript)
   - YANGI: Passage (Reading uchun, 3 ta)
   - YANGI: WritingTask (Task 1 va Task 2)
   - Question modeli polymorphism: 8 ta savol turi

2. Backend: Markaz admin API
   - /api/v1/center/students/ — talabalar CRUD
   - /api/v1/center/teachers/ — ustozlar CRUD
   - /api/v1/center/tests/ — markaz testlari + global katalog
   - Audio yuklash, rasm yuklash

3. Frontend: Markaz admin paneli
   - /:slug/admin (Layout + sidebar)
   - Dashboard (stats)
   - Students sahifasi (jadval + qo'shish)
   - Teachers sahifasi
   - Tests sahifasi (Mening testlarim + Global katalog)

4. Frontend: SuperAdmin test yaratish wizard
   - /super/tests (ro'yxat)
   - /super/tests/new (5 qadamli forma)
   - Listening: 4 audio + transcript + savollar
   - Reading: 3 passage + savollar
   - Writing: Task 1 + Task 2

5. Sinov: 15+ acceptance criteria
```

### MUHIM QOIDALAR (Jasmina aytdi)

> **"sekin sekin qilamiz"** — shoshilmang. Sifat birinchi.
>
> **"DONE deb yozma agar haqiqatan tugamasa"** — har qadamni tekshiring. curl bilan, brauzer bilan. Faqat hammasi ishlasagina "ETAP 2 DONE" deb yozing.
>
> **"sen code yozma boshqa Claude ga prompt yoz"** — bu prompt boshqa Claude Code sessiyasi uchun. Siz (men) endi shu promptni o'qib bajaring.

---

## ⚙️ ENVIRONMENT — Avval tekshiring

```bash
cd /mnt/c/Users/Jasmina/Documents/Jasmina/Jasmina/mock_exam

# Backend ishlayotganini tekshiring
cd backend
ls .venv/  # virtualenv bormi?
.venv/bin/python manage.py check
.venv/bin/python manage.py showmigrations | tail -20

# ETAP 1 modellari bormi?
.venv/bin/python -c "
from apps.organizations.models import Organization
print('Centers:', Organization.objects.count())
for o in Organization.objects.all():
    print(f'  {o.slug}: {o.name}')
"

# Frontend
cd ../frontend
ls node_modules/ | head -3  # bormi?
```

**Agar biror narsa ishlamasa — TO'XTANG va menga aytinng. ETAP 1 ni tugatmasdan ETAP 2 ni qilib bo'lmaydi.**

---

## 📦 QISM 1: BACKEND — Test bazasi modellari (60 daqiqa)

### Strategiya

Hozirgi `Test` va `Question` modellari sodda. Biz ularni **kengaytiramiz**, eski ma'lumotlarni saqlaymiz.

Yangi tuzilish:

```
Test (kengaytirilgan)
├── ListeningPart (Listening test bo'lsa, 4 ta)
│   ├── audio_file
│   ├── transcript
│   └── Question (10 ta savol)
│
├── Passage (Reading test bo'lsa, 3 ta)
│   ├── text
│   ├── title
│   └── Question (13 yoki 14 ta)
│
└── WritingTask (Writing test bo'lsa, 2 ta)
    ├── prompt
    ├── chart_image (Task 1 uchun)
    └── min_words

Question (polymorphic)
├── question_type: MCQ | TFNG | GAP_FILL | MATCHING | SHORT_ANSWER |
│                  FORM_COMPLETION | MAP_LABELING | SUMMARY_COMPLETION
├── prompt (savol matni)
├── options (JSON: variantlar yoki maydon ro'yxati)
├── correct_answer (JSON: to'g'ri javob/lar)
└── alt_answers (JSON: muqobil javoblar — gap fill uchun)
```

### 1.1 Eski Test modelini kengaytirish

`apps/tests/models.py` ni oching va **mavjud `Test` klasi**ga yangi fieldlar qo'shing:

```python
class Test(models.Model):
    # ... mavjud fieldlar (organization, is_global, name, etc.) ...

    # YANGI fieldlar:
    MODULE_CHOICES = [
        ('listening', 'Listening'),
        ('reading', 'Reading'),
        ('writing', 'Writing'),
        ('full_mock', 'Full Mock (L+R+W)'),
    ]

    DIFFICULTY_CHOICES = [
        ('easy', 'Easy (5.0–6.0)'),
        ('medium', 'Medium (6.0–7.0)'),
        ('hard', 'Hard (7.0–8.5)'),
    ]

    TYPE_CHOICES = [
        ('academic', 'Academic'),
        ('general', 'General Training'),
    ]

    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('published', 'Published'),
        ('archived', 'Archived'),
    ]

    module = models.CharField(max_length=20, choices=MODULE_CHOICES, default='listening')
    difficulty = models.CharField(max_length=10, choices=DIFFICULTY_CHOICES, default='medium')
    test_type = models.CharField(max_length=10, choices=TYPE_CHOICES, default='academic')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='draft')

    description = models.TextField(blank=True, default='')
    category = models.CharField(max_length=100, blank=True, default='', help_text='e.g. "Cambridge IELTS 19"')

    # Vaqt (daqiqa)
    duration_minutes = models.PositiveIntegerField(default=30)

    # Audit
    created_by = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_tests'
    )
    published_at = models.DateTimeField(null=True, blank=True)

    # Klon manbai (agar markaz global testdan klon qilgan bo'lsa)
    cloned_from = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='clones',
        help_text='Asl global test (agar bu klon bo'lsa)'
    )
```

**DIQQAT:** Agar `Test` modelida allaqachon shu nomli fieldlar bo'lsa — **tegmang, faqat kerakli yangi fieldlar qo'shing**. Bordi-yu konflikt bo'lsa, eski fieldni saqlab, yangi nom bilan qo'shing va menga ayting.

### 1.2 Yangi modellar

`apps/tests/models.py` ga **fayl oxirida** qo'shing:

```python
class ListeningPart(models.Model):
    """Listening test 4 qismdan iborat (Part 1, 2, 3, 4)"""
    test = models.ForeignKey(
        Test, on_delete=models.CASCADE, related_name='listening_parts'
    )
    part_number = models.PositiveSmallIntegerField(help_text='1, 2, 3 yoki 4')

    audio_file = models.FileField(upload_to='listening_audio/', null=True, blank=True)
    audio_duration_seconds = models.PositiveIntegerField(default=0)
    audio_bitrate_kbps = models.PositiveIntegerField(default=0)
    audio_size_bytes = models.PositiveIntegerField(default=0)

    transcript = models.TextField(blank=True, default='')
    instructions = models.TextField(blank=True, default='', help_text='Bo'lim ko'rsatmasi')

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['part_number']
        unique_together = [('test', 'part_number')]

    def __str__(self):
        return f'{self.test.name} — Part {self.part_number}'


class Passage(models.Model):
    """Reading test 3 ta passage dan iborat"""
    test = models.ForeignKey(
        Test, on_delete=models.CASCADE, related_name='passages'
    )
    section_number = models.PositiveSmallIntegerField(help_text='1, 2 yoki 3')

    title = models.CharField(max_length=300)
    subtitle = models.CharField(max_length=300, blank=True, default='')
    body_text = models.TextField(help_text='To'liq passage matni (paragraflar A, B, C bilan)')

    instructions = models.TextField(blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['section_number']
        unique_together = [('test', 'section_number')]


class WritingTask(models.Model):
    """Writing test 2 ta taskdan iborat"""
    test = models.ForeignKey(
        Test, on_delete=models.CASCADE, related_name='writing_tasks'
    )
    task_number = models.PositiveSmallIntegerField(help_text='1 yoki 2')

    prompt = models.TextField(help_text='Topshiriq matni')
    chart_image = models.ImageField(
        upload_to='writing_charts/', null=True, blank=True,
        help_text='Faqat Task 1 uchun (chart, grafik, jadval rasmi)'
    )

    min_words = models.PositiveIntegerField(default=150)
    suggested_minutes = models.PositiveIntegerField(default=20)

    requirements = models.TextField(
        blank=True, default='',
        help_text='Qo'shimcha talablar (masalan: "Compare both views")'
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['task_number']
        unique_together = [('test', 'task_number')]
```

### 1.3 Question modelini polymorphic qilish

Bu eng nozik qadam. Eski `Question` modeli bo'lsa — uni **kengaytiramiz**:

```python
class Question(models.Model):
    """Polymorphic question — har xil savol turlari"""

    QUESTION_TYPE_CHOICES = [
        ('mcq', 'Multiple Choice'),
        ('tfng', 'True / False / Not Given'),
        ('ynng', 'Yes / No / Not Given'),
        ('gap_fill', 'Gap Fill'),
        ('matching', 'Matching'),
        ('short_answer', 'Short Answer'),
        ('form_completion', 'Form Completion'),
        ('map_labeling', 'Map Labeling'),
        ('summary_completion', 'Summary Completion'),
    ]

    # Question PARENT bo'lishi mumkin: ListeningPart, Passage yoki WritingTask
    # Lekin oddiy yondashuv: faqat ListeningPart va Passage uchun
    # Writing javobi savol emas, balki essay
    listening_part = models.ForeignKey(
        ListeningPart, on_delete=models.CASCADE,
        related_name='questions', null=True, blank=True
    )
    passage = models.ForeignKey(
        Passage, on_delete=models.CASCADE,
        related_name='questions', null=True, blank=True
    )

    # ESKI fieldlar (agar mavjud bo'lsa, saqlang)
    # Yangi fieldlar:

    question_number = models.PositiveSmallIntegerField(help_text='Test ichidagi tartib raqam (1-40)')
    question_type = models.CharField(max_length=30, choices=QUESTION_TYPE_CHOICES, default='mcq')

    prompt = models.TextField(help_text='Savol matni')

    # Polymorphic ma'lumot — turiga qarab har xil
    options = models.JSONField(
        default=dict, blank=True,
        help_text='''Savol turiga qarab struktura:
        MCQ: {"choices": ["A. ...", "B. ...", "C. ...", "D. ..."]}
        TFNG: {} (bo'sh, javob fixed)
        GAP_FILL: {"sentence_with_blanks": "The rent is ___ pounds"}
        MATCHING: {"left": ["a","b","c"], "right": ["1","2","3"]}
        FORM_COMPLETION: {"fields": [{"label": "Name", "blank_id": 1}, ...]}
        MAP_LABELING: {"image_url": "...", "labels": ["A","B","C","D"]}
        SUMMARY_COMPLETION: {"summary_text_with_blanks": "..."}'''
    )

    correct_answer = models.JSONField(
        default=dict,
        help_text='''To'g'ri javob:
        MCQ: {"value": "B"}
        TFNG: {"value": "TRUE" | "FALSE" | "NOT GIVEN"}
        GAP_FILL: {"value": "450"}
        MATCHING: {"pairs": {"a": "1", "b": "3", "c": "2"}}
        FORM_COMPLETION: {"answers": {"1": "March", "2": "1998"}}'''
    )

    alt_answers = models.JSONField(
        default=list, blank=True,
        help_text='Muqobil to'g'ri javoblar (masalan ["four hundred fifty"])'
    )

    points = models.PositiveSmallIntegerField(default=1)

    class Meta:
        ordering = ['question_number']
```

**OGOHLANTIRISH:** Eski `Question` modelida boshqa fieldlar bo'lishi mumkin (masalan `text`, `choices`, `correct`). Ularni o'chirmang. Yangi fieldlar **qo'shimcha** bo'ladi. Yangi kod yangi fieldlardan foydalanadi.

### 1.4 TestClone audit modeli

```python
class TestClone(models.Model):
    """Markaz qaysi global testni nusxalaganini kuzatish (audit)"""
    organization = models.ForeignKey(
        'organizations.Organization', on_delete=models.CASCADE,
        related_name='test_clones'
    )
    source_test = models.ForeignKey(
        Test, on_delete=models.CASCADE,
        related_name='clone_records',
        help_text='Asl global test'
    )
    cloned_test = models.ForeignKey(
        Test, on_delete=models.CASCADE,
        related_name='+',
        help_text='Klon test (markaz bazasidagi nusxa)'
    )
    cloned_by = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True,
        related_name='+',
    )
    cloned_at = models.DateTimeField(auto_now_add=True)
```

### 1.5 Migration

```bash
cd backend
.venv/bin/python manage.py makemigrations tests
.venv/bin/python manage.py migrate
```

**Migration nima ko'rsatish kerak:**

- Test modeliga `module`, `difficulty`, `test_type`, `status`, `description`, `category`, `duration_minutes`, `created_by`, `published_at`, `cloned_from` qo'shildi
- Yangi modellar: `ListeningPart`, `Passage`, `WritingTask`, `TestClone`
- Question modeliga: `listening_part`, `passage`, `question_number`, `question_type`, `prompt`, `options`, `correct_answer`, `alt_answers`, `points` qo'shildi

**SINOV:**

```bash
.venv/bin/python -c "
from apps.tests.models import Test, ListeningPart, Passage, WritingTask, Question, TestClone
print('Test fields:', [f.name for f in Test._meta.get_fields() if not f.is_relation])
print('Existing Test count:', Test.objects.count())
print('Q types:', [c[0] for c in Question.QUESTION_TYPE_CHOICES])
"
```

Agar xato chiqsa — **shu yerda to'xtang va xatoni menga ayting.**

---

## 📦 QISM 2: BACKEND — Markaz admin API (90 daqiqa)

### 2.1 IsCenterAdmin permission

`apps/organizations/permissions.py` (yangi fayl):

```python
from rest_framework import permissions
from apps.organizations.models import OrganizationMembership


class IsCenterAdmin(permissions.BasePermission):
    """Faqat markaz admini ruxsat olishi mumkin (o'z markazi konteksida)"""

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.user.role == 'superadmin':
            return True

        # URL dan slug olamiz
        slug = view.kwargs.get('org_slug') or request.query_params.get('org')
        if not slug:
            return False

        return OrganizationMembership.objects.filter(
            user=request.user,
            organization__slug=slug,
            role__in=['admin', 'owner'],
            organization__status='active',
        ).exists()


class IsOrgMember(permissions.BasePermission):
    """Markazning istalgan a'zosi (admin/teacher/student)"""

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.user.role == 'superadmin':
            return True

        slug = view.kwargs.get('org_slug') or request.query_params.get('org')
        if not slug:
            return False

        return OrganizationMembership.objects.filter(
            user=request.user, organization__slug=slug,
            organization__status='active',
        ).exists()
```

### 2.2 Students ViewSet

`apps/center/` (yangi app):

```bash
cd backend
.venv/bin/python manage.py startapp center
mv center apps/
```

`apps/center/apps.py`:
```python
from django.apps import AppConfig

class CenterConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.center'
```

`config/settings.py` INSTALLED_APPS ga: `'apps.center',`

`apps/center/serializers.py`:

```python
from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.db import transaction
from apps.organizations.models import Organization, OrganizationMembership
import secrets
import string

User = get_user_model()


def generate_password(length=10):
    """Tasodifiy parol yaratish (oson eslab qoladigan, lekin xavfsiz)"""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))


class StudentReadSerializer(serializers.ModelSerializer):
    """O'qish uchun (jadval ko'rsatish)"""
    org_slug = serializers.SerializerMethodField()
    target_band = serializers.SerializerMethodField()
    tests_taken = serializers.SerializerMethodField()
    last_band = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'first_name', 'last_name', 'email',
            'is_active', 'date_joined',
            'org_slug', 'target_band', 'tests_taken', 'last_band'
        ]

    def get_org_slug(self, obj):
        m = OrganizationMembership.objects.filter(user=obj, role='student').first()
        return m.organization.slug if m else None

    def get_target_band(self, obj):
        # Agar StudentProfile bo'lsa undan
        return getattr(obj, 'student_profile', None) and obj.student_profile.target_band or None

    def get_tests_taken(self, obj):
        # Attempt jadvalidan
        from apps.tests.models import Attempt
        return Attempt.objects.filter(user=obj).count() if hasattr(obj, 'attempts') else 0

    def get_last_band(self, obj):
        # Eng oxirgi attempt dan
        return None  # ETAP 5 da to'ldiramiz


class StudentCreateSerializer(serializers.Serializer):
    """Yangi talaba yaratish"""
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    username = serializers.CharField(max_length=150)
    target_band = serializers.DecimalField(max_digits=2, decimal_places=1, required=False)
    teacher_id = serializers.IntegerField(required=False, allow_null=True)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError(f"Username '{value}' allaqachon mavjud")
        return value

    @transaction.atomic
    def create(self, validated_data):
        org = self.context['organization']
        password = validated_data.pop('password', None) or generate_password()
        teacher_id = validated_data.pop('teacher_id', None)
        target_band = validated_data.pop('target_band', None)

        user = User.objects.create_user(
            username=validated_data['username'],
            first_name=validated_data['first_name'],
            last_name=validated_data['last_name'],
            password=password,
            role='student',
            is_active=True,
        )

        OrganizationMembership.objects.create(
            user=user, organization=org, role='student'
        )

        # StudentProfile yaratish (agar model bor bo'lsa)
        # ETAP 2 da ixtiyoriy

        # Returnda parol ham
        user._generated_password = password
        return user


class TeacherReadSerializer(serializers.ModelSerializer):
    students_count = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email',
                  'is_active', 'date_joined', 'students_count']

    def get_students_count(self, obj):
        return 0  # ETAP da to'ldiramiz


class TeacherCreateSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError(f"Username '{value}' allaqachon mavjud")
        return value

    @transaction.atomic
    def create(self, validated_data):
        org = self.context['organization']
        password = validated_data.pop('password', None) or generate_password()

        user = User.objects.create_user(
            username=validated_data['username'],
            first_name=validated_data['first_name'],
            last_name=validated_data['last_name'],
            password=password,
            role='teacher',
            is_active=True,
        )

        OrganizationMembership.objects.create(
            user=user, organization=org, role='teacher'
        )

        user._generated_password = password
        return user
```

`apps/center/views.py`:

```python
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import NotFound, PermissionDenied
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.contrib.auth import get_user_model

from apps.organizations.models import Organization, OrganizationMembership
from apps.organizations.permissions import IsCenterAdmin
from .serializers import (
    StudentReadSerializer, StudentCreateSerializer,
    TeacherReadSerializer, TeacherCreateSerializer,
    generate_password,
)

User = get_user_model()


class CenterStudentViewSet(viewsets.ModelViewSet):
    """Markaz talabalari CRUD"""
    permission_classes = [permissions.IsAuthenticated, IsCenterAdmin]
    lookup_field = 'pk'

    def get_organization(self):
        slug = self.kwargs['org_slug']
        org = get_object_or_404(Organization, slug=slug, status='active')
        # Tekshirish: superadmin yoki shu org ning admini
        if self.request.user.role != 'superadmin':
            is_admin = OrganizationMembership.objects.filter(
                user=self.request.user, organization=org,
                role__in=['admin', 'owner']
            ).exists()
            if not is_admin:
                raise PermissionDenied('Siz bu markaz admini emassiz')
        return org

    def get_queryset(self):
        org = self.get_organization()
        return User.objects.filter(
            org_memberships__organization=org,
            org_memberships__role='student'
        ).distinct()

    def get_serializer_class(self):
        if self.action == 'create':
            return StudentCreateSerializer
        return StudentReadSerializer

    def create(self, request, *args, **kwargs):
        org = self.get_organization()
        ser = StudentCreateSerializer(data=request.data, context={'organization': org})
        ser.is_valid(raise_exception=True)
        student = ser.save()

        return Response({
            'student': StudentReadSerializer(student).data,
            'credentials': {
                'username': student.username,
                'password': student._generated_password,
                'login_url': f"/{org.slug}/login",
            }
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def reset_password(self, request, pk=None, **kwargs):
        student = self.get_object()
        new_pass = generate_password()
        student.set_password(new_pass)
        student.save()
        return Response({
            'username': student.username,
            'new_password': new_pass,
        })

    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None, **kwargs):
        student = self.get_object()
        student.is_active = False
        student.save()
        return Response({'detail': 'Talaba o\'chirildi (deactivated)'})


class CenterTeacherViewSet(viewsets.ModelViewSet):
    """Markaz ustozlari CRUD"""
    permission_classes = [permissions.IsAuthenticated, IsCenterAdmin]
    lookup_field = 'pk'

    def get_organization(self):
        slug = self.kwargs['org_slug']
        org = get_object_or_404(Organization, slug=slug, status='active')
        if self.request.user.role != 'superadmin':
            is_admin = OrganizationMembership.objects.filter(
                user=self.request.user, organization=org,
                role__in=['admin', 'owner']
            ).exists()
            if not is_admin:
                raise PermissionDenied('Siz bu markaz admini emassiz')
        return org

    def get_queryset(self):
        org = self.get_organization()
        return User.objects.filter(
            org_memberships__organization=org,
            org_memberships__role='teacher'
        ).distinct()

    def get_serializer_class(self):
        if self.action == 'create':
            return TeacherCreateSerializer
        return TeacherReadSerializer

    def create(self, request, *args, **kwargs):
        org = self.get_organization()
        ser = TeacherCreateSerializer(data=request.data, context={'organization': org})
        ser.is_valid(raise_exception=True)
        teacher = ser.save()

        return Response({
            'teacher': TeacherReadSerializer(teacher).data,
            'credentials': {
                'username': teacher.username,
                'password': teacher._generated_password,
                'login_url': f"/{org.slug}/login",
            }
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def reset_password(self, request, pk=None, **kwargs):
        teacher = self.get_object()
        new_pass = generate_password()
        teacher.set_password(new_pass)
        teacher.save()
        return Response({
            'username': teacher.username,
            'new_password': new_pass,
        })
```

### 2.3 URLs

`apps/center/urls.py`:

```python
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CenterStudentViewSet, CenterTeacherViewSet

router = DefaultRouter()
router.register('students', CenterStudentViewSet, basename='center-students')
router.register('teachers', CenterTeacherViewSet, basename='center-teachers')

urlpatterns = router.urls
```

`config/urls.py` ga qo'shing:

```python
# Markaz API: /api/v1/center/<slug>/students/, /teachers/, /tests/
path('api/v1/center/<slug:org_slug>/', include('apps.center.urls')),
```

### 2.4 SINOV (curl)

```bash
# Avval login qiling (taredu_admin)
curl -c /tmp/cookies.txt -X POST http://127.0.0.1:8000/api/v1/auth/login/ \
  -H 'Content-Type: application/json' \
  -d '{"username":"taredu_admin","password":"taredu2026"}'

# Talabalar ro'yxati (bo'sh bo'lishi kerak)
curl -b /tmp/cookies.txt http://127.0.0.1:8000/api/v1/center/taredu/students/

# Yangi talaba yaratish
curl -b /tmp/cookies.txt -X POST http://127.0.0.1:8000/api/v1/center/taredu/students/ \
  -H 'Content-Type: application/json' \
  -d '{
    "first_name": "Dilnoza",
    "last_name": "Rahimova",
    "username": "dilnoza_r",
    "target_band": 7.0
  }'

# Javobda parol bo'lishi kerak (avtomatik yaratilgan)
# Misol javob:
# {
#   "student": {...},
#   "credentials": {
#     "username": "dilnoza_r",
#     "password": "Xy7kP9aB2c",
#     "login_url": "/taredu/login"
#   }
# }

# Talabalar ro'yxati (1 ta bo'lishi kerak)
curl -b /tmp/cookies.txt http://127.0.0.1:8000/api/v1/center/taredu/students/

# Boshqa markazga kirib bo'lmasligini tekshirish
curl -b /tmp/cookies.txt http://127.0.0.1:8000/api/v1/center/brightedu/students/
# 403 Forbidden bo'lishi kerak
```

**Hammasi to'g'ri ishlasa — keyingi qismga o'tasiz. Aks holda — to'xtang.**

---


## 📦 QISM 3: BACKEND — Test CRUD + Audio yuklash (90 daqiqa)

### 3.1 mutagen kutubxonasi

```bash
cd backend
source .venv/bin/activate
pip install mutagen
pip freeze | grep -i mutagen
```

`requirements.txt` ga qo'shing:
```
mutagen>=1.47
```

### 3.2 Test serializerlari

`apps/tests/serializers.py` (mavjud bo'lsa kengaytiring, yo'q bo'lsa yarating):

```python
from rest_framework import serializers
from .models import Test, ListeningPart, Passage, WritingTask, Question


class QuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        fields = [
            'id', 'question_number', 'question_type',
            'prompt', 'options', 'correct_answer', 'alt_answers', 'points'
        ]


class ListeningPartSerializer(serializers.ModelSerializer):
    questions = QuestionSerializer(many=True, read_only=True)
    audio_url = serializers.SerializerMethodField()

    class Meta:
        model = ListeningPart
        fields = [
            'id', 'part_number',
            'audio_url', 'audio_duration_seconds', 'audio_bitrate_kbps', 'audio_size_bytes',
            'transcript', 'instructions', 'questions'
        ]
        read_only_fields = ['audio_url', 'audio_duration_seconds',
                            'audio_bitrate_kbps', 'audio_size_bytes']

    def get_audio_url(self, obj):
        if obj.audio_file:
            return obj.audio_file.url
        return None


class PassageSerializer(serializers.ModelSerializer):
    questions = QuestionSerializer(many=True, read_only=True)

    class Meta:
        model = Passage
        fields = ['id', 'section_number', 'title', 'subtitle',
                  'body_text', 'instructions', 'questions']


class WritingTaskSerializer(serializers.ModelSerializer):
    chart_image_url = serializers.SerializerMethodField()

    class Meta:
        model = WritingTask
        fields = ['id', 'task_number', 'prompt', 'chart_image_url',
                  'min_words', 'suggested_minutes', 'requirements']
        read_only_fields = ['chart_image_url']

    def get_chart_image_url(self, obj):
        return obj.chart_image.url if obj.chart_image else None


class TestListSerializer(serializers.ModelSerializer):
    """Ro'yxat ko'rsatish uchun (qisqa ma'lumot)"""
    questions_count = serializers.SerializerMethodField()
    is_cloned = serializers.SerializerMethodField()

    class Meta:
        model = Test
        fields = [
            'id', 'name', 'module', 'difficulty', 'test_type', 'status',
            'description', 'category', 'duration_minutes',
            'is_global', 'organization', 'cloned_from',
            'questions_count', 'is_cloned',
            'created_at', 'published_at',
        ]

    def get_questions_count(self, obj):
        if obj.module == 'listening':
            return Question.objects.filter(listening_part__test=obj).count()
        elif obj.module == 'reading':
            return Question.objects.filter(passage__test=obj).count()
        return 0

    def get_is_cloned(self, obj):
        return obj.cloned_from_id is not None


class TestDetailSerializer(serializers.ModelSerializer):
    """To'liq detali (parts/passages/tasks bilan)"""
    listening_parts = ListeningPartSerializer(many=True, read_only=True)
    passages = PassageSerializer(many=True, read_only=True)
    writing_tasks = WritingTaskSerializer(many=True, read_only=True)

    class Meta:
        model = Test
        fields = [
            'id', 'name', 'module', 'difficulty', 'test_type', 'status',
            'description', 'category', 'duration_minutes',
            'is_global', 'organization', 'cloned_from',
            'created_at', 'updated_at', 'published_at',
            'listening_parts', 'passages', 'writing_tasks',
        ]


class TestCreateSerializer(serializers.ModelSerializer):
    """Test yaratish (faqat metadata, parts keyin alohida API bilan)"""
    class Meta:
        model = Test
        fields = ['name', 'module', 'difficulty', 'test_type',
                  'description', 'category', 'duration_minutes']
```

### 3.3 SuperAdmin Test ViewSet

`apps/tests/views.py` (mavjud bo'lsa kengaytiring):

```python
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError, NotFound
from django.db import transaction
from django.shortcuts import get_object_or_404

from .models import Test, ListeningPart, Passage, WritingTask, Question, TestClone
from .serializers import (
    TestListSerializer, TestDetailSerializer, TestCreateSerializer,
    ListeningPartSerializer, PassageSerializer, WritingTaskSerializer,
    QuestionSerializer,
)
from apps.users.permissions import IsSuperAdmin  # mavjud bo'lsa
# Yoki shunday:
# class IsSuperAdmin(permissions.BasePermission):
#     def has_permission(self, request, view):
#         return request.user.is_authenticated and request.user.role == 'superadmin'


class SuperTestViewSet(viewsets.ModelViewSet):
    """SuperAdmin global test bazasini boshqarish"""
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]
    queryset = Test.objects.filter(is_global=True)

    def get_serializer_class(self):
        if self.action == 'create':
            return TestCreateSerializer
        if self.action in ['retrieve', 'detail']:
            return TestDetailSerializer
        return TestListSerializer

    def perform_create(self, serializer):
        serializer.save(
            is_global=True,
            organization=None,
            created_by=self.request.user,
            status='draft',
        )

    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        from django.utils import timezone
        test = self.get_object()
        test.status = 'published'
        test.published_at = timezone.now()
        test.save()
        return Response({'detail': 'Test e\'lon qilindi', 'status': 'published'})

    @action(detail=True, methods=['post'])
    def add_listening_part(self, request, pk=None):
        """Listening testga yangi part qo'shish"""
        test = self.get_object()
        if test.module not in ('listening', 'full_mock'):
            raise ValidationError("Faqat Listening testlarga part qo'shish mumkin")

        part_number = request.data.get('part_number')
        if not part_number:
            raise ValidationError({'part_number': 'Majburiy'})

        part, created = ListeningPart.objects.get_or_create(
            test=test, part_number=part_number,
            defaults={
                'transcript': request.data.get('transcript', ''),
                'instructions': request.data.get('instructions', ''),
            }
        )
        if not created:
            part.transcript = request.data.get('transcript', part.transcript)
            part.instructions = request.data.get('instructions', part.instructions)
            part.save()

        return Response(ListeningPartSerializer(part).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def add_passage(self, request, pk=None):
        """Reading testga passage qo'shish"""
        test = self.get_object()
        if test.module not in ('reading', 'full_mock'):
            raise ValidationError("Faqat Reading testlarga passage qo'shish mumkin")

        section_number = request.data.get('section_number')
        if not section_number:
            raise ValidationError({'section_number': 'Majburiy'})

        passage, created = Passage.objects.update_or_create(
            test=test, section_number=section_number,
            defaults={
                'title': request.data.get('title', ''),
                'subtitle': request.data.get('subtitle', ''),
                'body_text': request.data.get('body_text', ''),
                'instructions': request.data.get('instructions', ''),
            }
        )
        return Response(PassageSerializer(passage).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def add_writing_task(self, request, pk=None):
        """Writing testga task qo'shish"""
        test = self.get_object()
        if test.module not in ('writing', 'full_mock'):
            raise ValidationError("Faqat Writing testlarga task qo'shish mumkin")

        task_number = request.data.get('task_number')
        if not task_number:
            raise ValidationError({'task_number': 'Majburiy'})

        task, _ = WritingTask.objects.update_or_create(
            test=test, task_number=task_number,
            defaults={
                'prompt': request.data.get('prompt', ''),
                'min_words': request.data.get('min_words', 150 if task_number == 1 else 250),
                'suggested_minutes': request.data.get('suggested_minutes', 20 if task_number == 1 else 40),
                'requirements': request.data.get('requirements', ''),
            }
        )
        return Response(WritingTaskSerializer(task).data, status=status.HTTP_201_CREATED)


class ListeningPartDetailViewSet(viewsets.ModelViewSet):
    """ListeningPart bilan ishlash (audio yuklash, savollarni tahrirlash)"""
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]
    queryset = ListeningPart.objects.all()
    serializer_class = ListeningPartSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    @action(detail=True, methods=['post'], url_path='upload-audio')
    def upload_audio(self, request, pk=None):
        """Audio fayl yuklash + mutagen orqali metadata olish"""
        from mutagen import File as MutagenFile

        part = self.get_object()
        audio = request.FILES.get('audio')
        if not audio:
            raise ValidationError({'audio': 'Audio fayl yuklang'})

        # Saqlash
        part.audio_file = audio
        part.audio_size_bytes = audio.size
        part.save()  # Saqlangach mutagen bilan o'qiymiz

        # Mutagen orqali metadata
        try:
            audio_meta = MutagenFile(part.audio_file.path)
            if audio_meta and audio_meta.info:
                part.audio_duration_seconds = int(audio_meta.info.length)
                if hasattr(audio_meta.info, 'bitrate'):
                    part.audio_bitrate_kbps = int(audio_meta.info.bitrate / 1000)
                part.save()
        except Exception as e:
            # Metadata olib bo'lmasa, fayl saqlanadi lekin metadata 0
            print(f'Mutagen error: {e}')

        return Response(ListeningPartSerializer(part).data)

    @action(detail=True, methods=['post'], url_path='add-question')
    def add_question(self, request, pk=None):
        """Savol qo'shish"""
        part = self.get_object()
        data = request.data.copy()
        data['listening_part'] = part.id

        ser = QuestionSerializer(data=data)
        ser.is_valid(raise_exception=True)
        question = ser.save(listening_part=part)
        return Response(QuestionSerializer(question).data, status=status.HTTP_201_CREATED)


class PassageDetailViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]
    queryset = Passage.objects.all()
    serializer_class = PassageSerializer

    @action(detail=True, methods=['post'], url_path='add-question')
    def add_question(self, request, pk=None):
        passage = self.get_object()
        ser = QuestionSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        question = ser.save(passage=passage)
        return Response(QuestionSerializer(question).data, status=status.HTTP_201_CREATED)


class WritingTaskDetailViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]
    queryset = WritingTask.objects.all()
    serializer_class = WritingTaskSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    @action(detail=True, methods=['post'], url_path='upload-chart')
    def upload_chart(self, request, pk=None):
        """Task 1 uchun chart rasm yuklash"""
        task = self.get_object()
        if task.task_number != 1:
            raise ValidationError("Chart rasm faqat Task 1 uchun")

        image = request.FILES.get('image')
        if not image:
            raise ValidationError({'image': 'Rasm yuklang'})

        task.chart_image = image
        task.save()
        return Response(WritingTaskSerializer(task).data)


class QuestionDetailViewSet(viewsets.ModelViewSet):
    """Savolni tahrirlash/o'chirish"""
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]
    queryset = Question.objects.all()
    serializer_class = QuestionSerializer
```

### 3.4 Markaz testlari API (Mening testlarim + Klon)

`apps/center/tests_views.py` (yangi fayl):

```python
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from django.shortcuts import get_object_or_404
from django.db import transaction

from apps.organizations.models import Organization, OrganizationMembership
from apps.organizations.permissions import IsCenterAdmin
from apps.tests.models import Test, ListeningPart, Passage, WritingTask, Question, TestClone
from apps.tests.serializers import TestListSerializer, TestDetailSerializer


class CenterTestViewSet(viewsets.ModelViewSet):
    """Markaz testlari (Mening testlarim)"""
    permission_classes = [permissions.IsAuthenticated, IsCenterAdmin]

    def get_organization(self):
        slug = self.kwargs['org_slug']
        org = get_object_or_404(Organization, slug=slug, status='active')
        if self.request.user.role != 'superadmin':
            if not OrganizationMembership.objects.filter(
                user=self.request.user, organization=org,
                role__in=['admin', 'owner']
            ).exists():
                raise PermissionDenied()
        return org

    def get_queryset(self):
        org = self.get_organization()
        return Test.objects.filter(organization=org)

    def get_serializer_class(self):
        return TestDetailSerializer if self.action == 'retrieve' else TestListSerializer

    @action(detail=False, methods=['get'], url_path='global-catalog')
    def global_catalog(self, request, org_slug=None):
        """SuperAdmin yaratgan barcha published global testlar"""
        global_tests = Test.objects.filter(is_global=True, status='published')

        # Modul/qiyinlik filtrlash
        module = request.query_params.get('module')
        if module:
            global_tests = global_tests.filter(module=module)
        difficulty = request.query_params.get('difficulty')
        if difficulty:
            global_tests = global_tests.filter(difficulty=difficulty)

        return Response(TestListSerializer(global_tests, many=True).data)

    @action(detail=False, methods=['post'], url_path='clone-from-global/(?P<global_id>[^/.]+)')
    @transaction.atomic
    def clone_from_global(self, request, org_slug=None, global_id=None):
        """Global testni o'z markaziga nusxalash (chuqur kopyalash)"""
        org = self.get_organization()
        source = get_object_or_404(Test, id=global_id, is_global=True, status='published')

        # Allaqachon klon qilinganmi?
        existing = Test.objects.filter(
            organization=org, cloned_from=source
        ).first()
        if existing:
            return Response(
                {'detail': 'Bu test allaqachon nusxalangan',
                 'test_id': existing.id},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Test asosiy ma'lumot
        clone = Test.objects.create(
            name=source.name,
            module=source.module,
            difficulty=source.difficulty,
            test_type=source.test_type,
            description=source.description,
            category=source.category,
            duration_minutes=source.duration_minutes,
            organization=org,
            is_global=False,
            cloned_from=source,
            created_by=request.user,
            status='published',  # avtomatik publish
            published_at=source.published_at,
        )

        # ListeningPart va savollar
        for src_part in source.listening_parts.all():
            new_part = ListeningPart.objects.create(
                test=clone,
                part_number=src_part.part_number,
                audio_file=src_part.audio_file,  # Reference to same file
                audio_duration_seconds=src_part.audio_duration_seconds,
                audio_bitrate_kbps=src_part.audio_bitrate_kbps,
                audio_size_bytes=src_part.audio_size_bytes,
                transcript=src_part.transcript,
                instructions=src_part.instructions,
            )
            for src_q in src_part.questions.all():
                Question.objects.create(
                    listening_part=new_part,
                    question_number=src_q.question_number,
                    question_type=src_q.question_type,
                    prompt=src_q.prompt,
                    options=src_q.options,
                    correct_answer=src_q.correct_answer,
                    alt_answers=src_q.alt_answers,
                    points=src_q.points,
                )

        # Passage va savollar
        for src_passage in source.passages.all():
            new_passage = Passage.objects.create(
                test=clone,
                section_number=src_passage.section_number,
                title=src_passage.title,
                subtitle=src_passage.subtitle,
                body_text=src_passage.body_text,
                instructions=src_passage.instructions,
            )
            for src_q in src_passage.questions.all():
                Question.objects.create(
                    passage=new_passage,
                    question_number=src_q.question_number,
                    question_type=src_q.question_type,
                    prompt=src_q.prompt,
                    options=src_q.options,
                    correct_answer=src_q.correct_answer,
                    alt_answers=src_q.alt_answers,
                    points=src_q.points,
                )

        # Writing tasks
        for src_task in source.writing_tasks.all():
            WritingTask.objects.create(
                test=clone,
                task_number=src_task.task_number,
                prompt=src_task.prompt,
                chart_image=src_task.chart_image,
                min_words=src_task.min_words,
                suggested_minutes=src_task.suggested_minutes,
                requirements=src_task.requirements,
            )

        # Audit
        TestClone.objects.create(
            organization=org,
            source_test=source,
            cloned_test=clone,
            cloned_by=request.user,
        )

        return Response(
            TestDetailSerializer(clone).data,
            status=status.HTTP_201_CREATED
        )
```

### 3.5 URLs

`apps/tests/urls.py` (yangilang yoki yarating):

```python
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    SuperTestViewSet, ListeningPartDetailViewSet,
    PassageDetailViewSet, WritingTaskDetailViewSet, QuestionDetailViewSet,
)

router = DefaultRouter()
router.register('super/tests', SuperTestViewSet, basename='super-tests')
router.register('super/listening-parts', ListeningPartDetailViewSet, basename='super-listening-parts')
router.register('super/passages', PassageDetailViewSet, basename='super-passages')
router.register('super/writing-tasks', WritingTaskDetailViewSet, basename='super-writing-tasks')
router.register('super/questions', QuestionDetailViewSet, basename='super-questions')

urlpatterns = router.urls
```

`apps/center/urls.py` ga qo'shing:

```python
from .tests_views import CenterTestViewSet
router.register('tests', CenterTestViewSet, basename='center-tests')
```

`config/urls.py`:

```python
path('api/v1/', include('apps.tests.urls')),  # /api/v1/super/tests/
path('api/v1/center/<slug:org_slug>/', include('apps.center.urls')),
```

### 3.6 SINOV (curl) — to'liq scenario

```bash
# 1. SuperAdmin login
curl -c /tmp/cookies.txt -X POST http://127.0.0.1:8000/api/v1/auth/login/ \
  -H 'Content-Type: application/json' \
  -d '{"username":"jasmina","password":"jasmina"}'

# 2. Yangi Listening test yaratish
curl -b /tmp/cookies.txt -X POST http://127.0.0.1:8000/api/v1/super/tests/ \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Cambridge IELTS 19 — Test 2",
    "module": "listening",
    "difficulty": "medium",
    "test_type": "academic",
    "description": "Cambridge 19, Test 2",
    "category": "Cambridge seriyasi",
    "duration_minutes": 30
  }'
# Javobdan id ni eslab qoling: TEST_ID

# 3. Part 1 qo'shish
curl -b /tmp/cookies.txt -X POST http://127.0.0.1:8000/api/v1/super/tests/<TEST_ID>/add_listening_part/ \
  -H 'Content-Type: application/json' \
  -d '{
    "part_number": 1,
    "instructions": "Listen and answer questions 1-10",
    "transcript": "Hello, my name is Sarah..."
  }'
# Javobdan part id ni eslang: PART_ID

# 4. Audio yuklash (test uchun bo'sh fayl yarating)
echo "test audio" > /tmp/test_audio.mp3
curl -b /tmp/cookies.txt -X POST \
  http://127.0.0.1:8000/api/v1/super/listening-parts/<PART_ID>/upload-audio/ \
  -F 'audio=@/tmp/test_audio.mp3'

# 5. Savol qo'shish (MCQ)
curl -b /tmp/cookies.txt -X POST \
  http://127.0.0.1:8000/api/v1/super/listening-parts/<PART_ID>/add-question/ \
  -H 'Content-Type: application/json' \
  -d '{
    "question_number": 1,
    "question_type": "mcq",
    "prompt": "What is Sarah looking for?",
    "options": {"choices": ["A. Apartment", "B. House", "C. Room", "D. Dorm"]},
    "correct_answer": {"value": "B"},
    "points": 1
  }'

# 6. Test publish
curl -b /tmp/cookies.txt -X POST http://127.0.0.1:8000/api/v1/super/tests/<TEST_ID>/publish/

# 7. Marka admin login
curl -c /tmp/cookies_admin.txt -X POST http://127.0.0.1:8000/api/v1/auth/login/ \
  -H 'Content-Type: application/json' \
  -d '{"username":"taredu_admin","password":"taredu2026"}'

# 8. Global katalog ko'rish
curl -b /tmp/cookies_admin.txt \
  http://127.0.0.1:8000/api/v1/center/taredu/tests/global-catalog/

# 9. Klon qilish
curl -b /tmp/cookies_admin.txt -X POST \
  http://127.0.0.1:8000/api/v1/center/taredu/tests/clone-from-global/<TEST_ID>/

# 10. Mening testlarim (1 ta klon bo'lishi kerak)
curl -b /tmp/cookies_admin.txt http://127.0.0.1:8000/api/v1/center/taredu/tests/

# 11. Ikkinchi marta klon — xatolik bo'lishi kerak (allaqachon klon qilingan)
curl -b /tmp/cookies_admin.txt -X POST \
  http://127.0.0.1:8000/api/v1/center/taredu/tests/clone-from-global/<TEST_ID>/
# 400 Bad Request bo'lishi kerak
```

**Hammasi to'g'ri bo'lsagina keyingi qismga o'ting.**

---


## 🎨 QISM 4: FRONTEND — Markaz admin layout (45 daqiqa)

### 4.1 Routes

`frontend/src/App.tsx` ga qo'shing (mavjud routes orasiga):

```tsx
// Markaz admin paneli
<Route path="/:slug/admin" element={<RequireCenterAdmin />}>
  <Route element={<CenterAdminLayout />}>
    <Route index element={<CenterDashboard />} />
    <Route path="students" element={<StudentsPage />} />
    <Route path="teachers" element={<TeachersPage />} />
    <Route path="tests" element={<TestsPage />} />
    <Route path="settings" element={<CenterSettings />} />
  </Route>
</Route>
```

### 4.2 RequireCenterAdmin guard

`frontend/src/components/guards/RequireCenterAdmin.tsx`:

```tsx
import { Navigate, Outlet, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export function RequireCenterAdmin() {
  const { slug } = useParams();
  const { user, loading } = useAuth();
  const [isMember, setIsMember] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user || !slug) return;
    if (user.role === 'superadmin') {
      setIsMember(true);
      return;
    }
    api.get(`/center/${slug}/students/`)
      .then(() => setIsMember(true))
      .catch(() => setIsMember(false));
  }, [user, slug]);

  if (loading || isMember === null) return <div>Yuklanmoqda...</div>;
  if (!user) return <Navigate to={`/${slug}/login`} replace />;
  if (!isMember) return <Navigate to="/" replace />;

  return <Outlet />;
}
```

### 4.3 CenterAdminLayout

`frontend/src/layouts/CenterAdminLayout.tsx`:

```tsx
import { NavLink, Outlet, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface OrgInfo {
  slug: string;
  name: string;
  logo?: string;
  primary_color?: string;
}

export function CenterAdminLayout() {
  const { slug } = useParams();
  const [org, setOrg] = useState<OrgInfo | null>(null);

  useEffect(() => {
    api.get(`/public/orgs/${slug}/`)
      .then(r => setOrg(r.data));
  }, [slug]);

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* SIDEBAR */}
      <aside className="w-64 bg-slate-900 text-white p-6 flex flex-col sticky top-0 h-screen">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-full bg-orange-500 flex items-center justify-center font-bold">
            ✕
          </div>
          <div>
            <div className="font-semibold">ILDIZmock</div>
            <div className="text-xs text-orange-400">{org?.name}</div>
          </div>
        </div>

        <nav className="space-y-1 text-sm flex-1">
          <NavLink to={`/${slug}/admin`} end className={navItemClass}>
            🏠 Bosh sahifa
          </NavLink>
          <NavLink to={`/${slug}/admin/students`} className={navItemClass}>
            👨‍🎓 Talabalar
          </NavLink>
          <NavLink to={`/${slug}/admin/teachers`} className={navItemClass}>
            👨‍🏫 Ustozlar
          </NavLink>
          <NavLink to={`/${slug}/admin/tests`} className={navItemClass}>
            📚 Testlar
          </NavLink>
          <NavLink to={`/${slug}/admin/settings`} className={navItemClass}>
            ⚙️ Sozlamalar
          </NavLink>
        </nav>

        <div className="pt-4 border-t border-white/10 text-xs text-white/50">
          Markaz: {slug}
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 p-8 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}

function navItemClass({ isActive }: { isActive: boolean }) {
  return `flex items-center gap-3 px-4 py-2.5 rounded-full transition ${
    isActive ? 'bg-white text-slate-900' : 'hover:bg-white/5'
  }`;
}
```

### 4.4 Dashboard

`frontend/src/pages/center/CenterDashboard.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '@/lib/api';

export function CenterDashboard() {
  const { slug } = useParams();
  const [stats, setStats] = useState({
    students: 0,
    teachers: 0,
    tests: 0,
  });

  useEffect(() => {
    Promise.all([
      api.get(`/center/${slug}/students/`),
      api.get(`/center/${slug}/teachers/`),
      api.get(`/center/${slug}/tests/`),
    ]).then(([s, t, te]) => {
      setStats({
        students: s.data.length || s.data.count || 0,
        teachers: t.data.length || t.data.count || 0,
        tests: te.data.length || te.data.count || 0,
      });
    });
  }, [slug]);

  return (
    <div>
      <h1 className="text-3xl font-light mb-6">Bosh sahifa</h1>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Talabalar" value={stats.students} />
        <StatCard label="Ustozlar" value={stats.teachers} />
        <StatCard label="Testlar" value={stats.tests} />
      </div>

      <div className="bg-white rounded-2xl p-6 border">
        <h2 className="text-lg font-semibold mb-4">Tezkor amallar</h2>
        <div className="flex gap-3">
          <a href={`/${slug}/admin/students`} className="px-4 py-2 bg-slate-900 text-white rounded-full text-sm">
            + Talaba qo'shish
          </a>
          <a href={`/${slug}/admin/tests`} className="px-4 py-2 border rounded-full text-sm">
            Global katalogni ko'rish
          </a>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-2xl p-6 border">
      <div className="text-xs uppercase tracking-widest text-slate-500 mb-2">{label}</div>
      <div className="text-5xl font-light">{value}</div>
    </div>
  );
}
```

---

## 🎨 QISM 5: FRONTEND — Talabalar/Ustozlar sahifasi (60 daqiqa)

### 5.1 StudentsPage

`frontend/src/pages/center/StudentsPage.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { CredentialsModal } from '@/components/center/CredentialsModal';

interface Student {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  target_band: number | null;
  tests_taken: number;
  date_joined: string;
}

export function StudentsPage() {
  const { slug } = useParams();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [credentials, setCredentials] = useState<any>(null);

  const load = () => {
    setLoading(true);
    api.get(`/center/${slug}/students/`)
      .then(r => setStudents(r.data))
      .finally(() => setLoading(false));
  };

  useEffect(load, [slug]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-light">Talabalar</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="px-5 py-2.5 bg-slate-900 text-white rounded-full text-sm font-semibold hover:bg-slate-800"
        >
          + Yangi talaba
        </button>
      </div>

      <div className="bg-white rounded-2xl border overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b">
            <tr className="text-left text-xs uppercase tracking-widest text-slate-500">
              <th className="p-4">Ism</th>
              <th className="p-4">Login</th>
              <th className="p-4">Maqsad</th>
              <th className="p-4">Testlar</th>
              <th className="p-4">Holat</th>
              <th className="p-4">Amal</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="p-6 text-center text-slate-400">Yuklanmoqda...</td></tr>
            ) : students.length === 0 ? (
              <tr><td colSpan={6} className="p-6 text-center text-slate-400">Hali talaba yo'q. "+ Yangi talaba" tugmasini bosing.</td></tr>
            ) : students.map(s => (
              <tr key={s.id} className="border-b hover:bg-slate-50">
                <td className="p-4 font-medium">{s.first_name} {s.last_name}</td>
                <td className="p-4 text-slate-600 font-mono text-sm">{s.username}</td>
                <td className="p-4">{s.target_band ? `Band ${s.target_band}` : '—'}</td>
                <td className="p-4">{s.tests_taken || 0}</td>
                <td className="p-4">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    s.is_active ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {s.is_active ? 'Faol' : 'O\'chirilgan'}
                  </span>
                </td>
                <td className="p-4">
                  <button
                    className="text-sm text-orange-600 hover:underline mr-3"
                    onClick={() => resetPassword(slug!, s.id, setCredentials)}
                  >
                    Parolni tiklash
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <AddStudentModal
          slug={slug!}
          onClose={() => setShowAdd(false)}
          onCreated={(creds) => {
            setShowAdd(false);
            setCredentials(creds);
            load();
          }}
        />
      )}

      {credentials && (
        <CredentialsModal
          credentials={credentials}
          onClose={() => setCredentials(null)}
        />
      )}
    </div>
  );
}

async function resetPassword(slug: string, id: number, setCredentials: any) {
  if (!confirm("Parolni tiklamoqchimisiz?")) return;
  const r = await api.post(`/center/${slug}/students/${id}/reset_password/`);
  setCredentials({ ...r.data, login_url: `/${slug}/login` });
}

function AddStudentModal({ slug, onClose, onCreated }: any) {
  const [form, setForm] = useState({
    first_name: '', last_name: '', username: '', target_band: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const payload: any = {
        first_name: form.first_name,
        last_name: form.last_name,
        username: form.username,
      };
      if (form.target_band) payload.target_band = parseFloat(form.target_band);

      const r = await api.post(`/center/${slug}/students/`, payload);
      onCreated(r.data.credentials);
    } catch (e: any) {
      setError(e.response?.data?.username?.[0] || 'Xatolik yuz berdi');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">Yangi talaba</h2>

        <div className="space-y-3">
          <Input label="Ism" value={form.first_name}
            onChange={(v) => setForm({ ...form, first_name: v })} />
          <Input label="Familiya" value={form.last_name}
            onChange={(v) => setForm({ ...form, last_name: v })} />
          <Input label="Login (username)" value={form.username}
            onChange={(v) => setForm({ ...form, username: v })}
            hint="Faqat lotin harflari va raqamlar" />
          <Input label="Maqsad band (ixtiyoriy)" value={form.target_band}
            onChange={(v) => setForm({ ...form, target_band: v })}
            placeholder="masalan: 7.0" />
        </div>

        {error && <div className="text-red-600 text-sm mt-3">{error}</div>}

        <div className="text-xs text-slate-500 mt-4 bg-slate-50 p-3 rounded-lg">
          💡 Parol avtomatik yaratiladi va keyingi ekranda ko'rsatiladi. Eslab qoling, talabaga bering.
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 border rounded-full text-sm">
            Bekor qilish
          </button>
          <button onClick={submit} disabled={submitting}
            className="flex-1 py-2.5 bg-slate-900 text-white rounded-full text-sm font-semibold disabled:opacity-50">
            {submitting ? 'Saqlanmoqda...' : 'Saqlash va parol olish'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, hint, placeholder }: any) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
        {label}
      </label>
      <input value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-2 border rounded-lg focus:border-slate-900 outline-none" />
      {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
    </div>
  );
}
```

### 5.2 CredentialsModal

`frontend/src/components/center/CredentialsModal.tsx`:

```tsx
import { useState } from 'react';

interface Props {
  credentials: {
    username: string;
    password?: string;
    new_password?: string;
    login_url: string;
  };
  onClose: () => void;
}

export function CredentialsModal({ credentials, onClose }: Props) {
  const [copied, setCopied] = useState('');
  const password = credentials.password || credentials.new_password || '';

  const copy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(''), 1500);
  };

  const copyAll = () => {
    const text = `Login: ${credentials.username}\nParol: ${password}\nURL: ${window.location.origin}${credentials.login_url}`;
    copy(text, 'all');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">✓</div>
          <h2 className="text-xl font-semibold">Hisob ma'lumotlari</h2>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 font-mono text-sm">
          <Row label="Login" value={credentials.username}
            onCopy={() => copy(credentials.username, 'login')} copied={copied === 'login'} />
          <Row label="Parol" value={password}
            onCopy={() => copy(password, 'pass')} copied={copied === 'pass'} />
          <Row label="URL" value={`${window.location.origin}${credentials.login_url}`}
            onCopy={() => copy(`${window.location.origin}${credentials.login_url}`, 'url')}
            copied={copied === 'url'} />
        </div>

        <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 mt-4 text-sm">
          ⚠️ <strong>Diqqat:</strong> Parol bu yerda faqat bir marta ko'rsatiladi. Eslab qolish yoki nusxa olish uchun yuqoridagi tugmalardan foydalaning.
        </div>

        <button onClick={copyAll}
          className="w-full mt-4 py-2.5 border rounded-full text-sm font-semibold hover:bg-slate-50">
          {copied === 'all' ? '✓ Nusxalandi!' : '📋 Hammasini nusxalash'}
        </button>

        <button onClick={onClose}
          className="w-full mt-2 py-2.5 bg-slate-900 text-white rounded-full text-sm font-semibold">
          Yopish
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, onCopy, copied }: any) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
        <div className="text-slate-900">{value}</div>
      </div>
      <button onClick={onCopy}
        className="text-xs px-3 py-1 border rounded-full hover:bg-white">
        {copied ? '✓ Nusxalandi' : 'Nusxalash'}
      </button>
    </div>
  );
}
```

### 5.3 TeachersPage

Xuddi StudentsPage kabi, lekin `target_band` o'rniga `students_count` ko'rsatadi va `/teachers/` endpoint dan foydalanadi. **Faqat copy-paste qiling, Student → Teacher ga o'zgartiring.**

---


## 🎨 QISM 6: FRONTEND — Tests sahifasi (45 daqiqa)

### Dizayn ma'lumotnomasi (Band9 prototypedan)

Bu sahifa dizayni `band9/admin.html` va `band9/admin-add-test.html` da ko'rsatilgan. Ma'lumot uchun u yerga qarang. Lekin **bizda** Tailwind shadcn ishlatilmoqda — band9 dagi style HTML emas, balki tailwind classes orqali kerak.

### 6.1 TestsPage

`frontend/src/pages/center/TestsPage.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '@/lib/api';

interface Test {
  id: number;
  name: string;
  module: string;
  difficulty: string;
  test_type: string;
  status: string;
  category: string;
  duration_minutes: number;
  is_global: boolean;
  cloned_from: number | null;
  is_cloned: boolean;
  questions_count: number;
}

type Tab = 'mine' | 'global';

export function TestsPage() {
  const { slug } = useParams();
  const [tab, setTab] = useState<Tab>('mine');
  const [myTests, setMyTests] = useState<Test[]>([]);
  const [globalTests, setGlobalTests] = useState<Test[]>([]);
  const [filter, setFilter] = useState({ module: '', difficulty: '' });

  const load = () => {
    api.get(`/center/${slug}/tests/`).then(r => setMyTests(r.data));

    const params = new URLSearchParams();
    if (filter.module) params.set('module', filter.module);
    if (filter.difficulty) params.set('difficulty', filter.difficulty);
    api.get(`/center/${slug}/tests/global-catalog/?${params.toString()}`)
      .then(r => setGlobalTests(r.data));
  };

  useEffect(load, [slug, filter]);

  const clone = async (testId: number, testName: string) => {
    if (!confirm(`"${testName}" testini o'z bazangizga qo'shasizmi?`)) return;
    try {
      await api.post(`/center/${slug}/tests/clone-from-global/${testId}/`);
      alert('Test bazaga qo\'shildi!');
      setTab('mine');
      load();
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Xatolik');
    }
  };

  const list = tab === 'mine' ? myTests : globalTests;

  return (
    <div>
      <h1 className="text-3xl font-light mb-6">Testlar</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b">
        <button onClick={() => setTab('mine')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition ${
            tab === 'mine' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500'
          }`}>
          📁 Mening testlarim ({myTests.length})
        </button>
        <button onClick={() => setTab('global')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition ${
            tab === 'global' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500'
          }`}>
          🌍 Global katalog ({globalTests.length})
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <select value={filter.module} onChange={e => setFilter({ ...filter, module: e.target.value })}
          className="px-4 py-2 border rounded-full text-sm">
          <option value="">Barcha modullar</option>
          <option value="listening">Listening</option>
          <option value="reading">Reading</option>
          <option value="writing">Writing</option>
          <option value="full_mock">To'liq mock</option>
        </select>
        <select value={filter.difficulty} onChange={e => setFilter({ ...filter, difficulty: e.target.value })}
          className="px-4 py-2 border rounded-full text-sm">
          <option value="">Barcha darajalar</option>
          <option value="easy">Oson</option>
          <option value="medium">O'rtacha</option>
          <option value="hard">Qiyin</option>
        </select>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-3 gap-4">
        {list.length === 0 ? (
          <div className="col-span-3 bg-white rounded-2xl border p-12 text-center text-slate-500">
            {tab === 'mine'
              ? 'Hali test yo\'q. Global katalogdan tanlang yoki yangi yarating.'
              : 'Global katalogda test topilmadi. Filterni o\'zgartiring.'}
          </div>
        ) : list.map(test => (
          <TestCard key={test.id} test={test}
            isGlobal={tab === 'global'}
            onClone={() => clone(test.id, test.name)} />
        ))}
      </div>
    </div>
  );
}

function TestCard({ test, isGlobal, onClone }: any) {
  const moduleColors: any = {
    listening: 'bg-orange-100 text-orange-700',
    reading: 'bg-blue-100 text-blue-700',
    writing: 'bg-purple-100 text-purple-700',
    full_mock: 'bg-slate-900 text-white',
  };
  const diffLabel: any = { easy: 'Oson', medium: "O'rtacha", hard: 'Qiyin' };

  return (
    <div className="bg-white rounded-2xl p-5 border hover:shadow-lg transition">
      <div className="flex justify-between mb-4">
        <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${moduleColors[test.module] || 'bg-slate-100'}`}>
          {test.module === 'full_mock' ? 'Full Mock' : test.module}
        </span>
        <span className="text-xs text-slate-500">{test.duration_minutes} min</span>
      </div>

      <h3 className="font-semibold text-lg mb-1">{test.name}</h3>
      <p className="text-sm text-slate-500 mb-4">
        {test.category || '—'} · {diffLabel[test.difficulty]} · {test.questions_count} savol
      </p>

      <div className="flex justify-between items-center">
        <span className={`text-xs ${test.status === 'published' ? 'text-green-600' : 'text-slate-400'}`}>
          {test.status === 'published' ? '✓ E\'lon qilingan' : 'Qoralama'}
        </span>

        {isGlobal ? (
          <button onClick={onClone}
            className="text-sm font-semibold text-orange-600 hover:underline">
            + Bazaga qo'shish
          </button>
        ) : (
          <button className="text-sm font-semibold text-slate-700 hover:underline">
            Ko'rish →
          </button>
        )}
      </div>
    </div>
  );
}
```

---

## 🎨 QISM 7: FRONTEND — SuperAdmin Test Yaratish Wizardi (90 daqiqa)

### Dizayn manbai

Bu wizard `/home/claude/band9/admin-add-test.html` faylida prototip qilingan. **Avval o'sha faylni ochib ko'ring** — 5 qadamli forma, stepper, type cards, upload zone, savol turlari pillalar — hammasi shu yerda.

Bizning vazifa: shu dizaynni Tailwind + React komponentlarga o'tkazish.

### 7.1 Routes

`App.tsx`:

```tsx
<Route path="/super/tests" element={<RequireSuperAdmin />}>
  <Route index element={<SuperTestsListPage />} />
  <Route path="new" element={<TestWizardPage />} />
  <Route path=":id/edit" element={<TestWizardPage />} />
</Route>
```

### 7.2 SuperTestsListPage

`frontend/src/pages/super/SuperTestsListPage.tsx`:

```tsx
// Sodda — testlar ro'yxati + "+ Yangi test" tugmasi
// Code: TestsPage ga o'xshash, lekin /super/tests/ endpoint
// Va "Yangi test" tugmasi /super/tests/new ga olib boradi
```

### 7.3 TestWizardPage

`frontend/src/pages/super/TestWizardPage.tsx`:

```tsx
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { Step1Type } from '@/components/wizard/Step1Type';
import { Step2Metadata } from '@/components/wizard/Step2Metadata';
import { Step3Content } from '@/components/wizard/Step3Content';
import { Step4Questions } from '@/components/wizard/Step4Questions';
import { Step5Review } from '@/components/wizard/Step5Review';
import { Stepper } from '@/components/wizard/Stepper';

export function TestWizardPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [step, setStep] = useState(1);
  const [testId, setTestId] = useState<number | null>(id ? +id : null);

  const [data, setData] = useState({
    module: 'listening' as 'listening' | 'reading' | 'writing' | 'full_mock',
    name: '',
    difficulty: 'medium',
    test_type: 'academic',
    description: '',
    category: '',
    duration_minutes: 30,
  });

  const next = () => setStep(s => Math.min(5, s + 1));
  const back = () => setStep(s => Math.max(1, s - 1));

  // Step 2 dan keyin: testni yaratish (faqat metadata)
  const createOrUpdate = async () => {
    if (!testId) {
      const r = await api.post('/super/tests/', data);
      setTestId(r.data.id);
    } else {
      await api.put(`/super/tests/${testId}/`, data);
    }
    next();
  };

  const publish = async () => {
    if (!testId) return;
    await api.post(`/super/tests/${testId}/publish/`);
    navigate('/super/tests');
  };

  return (
    <div className="max-w-7xl mx-auto p-8">
      <header className="mb-6">
        <div className="text-xs uppercase tracking-widest text-slate-500 mb-2">
          <a href="/super/tests" className="hover:text-orange-600">Testlar</a> / Yangi
        </div>
        <h1 className="text-4xl font-light">Yangi test <em className="italic text-orange-600">yaratish.</em></h1>
      </header>

      <Stepper currentStep={step} />

      <div className="grid grid-cols-3 gap-6 mt-6">
        <div className="col-span-2 space-y-6">
          {step === 1 && <Step1Type data={data} setData={setData} />}
          {step === 2 && <Step2Metadata data={data} setData={setData} />}
          {step === 3 && testId && <Step3Content testId={testId} module={data.module} />}
          {step === 4 && testId && <Step4Questions testId={testId} module={data.module} />}
          {step === 5 && testId && <Step5Review testId={testId} />}

          <div className="flex justify-between">
            <button onClick={back} disabled={step === 1}
              className="px-6 py-2.5 border rounded-full text-sm disabled:opacity-30">
              ← Orqaga
            </button>
            {step === 2 ? (
              <button onClick={createOrUpdate} className="px-6 py-2.5 bg-slate-900 text-white rounded-full text-sm">
                Saqlash va davom →
              </button>
            ) : step === 5 ? (
              <button onClick={publish} className="px-6 py-2.5 bg-orange-600 text-white rounded-full text-sm">
                E'lon qilish ✓
              </button>
            ) : (
              <button onClick={next} className="px-6 py-2.5 bg-slate-900 text-white rounded-full text-sm">
                Keyingisi →
              </button>
            )}
          </div>
        </div>

        {/* Sidebar — checklist va preview */}
        <div className="col-span-1">
          <div className="bg-white rounded-2xl border p-6 sticky top-6">
            <div className="text-xs uppercase tracking-widest text-slate-500 mb-4">
              Tekshirish ro'yxati
            </div>
            <ChecklistItem done={step > 1} active={step === 1}>Test turi</ChecklistItem>
            <ChecklistItem done={step > 2} active={step === 2}>Ma'lumotlar</ChecklistItem>
            <ChecklistItem done={step > 3} active={step === 3}>Kontent</ChecklistItem>
            <ChecklistItem done={step > 4} active={step === 4}>Savollar</ChecklistItem>
            <ChecklistItem done={false} active={step === 5}>E'lon qilish</ChecklistItem>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChecklistItem({ children, done, active }: any) {
  return (
    <div className={`flex items-center gap-2 py-2 text-sm ${
      done ? 'text-green-600' : active ? 'text-orange-600 font-semibold' : 'text-slate-400'
    }`}>
      <div className="w-5 h-5 rounded-full border flex items-center justify-center text-xs">
        {done ? '✓' : active ? '●' : '○'}
      </div>
      {children}
    </div>
  );
}
```

### 7.4 Step1Type — Test turi

`frontend/src/components/wizard/Step1Type.tsx`:

```tsx
const TYPES = [
  { id: 'listening', label: 'Listening', icon: '🎧', meta: '30 min, 4 part, 40 savol' },
  { id: 'reading', label: 'Reading', icon: '📖', meta: '60 min, 3 passage, 40 savol' },
  { id: 'writing', label: 'Writing', icon: '✍️', meta: '60 min, 2 task' },
  { id: 'full_mock', label: 'To\'liq mock', icon: '📋', meta: '2s 30m, hammasi' },
];

export function Step1Type({ data, setData }: any) {
  return (
    <div className="bg-white rounded-2xl p-8 border">
      <div className="text-xs uppercase tracking-widest text-orange-600 mb-1">Qadam 1</div>
      <h2 className="text-2xl mb-6">Test turini tanlang</h2>

      <div className="grid grid-cols-2 gap-3">
        {TYPES.map(t => (
          <button key={t.id} onClick={() => setData({ ...data, module: t.id })}
            className={`text-left p-5 rounded-xl border-2 transition ${
              data.module === t.id
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 hover:border-orange-500'
            }`}>
            <div className="text-3xl mb-2">{t.icon}</div>
            <div className="font-semibold mb-1">{t.label}</div>
            <div className={`text-xs ${data.module === t.id ? 'text-orange-300' : 'text-slate-500'}`}>
              {t.meta}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
```

### 7.5 Step2Metadata, Step3Content, Step4Questions

Bu komponentlarni siz **band9/admin-add-test.html** dizaynidan ilhomlanib yozasiz. Asosiy nuqtalar:

**Step2Metadata** — oddiy forma (name, difficulty, type, duration, description, category)

**Step3Content** — modulga qarab tab ko'rinishi:
- Listening: Part 1, 2, 3, 4 tab → har birida audio upload + transcript textarea
- Reading: Section 1, 2, 3 tab → har birida title + body_text (paragraflar)
- Writing: Task 1, Task 2 tab → prompt + chart_image (Task 1 uchun) + min_words

**Step4Questions** — interaktiv savol editor (asosiy qism, eng ko'p ishni talab qiladi)

### 7.6 Step4Questions — Question Editor

`frontend/src/components/wizard/Step4Questions.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { McqEditor } from './editors/McqEditor';
import { TfngEditor } from './editors/TfngEditor';
import { GapFillEditor } from './editors/GapFillEditor';

const QUESTION_TYPES = [
  { id: 'mcq', label: 'Multiple Choice' },
  { id: 'tfng', label: 'True / False / NG' },
  { id: 'gap_fill', label: 'Gap Fill' },
  { id: 'matching', label: 'Matching' },
  { id: 'short_answer', label: 'Short Answer' },
  { id: 'form_completion', label: 'Form Completion' },
  { id: 'map_labeling', label: 'Map Labeling' },
  { id: 'summary_completion', label: 'Summary Completion' },
];

export function Step4Questions({ testId, module }: any) {
  const [parts, setParts] = useState<any[]>([]);
  const [activePartId, setActivePartId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [editingQ, setEditingQ] = useState<any | null>(null);

  useEffect(() => {
    api.get(`/super/tests/${testId}/`).then(r => {
      const test = r.data;
      const list = module === 'listening' ? test.listening_parts :
                   module === 'reading' ? test.passages : [];
      setParts(list);
      if (list[0]) setActivePartId(list[0].id);
    });
  }, [testId, module]);

  useEffect(() => {
    if (!activePartId) return;
    const p = parts.find(p => p.id === activePartId);
    if (p) setQuestions(p.questions || []);
  }, [activePartId, parts]);

  const addQuestion = (type: string) => {
    setEditingQ({
      question_number: questions.length + 1,
      question_type: type,
      prompt: '',
      options: {},
      correct_answer: {},
      points: 1,
    });
  };

  const saveQuestion = async () => {
    if (!editingQ || !activePartId) return;
    const url = module === 'listening'
      ? `/super/listening-parts/${activePartId}/add-question/`
      : `/super/passages/${activePartId}/add-question/`;
    const r = await api.post(url, editingQ);
    setQuestions([...questions, r.data]);
    setEditingQ(null);
  };

  return (
    <div className="bg-white rounded-2xl p-8 border">
      <div className="text-xs uppercase tracking-widest text-slate-500 mb-1">Qadam 4</div>
      <h2 className="text-2xl mb-1">Savollar va javob kaliti</h2>
      <p className="text-sm text-slate-500 mb-6">
        Jami: {questions.length} savol qo'shildi
      </p>

      {/* Part selector */}
      {parts.length > 1 && (
        <div className="flex gap-2 mb-5">
          {parts.map(p => (
            <button key={p.id} onClick={() => setActivePartId(p.id)}
              className={`px-4 py-2 rounded-full text-xs font-semibold ${
                activePartId === p.id ? 'bg-slate-900 text-white' : 'border'
              }`}>
              {module === 'listening' ? `Part ${p.part_number}` : `Section ${p.section_number}`}
            </button>
          ))}
        </div>
      )}

      {/* Question type pills */}
      <div className="mb-6">
        <div className="text-xs uppercase tracking-widest text-slate-500 mb-2">Yangi savol turi</div>
        <div className="flex flex-wrap gap-2">
          {QUESTION_TYPES.map(t => (
            <button key={t.id} onClick={() => addQuestion(t.id)}
              className="px-3 py-1.5 border rounded-full text-xs hover:border-slate-900">
              + {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Existing questions */}
      <div className="space-y-3">
        {questions.map((q, i) => (
          <div key={q.id} className="bg-slate-50 border rounded-xl p-4">
            <div className="flex justify-between text-xs text-slate-500 mb-2">
              <span>Savol #{q.question_number} · {q.question_type}</span>
            </div>
            <div className="font-medium">{q.prompt}</div>
          </div>
        ))}
      </div>

      {/* Editor modal */}
      {editingQ && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold mb-4">
              Savol #{editingQ.question_number} · {editingQ.question_type}
            </h3>

            <textarea
              placeholder="Savol matni..."
              value={editingQ.prompt}
              onChange={e => setEditingQ({ ...editingQ, prompt: e.target.value })}
              className="w-full p-3 border rounded-lg mb-4"
              rows={3}
            />

            {editingQ.question_type === 'mcq' && (
              <McqEditor q={editingQ} setQ={setEditingQ} />
            )}
            {editingQ.question_type === 'tfng' && (
              <TfngEditor q={editingQ} setQ={setEditingQ} />
            )}
            {editingQ.question_type === 'gap_fill' && (
              <GapFillEditor q={editingQ} setQ={setEditingQ} />
            )}
            {/* Boshqa turlari ham — sizda vaqt bor bo'lsa qo'shing */}

            <div className="flex gap-2 mt-4">
              <button onClick={() => setEditingQ(null)} className="flex-1 py-2 border rounded-full">
                Bekor qilish
              </button>
              <button onClick={saveQuestion} className="flex-1 py-2 bg-slate-900 text-white rounded-full">
                Saqlash
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

### 7.7 Question Editor komponentlari

`frontend/src/components/wizard/editors/McqEditor.tsx`:

```tsx
export function McqEditor({ q, setQ }: any) {
  const choices = q.options.choices || ['', '', '', ''];
  const correct = q.correct_answer.value || '';

  return (
    <div className="space-y-2">
      <div className="text-xs uppercase tracking-widest text-slate-500">Variantlar</div>
      {['A', 'B', 'C', 'D'].map((letter, i) => (
        <div key={letter} className={`flex items-center gap-3 p-3 rounded-lg border ${
          correct === letter ? 'border-green-500 bg-green-50' : 'border-slate-200'
        }`}>
          <input type="radio" checked={correct === letter}
            onChange={() => setQ({ ...q, correct_answer: { value: letter } })} />
          <span className="font-bold">{letter}</span>
          <input
            value={choices[i] || ''}
            onChange={e => {
              const newChoices = [...choices];
              newChoices[i] = e.target.value;
              setQ({ ...q, options: { ...q.options, choices: newChoices } });
            }}
            placeholder={`${letter} variant matni...`}
            className="flex-1 bg-transparent outline-none"
          />
        </div>
      ))}
    </div>
  );
}
```

`frontend/src/components/wizard/editors/TfngEditor.tsx`:

```tsx
export function TfngEditor({ q, setQ }: any) {
  const correct = q.correct_answer.value || '';
  return (
    <div>
      <div className="text-xs uppercase tracking-widest text-slate-500 mb-2">To'g'ri javob</div>
      <div className="flex gap-2">
        {['TRUE', 'FALSE', 'NOT GIVEN'].map(v => (
          <button key={v} onClick={() => setQ({ ...q, correct_answer: { value: v } })}
            className={`px-4 py-2 rounded-lg border text-sm font-semibold ${
              correct === v ? 'bg-green-100 border-green-500 text-green-700' : ''
            }`}>
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}
```

`frontend/src/components/wizard/editors/GapFillEditor.tsx`:

```tsx
export function GapFillEditor({ q, setQ }: any) {
  return (
    <div className="space-y-3">
      <div>
        <div className="text-xs uppercase tracking-widest text-slate-500 mb-1">
          To'g'ri javob
        </div>
        <input value={q.correct_answer.value || ''}
          onChange={e => setQ({ ...q, correct_answer: { value: e.target.value } })}
          placeholder="Masalan: 450"
          className="w-full p-2 border rounded-lg" />
      </div>
      <div>
        <div className="text-xs uppercase tracking-widest text-slate-500 mb-1">
          Muqobil javoblar (vergul bilan)
        </div>
        <input value={(q.alt_answers || []).join(', ')}
          onChange={e => setQ({ ...q, alt_answers: e.target.value.split(',').map(s => s.trim()) })}
          placeholder="four hundred fifty, 450 pounds"
          className="w-full p-2 border rounded-lg" />
      </div>
    </div>
  );
}
```

**Boshqa savol turlari uchun (Matching, Map, Form, Summary)** — vaqtingiz qolsa qo'shing. Qolmasa — keyin ETAP 7 da qo'shamiz. Hozir asosiysi MCQ, TFNG, GapFill ishlasa bo'ladi.

---

## 🎨 QISM 8: Audio yuklash UX (30 daqiqa)

`frontend/src/components/wizard/AudioUploadCard.tsx`:

```tsx
import { useState } from 'react';
import { api } from '@/lib/api';

interface Props {
  partId: number;
  initialAudioUrl?: string;
  initialDuration?: number;
  initialBitrate?: number;
  onUploaded?: (data: any) => void;
}

export function AudioUploadCard({ partId, initialAudioUrl, initialDuration, initialBitrate, onUploaded }: Props) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [audioUrl, setAudioUrl] = useState(initialAudioUrl);
  const [meta, setMeta] = useState({
    duration: initialDuration || 0,
    bitrate: initialBitrate || 0,
  });

  const handleUpload = async (file: File) => {
    setUploading(true);
    setProgress(0);

    const fd = new FormData();
    fd.append('audio', file);

    try {
      const r = await api.post(
        `/super/listening-parts/${partId}/upload-audio/`,
        fd,
        {
          onUploadProgress: (e) => {
            if (e.total) setProgress(Math.round((e.loaded / e.total) * 100));
          },
        }
      );
      setAudioUrl(r.data.audio_url);
      setMeta({
        duration: r.data.audio_duration_seconds,
        bitrate: r.data.audio_bitrate_kbps,
      });
      onUploaded?.(r.data);
    } catch (e) {
      alert('Yuklashda xatolik');
    } finally {
      setUploading(false);
    }
  };

  if (audioUrl) {
    const mins = Math.floor(meta.duration / 60);
    const secs = meta.duration % 60;
    return (
      <div className="bg-slate-50 border rounded-xl p-4 flex items-center gap-4">
        <div className="w-12 h-12 rounded-lg bg-slate-900 text-white flex items-center justify-center text-2xl">
          🎵
        </div>
        <div className="flex-1">
          <div className="font-semibold text-sm">Audio yuklangan</div>
          <div className="text-xs text-slate-500 font-mono">
            {mins}:{secs.toString().padStart(2, '0')} · {meta.bitrate} kbps
          </div>
          <audio controls src={audioUrl} className="mt-2 w-full max-w-md" />
        </div>
        <button onClick={() => {
          setAudioUrl(undefined);
          setMeta({ duration: 0, bitrate: 0 });
        }} className="text-red-500 text-sm hover:underline">
          O'chirish
        </button>
      </div>
    );
  }

  return (
    <label className="block border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-orange-500 transition">
      <input type="file" accept="audio/*" hidden
        onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])} />
      {uploading ? (
        <div>
          <div className="text-2xl mb-2">⏳</div>
          <div className="font-semibold mb-2">Yuklanmoqda...</div>
          <div className="w-full bg-slate-200 rounded-full h-2 max-w-xs mx-auto">
            <div className="bg-orange-500 h-2 rounded-full" style={{ width: `${progress}%` }} />
          </div>
          <div className="text-xs text-slate-500 mt-2">{progress}%</div>
        </div>
      ) : (
        <div>
          <div className="text-3xl mb-2">📤</div>
          <div className="font-semibold mb-1">Audio fayl yuklash</div>
          <div className="text-xs text-slate-500">MP3, WAV, M4A · maksimum 20MB</div>
        </div>
      )}
    </label>
  );
}
```

---


## ✅ QISM 9: SINOV (curl + brauzer) — 60 daqiqa

### 9.1 Backend curl test scenario (to'liq)

```bash
#!/bin/bash
# /tmp/etap2_test.sh

cd /mnt/c/Users/Jasmina/Documents/Jasmina/Jasmina/mock_exam/backend

# Backend ishlayotganini tekshir
curl -s http://127.0.0.1:8000/api/v1/auth/me/ > /dev/null || {
  echo "❌ Backend ishlamayapti. Avval ishga tushiring:"
  echo "    .venv/bin/python manage.py runserver"
  exit 1
}

echo "════════════════════════════════════════"
echo "  ETAP 2 ACCEPTANCE TEST"
echo "════════════════════════════════════════"

# === 1. SuperAdmin login ===
echo ""
echo "▶ 1. SuperAdmin login..."
curl -s -c /tmp/c_super.txt -X POST http://127.0.0.1:8000/api/v1/auth/login/ \
  -H 'Content-Type: application/json' \
  -d '{"username":"jasmina","password":"jasmina"}' | head -c 100
echo ""

# === 2. Yangi Listening test yaratish ===
echo ""
echo "▶ 2. Test yaratish..."
TEST_RESP=$(curl -s -b /tmp/c_super.txt -X POST http://127.0.0.1:8000/api/v1/super/tests/ \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "ETAP 2 Test - Cambridge 19 T2",
    "module": "listening",
    "difficulty": "medium",
    "test_type": "academic",
    "duration_minutes": 30,
    "category": "Cambridge 19"
  }')
echo "$TEST_RESP" | head -c 200
TEST_ID=$(echo "$TEST_RESP" | python -c "import json,sys; print(json.load(sys.stdin)['id'])")
echo ""
echo "  → Test ID: $TEST_ID"

# === 3. Part 1 qo'shish ===
echo ""
echo "▶ 3. Part 1 qo'shish..."
PART_RESP=$(curl -s -b /tmp/c_super.txt -X POST \
  "http://127.0.0.1:8000/api/v1/super/tests/$TEST_ID/add_listening_part/" \
  -H 'Content-Type: application/json' \
  -d '{
    "part_number": 1,
    "instructions": "Listen and answer questions 1-10",
    "transcript": "Test transcript..."
  }')
echo "$PART_RESP" | head -c 200
PART_ID=$(echo "$PART_RESP" | python -c "import json,sys; print(json.load(sys.stdin)['id'])")
echo ""
echo "  → Part ID: $PART_ID"

# === 4. MCQ savol qo'shish ===
echo ""
echo "▶ 4. MCQ savol qo'shish..."
curl -s -b /tmp/c_super.txt -X POST \
  "http://127.0.0.1:8000/api/v1/super/listening-parts/$PART_ID/add-question/" \
  -H 'Content-Type: application/json' \
  -d '{
    "question_number": 1,
    "question_type": "mcq",
    "prompt": "What is Sarah looking for?",
    "options": {"choices": ["A. Apartment", "B. House", "C. Room", "D. Dorm"]},
    "correct_answer": {"value": "B"}
  }' | head -c 200
echo ""

# === 5. TFNG savol ===
echo ""
echo "▶ 5. TFNG savol qo'shish..."
curl -s -b /tmp/c_super.txt -X POST \
  "http://127.0.0.1:8000/api/v1/super/listening-parts/$PART_ID/add-question/" \
  -H 'Content-Type: application/json' \
  -d '{
    "question_number": 2,
    "question_type": "tfng",
    "prompt": "The deposit must be paid in cash.",
    "correct_answer": {"value": "NOT GIVEN"}
  }' | head -c 200
echo ""

# === 6. Gap fill savol ===
echo ""
echo "▶ 6. Gap fill savol qo'shish..."
curl -s -b /tmp/c_super.txt -X POST \
  "http://127.0.0.1:8000/api/v1/super/listening-parts/$PART_ID/add-question/" \
  -H 'Content-Type: application/json' \
  -d '{
    "question_number": 3,
    "question_type": "gap_fill",
    "prompt": "The monthly rent is ___ pounds.",
    "correct_answer": {"value": "450"},
    "alt_answers": ["four hundred fifty"]
  }' | head -c 200
echo ""

# === 7. Test publish ===
echo ""
echo "▶ 7. Test publish..."
curl -s -b /tmp/c_super.txt -X POST \
  "http://127.0.0.1:8000/api/v1/super/tests/$TEST_ID/publish/" | head -c 200
echo ""

# === 8. Markaz admin login ===
echo ""
echo "▶ 8. taredu_admin login..."
curl -s -c /tmp/c_admin.txt -X POST http://127.0.0.1:8000/api/v1/auth/login/ \
  -H 'Content-Type: application/json' \
  -d '{"username":"taredu_admin","password":"taredu2026"}' | head -c 100
echo ""

# === 9. Yangi talaba yaratish ===
echo ""
echo "▶ 9. Talaba yaratish..."
STUDENT_RESP=$(curl -s -b /tmp/c_admin.txt -X POST \
  http://127.0.0.1:8000/api/v1/center/taredu/students/ \
  -H 'Content-Type: application/json' \
  -d '{
    "first_name": "Dilnoza",
    "last_name": "Rahimova",
    "username": "dilnoza_test",
    "target_band": 7.0
  }')
echo "$STUDENT_RESP" | head -c 300
echo ""

STUDENT_PASS=$(echo "$STUDENT_RESP" | python -c "import json,sys; print(json.load(sys.stdin)['credentials']['password'])")
echo "  → Talaba paroli: $STUDENT_PASS"

# === 10. Talaba o'z parolida login qila olishini tekshir ===
echo ""
echo "▶ 10. Talaba login qila oladimi..."
curl -s -X POST http://127.0.0.1:8000/api/v1/auth/login/ \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"dilnoza_test\",\"password\":\"$STUDENT_PASS\"}" | head -c 200
echo ""

# === 11. Talabalar ro'yxati ===
echo ""
echo "▶ 11. Talabalar ro'yxati..."
curl -s -b /tmp/c_admin.txt http://127.0.0.1:8000/api/v1/center/taredu/students/ | head -c 300
echo ""

# === 12. Ustoz yaratish ===
echo ""
echo "▶ 12. Ustoz yaratish..."
curl -s -b /tmp/c_admin.txt -X POST \
  http://127.0.0.1:8000/api/v1/center/taredu/teachers/ \
  -H 'Content-Type: application/json' \
  -d '{
    "first_name": "Aziz",
    "last_name": "Karimov",
    "username": "aziz_t"
  }' | head -c 300
echo ""

# === 13. Global katalog ko'rish ===
echo ""
echo "▶ 13. Global katalog (markaz adminga)..."
curl -s -b /tmp/c_admin.txt \
  http://127.0.0.1:8000/api/v1/center/taredu/tests/global-catalog/ | head -c 300
echo ""

# === 14. Klon qilish ===
echo ""
echo "▶ 14. Global testni klon qilish..."
curl -s -b /tmp/c_admin.txt -X POST \
  "http://127.0.0.1:8000/api/v1/center/taredu/tests/clone-from-global/$TEST_ID/" | head -c 300
echo ""

# === 15. Mening testlarim (1 ta klon) ===
echo ""
echo "▶ 15. Mening testlarim (klondan keyin)..."
curl -s -b /tmp/c_admin.txt http://127.0.0.1:8000/api/v1/center/taredu/tests/ | head -c 300
echo ""

# === 16. Boshqa markazga kirib bo'lmasligi ===
echo ""
echo "▶ 16. taredu_admin brightedu ga kira oladimi (kira olmasligi kerak)..."
curl -s -b /tmp/c_admin.txt -w "  HTTP: %{http_code}\n" \
  http://127.0.0.1:8000/api/v1/center/brightedu/students/ -o /dev/null
echo ""

# === 17. Talaba o'chirilgan klon test orqali kira oladimi ===
echo ""
echo "▶ 17. Reset password..."
STUDENT_ID=$(echo "$STUDENT_RESP" | python -c "import json,sys; print(json.load(sys.stdin)['student']['id'])")
curl -s -b /tmp/c_admin.txt -X POST \
  "http://127.0.0.1:8000/api/v1/center/taredu/students/$STUDENT_ID/reset_password/" | head -c 200
echo ""

echo ""
echo "════════════════════════════════════════"
echo "  HAMMA TESTLAR TUGADI"
echo "  Hech qaysi javobda 'error' so'zi yoki 500 bo'lmagan bo'lsa — SUCCESS!"
echo "════════════════════════════════════════"
```

Skriptni saqlang va ishga tushiring:

```bash
chmod +x /tmp/etap2_test.sh
/tmp/etap2_test.sh 2>&1 | tee /tmp/etap2_results.log
```

**Hammasi yashil bo'lsagina** brauzer testlariga o'ting.

### 9.2 Brauzer testlari (qo'lda)

#### Test A: SuperAdmin yangi test yaratadi

1. Brauzerda http://localhost:5173 ni oching
2. jasmina/jasmina bilan login qiling
3. SuperAdmin paneli ochiladi
4. **"Testlar"** menyusiga bosing (yangi qo'shilgan)
5. **"+ Yangi test"** tugmasi
6. Wizard ochiladi:
   - Step 1: "Listening" tanlang
   - Step 2: "Test 5" deb yozing, 30 daqiqa, medium, "Saqlash va davom"
   - Step 3: Part 1 sahifasi ochiladi, audio yuklang (xohlagan mp3)
   - Step 4: MCQ savoli qo'shing — variantlar to'ldiring, B ni to'g'ri belgilang
   - Step 5: Ko'rib chiqish, "E'lon qilish"
7. Test bazaga qo'shildi, ro'yxatda ko'rinadi

#### Test B: Markaz admin talabalar yaratadi

1. Logout qiling
2. taredu_admin/taredu2026 bilan login
3. /taredu/admin ga avtomatik o'tadi
4. **"Talabalar"** sahifasi
5. **"+ Yangi talaba"**: "Dilnoza Rahimova", login: `dilnoza_demo`, target band: 7.0
6. Saqlash → credentials modal ochiladi
7. Parolni nusxa oling
8. Logout, talaba sifatida login qilib ko'ring (haqiqiy paroldan foydalaning)

#### Test C: Markaz admin global testdan klon qiladi

1. taredu_admin sifatida login
2. /taredu/admin/tests
3. **"Global katalog"** tab
4. SuperAdmin yaratgan testni ko'ring
5. **"+ Bazaga qo'shish"** tugmasi
6. Tasdiq, klon yaratiladi
7. **"Mening testlarim"** tab — endi shu test bor

#### Test D: Co-brand login sahifa

1. /taredu ni oching (chiqib bo'lgan holatda)
2. **ILDIZmock × Taraqqiyot** logosi ko'rinadi
3. Login formasi shu joyda
4. ETAP 1 dan beri ishlaydi — buzilmaganini tekshiring

### 9.3 Acceptance Criteria — har bir punktni alohida ✅ qiling

```
[ ] 1. Backend migration xatosiz o'tdi
[ ] 2. Test modelida yangi fieldlar bor (module, difficulty, status)
[ ] 3. ListeningPart, Passage, WritingTask modellari yaratildi
[ ] 4. Question modeli polymorphic (8 ta question_type)
[ ] 5. /api/v1/super/tests/ — SuperAdmin CRUD ishlaydi
[ ] 6. /api/v1/super/tests/<id>/add_listening_part/ ishlaydi
[ ] 7. /api/v1/super/listening-parts/<id>/upload-audio/ ishlaydi
[ ] 8. mutagen audio metadata oladi (duration, bitrate)
[ ] 9. /api/v1/super/listening-parts/<id>/add-question/ savol qo'shadi
[ ] 10. /api/v1/center/<slug>/students/ — markaz admin CRUD ishlaydi
[ ] 11. Talaba yaratilganda parol avtomatik generate qilinadi va response da qaytadi
[ ] 12. /api/v1/center/<slug>/teachers/ — ustoz CRUD
[ ] 13. /api/v1/center/<slug>/tests/global-catalog/ — global testlarni ko'radi
[ ] 14. /api/v1/center/<slug>/tests/clone-from-global/<id>/ — chuqur klon (parts+questions+audio)
[ ] 15. Boshqa markaz admini boshqa markaz ma'lumotlariga kira olmaydi (403)
[ ] 16. Frontend: /taredu/admin layout ochiladi
[ ] 17. Sidebar: Bosh sahifa, Talabalar, Ustozlar, Testlar
[ ] 18. Talabalar sahifasi: jadval + "Yangi" tugmasi
[ ] 19. Yangi talaba modal: form + credentials popup (parol ko'rinadi)
[ ] 20. Tests sahifasi: ikkita tab (Mening testlarim / Global katalog)
[ ] 21. "+ Bazaga qo'shish" tugmasi global testni klon qiladi
[ ] 22. SuperAdmin /super/tests sahifasi ishlaydi
[ ] 23. /super/tests/new — 5 qadamli wizard ochiladi
[ ] 24. Stepper komponenti progress ko'rsatadi
[ ] 25. Audio upload progress bar bilan
[ ] 26. MCQ, TFNG, Gap Fill editorlar ishlaydi
[ ] 27. ETAP 1 funksionali buzilmagan (jasmina/jasmina, /taredu landing, center detail)
[ ] 28. Backend log da xato yo'q
[ ] 29. Frontend console da xato yo'q
[ ] 30. Brauzerda hech qaysi sahifa "white screen" bermaydi
```

---

## 📤 QISM 10: REPORTING — Sizdan kutilayotgan natija

### Tugagandan keyin shu formatda javob bering:

```
🎉 ETAP 2 — TUGADI

═══════ Acceptance Criteria ═══════
✅ 1. Backend migration: <screenshot>
✅ 2. Test modelida yangi fieldlar: <Test._meta dump>
✅ 3. ...
[hammasini birma-bir]

═══════ Curl test natijalari ═══════
[/tmp/etap2_results.log dan natijalar]
- 17 ta test → hammasi success
- HTTP codelar: 200/201/403 (kutilgancha)

═══════ Brauzer testlar ═══════
✅ Test A — SuperAdmin yangi test yaratdi
   Screenshot: [...]
✅ Test B — Talaba yaratildi va credentials ko'rsatildi
   Screenshot: [credentials modal]
✅ Test C — Klon qilindi, "Mening testlarim" da ko'rindi
   Screenshot: [...]
✅ Test D — /taredu landing buzilmagan

═══════ Yaratilgan fayllar ═══════
Backend:
- apps/tests/models.py (kengaytirildi: 4 yangi model)
- apps/tests/migrations/0003_etap2_models.py
- apps/tests/serializers.py (yangi)
- apps/tests/views.py (yangi/kengaytirildi)
- apps/tests/urls.py
- apps/center/ (yangi app)
  - models.py (bo'sh, faqat init)
  - serializers.py
  - views.py
  - tests_views.py
  - urls.py
- apps/organizations/permissions.py (IsCenterAdmin)
- requirements.txt (mutagen qo'shildi)

Frontend:
- src/components/guards/RequireCenterAdmin.tsx
- src/layouts/CenterAdminLayout.tsx
- src/pages/center/CenterDashboard.tsx
- src/pages/center/StudentsPage.tsx
- src/pages/center/TeachersPage.tsx
- src/pages/center/TestsPage.tsx
- src/components/center/CredentialsModal.tsx
- src/pages/super/SuperTestsListPage.tsx
- src/pages/super/TestWizardPage.tsx
- src/components/wizard/Stepper.tsx
- src/components/wizard/Step1Type.tsx
- src/components/wizard/Step2Metadata.tsx
- src/components/wizard/Step3Content.tsx
- src/components/wizard/Step4Questions.tsx
- src/components/wizard/Step5Review.tsx
- src/components/wizard/AudioUploadCard.tsx
- src/components/wizard/editors/McqEditor.tsx
- src/components/wizard/editors/TfngEditor.tsx
- src/components/wizard/editors/GapFillEditor.tsx
- src/App.tsx (yangi route lar)

═══════ Demo ma'lumotlar ═══════
- Test (global, ETAP 2 tomonidan yaratilgan): #X
  - Listening, 1 part, 3 savol (mcq, tfng, gap_fill)
- Talaba: dilnoza_demo / <generated>
- Ustoz: aziz_demo / <generated>
- Klon test (taredu): #Y

═══════ Hozirgi limitlar / TODO ═══════
- Map labeling, Matching, Form completion editorlari hozircha yo'q
  (faqat MCQ, TFNG, Gap Fill ishlaydi — ETAP 7 da qo'shamiz)
- Talaba assigned_teacher field hali ulanmagan
- StudentProfile, TeacherProfile alohida modellar yaratilmadi
  (User da role + membership yetarli)

═══════ Login ma'lumotlar (test uchun) ═══════
SuperAdmin: jasmina / jasmina
Markaz admin: taredu_admin / taredu2026
Talaba (yangi): dilnoza_demo / <screenshotda ko'rsatilgan>
Ustoz (yangi): aziz_demo / <screenshotda>

═══════ Servers ═══════
Backend: port 8000 ✅
Frontend: port 5173 ✅
PostgreSQL: ✅
```

### Agar biror narsa ishlamasa:

```
⚠️ ETAP 2 — QISMAN TUGADI

✅ Tugaganlar:
- ...

❌ Tugamaganlar / Xatolar:
- Qism 7 (wizard Step 4 Questions) — Map labeling editor qiyin bo'ldi, qoldirildi
- Curl test #14 (clone) — 500 xato, debug kerak

📍 Qaerda to'xtadim:
[file:line, error message]

📋 Qoldirilgan ish ro'yxati:
[ ] X
[ ] Y
```

**MUHIM:** "DONE" deb yozmang agar haqiqatan tugamasa. Yarim tugagan ish — yarim tugagan deb ayting. Yashirmang. Bu birinchi qoidamiz.

---

## 🚨 OGOHLANTIRISHLAR (Claude Code uchun)

1. **HAR QADAMNI alohida tekshiring** — keyingi qadamga o'tishdan oldin avvalgisi ishlasin.

2. **Eski kodni o'chirmang** — faqat kengaytiring. Test, Question modellari mavjud bo'lsa, yangi fieldlar qo'shing, eskisini saqlang.

3. **Migrationga ehtiyot bo'ling** — `makemigrations` natijasini birinchi navbatda ko'rib chiqing. Agar eski Question fieldlari yangi fieldlar bilan konflikt qilsa — null=True/blank=True bilan qo'shing, default qiymat bering.

4. **mutagen yuklamasdan audio upload qilmang** — `pip install mutagen` qiling avval.

5. **CORS ehtimol kerak** — agar frontend dan POST ishlamasa, `corsheaders` bilan `localhost:5173` ni allow qiling.

6. **JWT cookie httpOnly** — frontend `withCredentials: true` ishlatishi shart (axios interceptor da).

7. **Permission xatolarini test qiling** — taredu_admin brightedu ga kirsa 403 olishi shart. **Bu birinchi xavfsizlik tekshiruvi.**

8. **Hech qaysi savol turi (MCQ, TFNG, Gap Fill) ishlamasa** — kamida bir nechtasi ishlasin. Boshqalarini ETAP 7 ga qoldiring.

9. **band9/admin-add-test.html dizayni** — bu sizga vizual ilhom uchun, lekin kod emas. HTML emas, React + Tailwind ishlatamiz.

10. **Yakuniy javob 1500+ so'zli bo'lsin** — har bir testni, har bir fayl yo'lini, har bir screenshotni eslatib bering.

---

## 🎯 OXIRGI ESLATMA

Bu **ETAP 2** — markaz admini va test bazasi. Bu **ETAP 1** dan keyingi qadam.

ETAP 1 da:
- ✅ Multi-tenancy + SuperAdmin Centers
- ✅ jasmina/jasmina, taredu_admin/taredu2026

ETAP 2 da (siz hozir bajarayotgan):
- 🎯 Markaz admin paneli
- 🎯 SuperAdmin test wizardi
- 🎯 Test klon qilish

ETAP 3 keyingi (kelajakda):
- Mock seansi yaratish
- Polling sinxronizatsiya
- Talaba waiting room
- Test boshlash

**Bu ETAPda hammasini qilishga harakat qilmang.** Faqat shu yerda yozilganlarni qiling. Boshqalari keyingi etaplarda.

Sekin sekin qilamiz. Sifat birinchi.

Omad! 🚀
