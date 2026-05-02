# ETAP 16: TO'LOV TIZIMI - PAYMENT & BILLING SYSTEM

**Maqsad:** Professional to'lov tizimi - har bir o'quvchi test topshirgani uchun 30,000 so'm. SuperAdmin'da statistics, invoicing, payment tracking. O'quvchi qo'shish logikasi.

---

## 🎯 YECHIM VARIANTLARI TAHLILI

Men 5 ta variant ko'rib chiqdim va eng professional yechimni tanladim:

---

### ❌ Variant 1: Per-Attempt (Har topshirgan uchun)

```
Har bir attempt (practice yoki mock) = 30,000 so'm
```

**Pricing Example:**
```
Dilnoza:
- Practice Listening: 30k
- Practice Reading: 30k
- Practice Writing: 30k
- Mock Session: 30k
Total: 120,000 so'm
```

**Pros:**
- Simple tracking ✓
- High revenue ✓

**Cons:**
- Discourages practice ❌
- Too expensive ❌
- Students won't practice ❌
- Not fair ❌

**Verdict: ❌ Talabalar uchun juda qimmat**

---

### ❌ Variant 2: Per-Student-Per-Test (Har test uchun bir marta)

```
Har test uchun birinchi topshirish = 30,000 so'm
Keyingi retake'lar = FREE
```

**Pricing Example:**
```
Dilnoza - Listening Test:
- 1st attempt: 30k (CHARGED)
- 2nd attempt: 0 (FREE)
- 3rd attempt: 0 (FREE)

Total for Listening: 30k
```

**Pros:**
- Fair pricing ✓
- Encourages retakes ✓

**Cons:**
- Complex tracking ❌
- Hard to explain ❌
- "Which test?" ambiguous ❌

**Verdict: ❌ Tracking juda murakkab**

---

### ❌ Variant 3: Monthly Subscription

```
Har markaz oyiga 500,000 so'm
Unlimited students, unlimited tests
```

**Pros:**
- Predictable revenue ✓
- Simple billing ✓

**Cons:**
- Small centers overpay ❌
- Large centers underpay ❌
- Not per-test model ❌

**Verdict: ❌ Jasmina "per test" dedi**

---

### ✅ Variant 4: MOCK-ONLY BILLING ⭐ RECOMMENDED

```
Practice Mode: FREE (unlimited)
Mock Session: 30,000 so'm per student
```

**Pricing Example:**
```
Dilnoza:
- Practice Listening (10 times): FREE
- Practice Reading (5 times): FREE
- Practice Writing (3 times): FREE
- Mock Session #1: 30,000 so'm ✅
- Mock Session #2: 30,000 so'm ✅

Total: 60,000 so'm (2 mock sessions)
```

**Pros:**
- ✅ Clear separation (Practice FREE, Mock PAID)
- ✅ Encourages practice
- ✅ Fair pricing
- ✅ Easy to explain: "Mock imtihon uchun to'laysiz"
- ✅ Simple tracking
- ✅ Real exam experience paid
- ✅ Business model sustainable

**Cons:**
- None!

**Verdict: ✅ ENG PROFESSIONAL YECHIM**

---

### 🔄 Variant 5: Hybrid (Practice + Mock tiered)

```
Practice: 5,000 so'm
Mock: 30,000 so'm
```

**Pros:**
- Some revenue from practice ✓

**Cons:**
- Still discourages practice ❌
- More complex ❌

**Verdict: ❌ Variant 4 yaxshiroq**

---

## 🎯 TANLANGAN YECHIM: MOCK-ONLY BILLING

### Nima uchun bu eng yaxshi?

1. **Practice FREE - Talabalar ko'p mashq qiladi:**
   ```
   Talaba:
   - Listening'ni 20 marta practice qildi - FREE
   - Reading'ni 15 marta practice qildi - FREE
   - Writing'ni 10 marta practice qildi - FREE
   → Tayyor bo'lgach Mock imtihonga kiradi → 30k to'laydi
   ```

2. **Mock PAID - Real exam experience:**
   ```
   Mock Session:
   - Teacher boshqaradi
   - Hamma module birgalikda
   - Real exam kabi
   - Grading + Certificate
   → Qimmatga arziydi!
   ```

3. **Clear billing:**
   ```
   Markaz buxgalteriyasi:
   "Bu oyda 50 ta talaba mock imtihon topshirdi"
   50 × 30,000 = 1,500,000 so'm
   → Aniq, tushunarli!
   ```

4. **Business model:**
   ```
   - Small center: 10 student/month → 300k
   - Medium center: 50 student/month → 1.5M
   - Large center: 200 student/month → 6M
   → Scalable!
   ```

---

## 📋 SYSTEM ARCHITECTURE

### Database Models (3 ta asosiy):

```
┌─────────────────────────────────────────────┐
│  BillingCycle (Oylik hisob)                 │
├─────────────────────────────────────────────┤
│  - organization (FK)                        │
│  - month, year                              │
│  - total_sessions (50)                      │
│  - total_students (45) # unique students    │
│  - total_amount (1,350,000)                 │
│  - status (pending/paid/overdue)            │
│  - payment_method (cash/bank/card)          │
│  - payment_date                             │
│  - invoice_number (INV-2026-05-001)         │
│  - notes                                    │
└─────────────────────────────────────────────┘
           │
           │ Has many
           ▼
┌─────────────────────────────────────────────┐
│  MockSessionCharge (Har session uchun)      │
├─────────────────────────────────────────────┤
│  - session (FK to MockSession)              │
│  - participant (FK to MockParticipant)      │
│  - amount (30,000)                          │
│  - is_charged (True/False)                  │
│  - charged_at                               │
│  - billing_cycle (FK, optional)             │
└─────────────────────────────────────────────┘
           │
           │ Belongs to
           ▼
┌─────────────────────────────────────────────┐
│  PaymentHistory (To'lov tarixi)             │
├─────────────────────────────────────────────┤
│  - organization (FK)                        │
│  - billing_cycle (FK)                       │
│  - amount_paid                              │
│  - payment_method                           │
│  - payment_date                             │
│  - received_by (FK to User)                 │
│  - receipt_number                           │
│  - notes                                    │
└─────────────────────────────────────────────┘
```

---

## 🔧 STEP-BY-STEP IMPLEMENTATION

---

## STEP 1: Models yaratish

### A) BillingCycle Model

**Fayl:** `backend/apps/billing/__init__.py` (yangi app)

```bash
# Create new app
python manage.py startapp billing
mv billing apps/
```

**Fayl:** `backend/apps/billing/models.py`

```python
from django.db import models
from django.contrib.auth import get_user_model
from apps.organizations.models import Organization
from apps.mock.models import MockSession, MockParticipant

User = get_user_model()


class BillingCycle(models.Model):
    """
    Monthly billing cycle for an organization
    Tracks all mock sessions and generates invoices
    """
    
    STATUS_CHOICES = [
        ('pending', 'To\'lanmagan'),
        ('paid', 'To\'landi'),
        ('overdue', 'Muddati o\'tgan'),
        ('cancelled', 'Bekor qilindi'),
    ]
    
    PAYMENT_METHOD_CHOICES = [
        ('cash', 'Naqd'),
        ('bank_transfer', 'Bank o\'tkazmasi'),
        ('card', 'Karta'),
        ('other', 'Boshqa'),
    ]
    
    # Organization
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='billing_cycles',
        verbose_name='Markaz'
    )
    
    # Period
    month = models.IntegerField(
        verbose_name='Oy',
        help_text='1-12'
    )
    
    year = models.IntegerField(
        verbose_name='Yil',
        help_text='2026'
    )
    
    # Statistics (auto-calculated)
    total_sessions = models.IntegerField(
        default=0,
        verbose_name='Jami sessiyalar',
        help_text='Bu oyda yakunlangan mock sessionlar'
    )
    
    total_students = models.IntegerField(
        default=0,
        verbose_name='Jami talabalar',
        help_text='Unique students who took mock exams'
    )
    
    total_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        verbose_name='Jami summa (so\'m)',
        help_text='total_sessions × 30,000'
    )
    
    # Payment
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending',
        verbose_name='Holat'
    )
    
    payment_method = models.CharField(
        max_length=20,
        choices=PAYMENT_METHOD_CHOICES,
        blank=True,
        verbose_name='To\'lov usuli'
    )
    
    payment_date = models.DateField(
        null=True,
        blank=True,
        verbose_name='To\'langan sana'
    )
    
    amount_paid = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        verbose_name='To\'langan summa'
    )
    
    # Invoice
    invoice_number = models.CharField(
        max_length=50,
        unique=True,
        verbose_name='Hisob raqami',
        help_text='INV-2026-05-001'
    )
    
    invoice_generated_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Hisob yaratilgan vaqt'
    )
    
    # Notes
    notes = models.TextField(
        blank=True,
        verbose_name='Izohlar'
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_billing_cycles'
    )
    
    class Meta:
        db_table = 'billing_cycles'
        verbose_name = 'Hisob davri'
        verbose_name_plural = 'Hisob davrlari'
        ordering = ['-year', '-month']
        unique_together = ['organization', 'year', 'month']
        indexes = [
            models.Index(fields=['organization', 'status']),
            models.Index(fields=['year', 'month']),
        ]
    
    def __str__(self):
        return (
            f"{self.organization.name} - "
            f"{self.year}-{str(self.month).zfill(2)} - "
            f"{self.total_amount:,.0f} so'm"
        )
    
    def calculate_totals(self):
        """
        Calculate total sessions and amount
        Should be called after charges are created
        """
        charges = self.charges.filter(is_charged=True)
        
        self.total_sessions = charges.count()
        self.total_students = charges.values('participant__user').distinct().count()
        self.total_amount = charges.aggregate(
            total=models.Sum('amount')
        )['total'] or 0
        
        self.save()
    
    def generate_invoice_number(self):
        """
        Generate unique invoice number
        Format: INV-YYYY-MM-XXX
        """
        if self.invoice_number:
            return self.invoice_number
        
        # Count invoices in this month
        count = BillingCycle.objects.filter(
            year=self.year,
            month=self.month
        ).count()
        
        self.invoice_number = f"INV-{self.year}-{str(self.month).zfill(2)}-{str(count + 1).zfill(3)}"
        return self.invoice_number
    
    def mark_as_paid(self, payment_method, payment_date, amount_paid, notes=''):
        """
        Mark billing cycle as paid
        """
        self.status = 'paid'
        self.payment_method = payment_method
        self.payment_date = payment_date
        self.amount_paid = amount_paid
        if notes:
            self.notes = notes
        self.save()


class MockSessionCharge(models.Model):
    """
    Individual charge for a mock session participant
    30,000 so'm per student per session
    """
    
    # Session & Participant
    session = models.ForeignKey(
        MockSession,
        on_delete=models.CASCADE,
        related_name='charges',
        verbose_name='Sessiya'
    )
    
    participant = models.ForeignKey(
        MockParticipant,
        on_delete=models.CASCADE,
        related_name='charges',
        verbose_name='Talaba'
    )
    
    # Charge details
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=30000.00,
        verbose_name='Summa (so\'m)'
    )
    
    is_charged = models.BooleanField(
        default=True,
        verbose_name='Hisoblangan',
        help_text='False = Free/Test session'
    )
    
    # Billing
    billing_cycle = models.ForeignKey(
        'BillingCycle',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='charges',
        verbose_name='Hisob davri'
    )
    
    # Timestamps
    charged_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'mock_session_charges'
        verbose_name = 'Mock Sessiya Hisob'
        verbose_name_plural = 'Mock Sessiya Hisoblar'
        ordering = ['-charged_at']
        unique_together = ['session', 'participant']
        indexes = [
            models.Index(fields=['billing_cycle', 'is_charged']),
            models.Index(fields=['session', 'participant']),
        ]
    
    def __str__(self):
        return (
            f"{self.participant.user.get_full_name()} - "
            f"{self.session.group.name} - "
            f"{self.amount:,.0f} so'm"
        )


class PaymentHistory(models.Model):
    """
    Payment history record
    Tracks all payments received
    """
    
    PAYMENT_METHOD_CHOICES = [
        ('cash', 'Naqd'),
        ('bank_transfer', 'Bank o\'tkazmasi'),
        ('card', 'Karta'),
        ('other', 'Boshqa'),
    ]
    
    # Organization
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='payment_history',
        verbose_name='Markaz'
    )
    
    # Billing cycle
    billing_cycle = models.ForeignKey(
        BillingCycle,
        on_delete=models.CASCADE,
        related_name='payments',
        verbose_name='Hisob davri'
    )
    
    # Payment details
    amount_paid = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        verbose_name='To\'langan summa'
    )
    
    payment_method = models.CharField(
        max_length=20,
        choices=PAYMENT_METHOD_CHOICES,
        verbose_name='To\'lov usuli'
    )
    
    payment_date = models.DateField(
        verbose_name='To\'lov sanasi'
    )
    
    # Receipt
    receipt_number = models.CharField(
        max_length=50,
        blank=True,
        verbose_name='Kvitansiya raqami'
    )
    
    # Tracking
    received_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='received_payments',
        verbose_name='Qabul qildi'
    )
    
    notes = models.TextField(
        blank=True,
        verbose_name='Izohlar'
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'payment_history'
        verbose_name = 'To\'lov Tarixi'
        verbose_name_plural = 'To\'lov Tarixi'
        ordering = ['-payment_date']
    
    def __str__(self):
        return (
            f"{self.organization.name} - "
            f"{self.payment_date} - "
            f"{self.amount_paid:,.0f} so'm"
        )
```

---

## STEP 2: Auto-charge Logic

### A) Signal - Auto-create charges when session finalized

**Fayl:** `backend/apps/billing/signals.py`

```python
from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.mock.models import MockSession, MockParticipant
from .models import MockSessionCharge


@receiver(post_save, sender=MockSession)
def create_charges_on_finalize(sender, instance, created, **kwargs):
    """
    When mock session is finalized, create charges for all participants
    """
    
    # Only when status changes to 'finished'
    if instance.status == 'finished':
        # Check if charges already created
        if instance.charges.exists():
            return
        
        # Get all participants
        participants = instance.participants.all()
        
        # Create charges
        charges = []
        for participant in participants:
            charge = MockSessionCharge(
                session=instance,
                participant=participant,
                amount=30000.00,
                is_charged=True
            )
            charges.append(charge)
        
        # Bulk create
        MockSessionCharge.objects.bulk_create(charges)
        
        print(f"✅ Created {len(charges)} charges for session {instance.id}")
```

**Fayl:** `backend/apps/billing/apps.py`

```python
from django.apps import AppConfig


class BillingConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.billing'
    verbose_name = 'Billing & Payments'
    
    def ready(self):
        import apps.billing.signals  # ✅ Register signals
```

---

## STEP 3: Monthly Invoice Generation

### A) Management Command

**Fayl:** `backend/apps/billing/management/commands/generate_invoices.py`

```python
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import datetime
from apps.organizations.models import Organization
from apps.billing.models import BillingCycle, MockSessionCharge


class Command(BaseCommand):
    help = 'Generate monthly invoices for all organizations'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--month',
            type=int,
            help='Month (1-12). Default: last month'
        )
        parser.add_argument(
            '--year',
            type=int,
            help='Year (2026). Default: current year'
        )
    
    def handle(self, *args, **options):
        # Determine period
        now = timezone.now()
        
        if options['month']:
            month = options['month']
        else:
            # Last month
            month = now.month - 1 if now.month > 1 else 12
        
        if options['year']:
            year = options['year']
        else:
            year = now.year if month < 12 else now.year - 1
        
        self.stdout.write(
            self.style.SUCCESS(
                f'Generating invoices for {year}-{month:02d}...'
            )
        )
        
        # Get all active organizations
        organizations = Organization.objects.filter(status='active')
        
        total_created = 0
        
        for org in organizations:
            # Get uncharged mock session charges for this period
            charges = MockSessionCharge.objects.filter(
                session__organization=org,
                session__status='finished',
                is_charged=True,
                billing_cycle__isnull=True,
                charged_at__year=year,
                charged_at__month=month
            )
            
            if not charges.exists():
                self.stdout.write(
                    f"  - {org.name}: No charges"
                )
                continue
            
            # Create or get billing cycle
            cycle, created = BillingCycle.objects.get_or_create(
                organization=org,
                year=year,
                month=month,
                defaults={
                    'status': 'pending',
                }
            )
            
            if created:
                cycle.generate_invoice_number()
                cycle.invoice_generated_at = timezone.now()
                cycle.save()
            
            # Link charges to billing cycle
            charges.update(billing_cycle=cycle)
            
            # Calculate totals
            cycle.calculate_totals()
            
            self.stdout.write(
                self.style.SUCCESS(
                    f"  ✓ {org.name}: {cycle.total_sessions} sessions, "
                    f"{cycle.total_amount:,.0f} so'm"
                )
            )
            
            total_created += 1
        
        self.stdout.write(
            self.style.SUCCESS(
                f'\nTotal: {total_created} invoices generated'
            )
        )
```

**Run manually:**
```bash
# Generate for current month
python manage.py generate_invoices

# Generate for specific month
python manage.py generate_invoices --month 5 --year 2026
```

**Cron (monthly):**
```bash
# 1st of each month at 00:00
0 0 1 * * cd /path/to/project && python manage.py generate_invoices
```

---

## STEP 4: SuperAdmin Views

### A) Billing Dashboard

**Fayl:** `backend/apps/billing/views.py`

```python
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Sum, Count, Q
from django.shortcuts import get_object_or_404
from .models import BillingCycle, MockSessionCharge, PaymentHistory
from apps.organizations.models import Organization


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def billing_dashboard(request):
    """
    SuperAdmin billing dashboard
    Shows all organizations and their billing status
    """
    
    # Only SuperAdmin
    if request.user.role != 'superadmin':
        return Response({'error': 'Permission denied'}, status=403)
    
    # Get all organizations
    organizations = Organization.objects.filter(status='active')
    
    # Current month statistics
    from datetime import datetime
    now = datetime.now()
    
    dashboard_data = []
    
    for org in organizations:
        # Current month cycle
        current_cycle = BillingCycle.objects.filter(
            organization=org,
            year=now.year,
            month=now.month
        ).first()
        
        # Total unpaid amount
        unpaid_amount = BillingCycle.objects.filter(
            organization=org,
            status__in=['pending', 'overdue']
        ).aggregate(total=Sum('total_amount'))['total'] or 0
        
        # Total this year
        yearly_total = BillingCycle.objects.filter(
            organization=org,
            year=now.year
        ).aggregate(total=Sum('total_amount'))['total'] or 0
        
        dashboard_data.append({
            'organization_id': org.id,
            'organization_name': org.name,
            'current_month_sessions': current_cycle.total_sessions if current_cycle else 0,
            'current_month_amount': float(current_cycle.total_amount) if current_cycle else 0,
            'current_month_status': current_cycle.status if current_cycle else 'none',
            'unpaid_amount': float(unpaid_amount),
            'yearly_total': float(yearly_total),
        })
    
    # Overall statistics
    overall_stats = {
        'total_organizations': organizations.count(),
        'total_unpaid': sum(org['unpaid_amount'] for org in dashboard_data),
        'total_yearly': sum(org['yearly_total'] for org in dashboard_data),
    }
    
    return Response({
        'organizations': dashboard_data,
        'stats': overall_stats,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def organization_billing_detail(request, org_id):
    """
    Detailed billing for specific organization
    """
    
    if request.user.role != 'superadmin':
        return Response({'error': 'Permission denied'}, status=403)
    
    org = get_object_or_404(Organization, pk=org_id)
    
    # Get all billing cycles
    cycles = BillingCycle.objects.filter(
        organization=org
    ).order_by('-year', '-month')
    
    cycles_data = []
    for cycle in cycles:
        cycles_data.append({
            'id': cycle.id,
            'period': f"{cycle.year}-{cycle.month:02d}",
            'invoice_number': cycle.invoice_number,
            'total_sessions': cycle.total_sessions,
            'total_students': cycle.total_students,
            'total_amount': float(cycle.total_amount),
            'status': cycle.status,
            'payment_date': cycle.payment_date,
            'payment_method': cycle.payment_method,
        })
    
    return Response({
        'organization': {
            'id': org.id,
            'name': org.name,
        },
        'billing_cycles': cycles_data,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_as_paid(request, cycle_id):
    """
    Mark billing cycle as paid
    """
    
    if request.user.role != 'superadmin':
        return Response({'error': 'Permission denied'}, status=403)
    
    cycle = get_object_or_404(BillingCycle, pk=cycle_id)
    
    # Get payment details
    payment_method = request.data.get('payment_method')
    payment_date = request.data.get('payment_date')
    amount_paid = request.data.get('amount_paid')
    notes = request.data.get('notes', '')
    
    # Mark as paid
    cycle.mark_as_paid(
        payment_method=payment_method,
        payment_date=payment_date,
        amount_paid=amount_paid,
        notes=notes
    )
    
    # Create payment history
    PaymentHistory.objects.create(
        organization=cycle.organization,
        billing_cycle=cycle,
        amount_paid=amount_paid,
        payment_method=payment_method,
        payment_date=payment_date,
        received_by=request.user,
        notes=notes
    )
    
    return Response({
        'success': True,
        'message': 'Payment recorded successfully'
    })
```

---

## STEP 5: O'quvchi Qo'shish Logikasi

### Variant Analysis:

**A) Teacher adds students manually:**
```python
# Teacher dashboard → "Add Student" button
# Form: name, email, phone
# System creates StudentProfile + credentials
# Student gets login details
```

**B) Students self-register:**
```python
# Public registration page
# Student fills form
# Joins group via invitation code
# Teacher approves
```

**C) Bulk upload (Excel):**
```python
# Teacher uploads Excel file
# System parses and creates students
# Auto-generates passwords
# Sends SMS/email
```

**✅ RECOMMENDED: Hybrid (A + C)**

### Implementation:

**Fayl:** `backend/apps/students/views.py`

```python
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def add_student_to_group(request, group_id):
    """
    Teacher/Admin adds student to group
    """
    
    group = get_object_or_404(
        StudentGroup,
        pk=group_id,
        library=request.user.library
    )
    
    # Permission check
    if request.user.role == 'teacher' and group.teacher != request.user:
        return Response({'error': 'Permission denied'}, status=403)
    
    # Get student data
    first_name = request.data.get('first_name')
    last_name = request.data.get('last_name')
    phone = request.data.get('phone')
    email = request.data.get('email', '')
    
    # Create user
    from django.contrib.auth import get_user_model
    User = get_user_model()
    
    # Generate username from phone
    username = phone.replace('+', '').replace(' ', '')
    
    # Generate password
    import random
    import string
    password = ''.join(random.choices(string.ascii_letters + string.digits, k=8))
    
    # Create user
    user = User.objects.create_user(
        username=username,
        phone=phone,
        email=email,
        first_name=first_name,
        last_name=last_name,
        password=password,
        role='student',
        library=request.user.library
    )
    
    # Create student profile
    student = StudentProfile.objects.create(
        user=user,
        library=request.user.library,
        is_active=True
    )
    
    # Add to group
    group.students.add(student)
    
    return Response({
        'success': True,
        'student_id': student.id,
        'credentials': {
            'username': username,
            'password': password,  # Send via SMS in production
        }
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def bulk_upload_students(request, group_id):
    """
    Bulk upload students from Excel file
    """
    
    import openpyxl
    from io import BytesIO
    
    group = get_object_or_404(
        StudentGroup,
        pk=group_id,
        library=request.user.library
    )
    
    # Get file
    excel_file = request.FILES.get('file')
    
    if not excel_file:
        return Response({'error': 'No file provided'}, status=400)
    
    # Parse Excel
    wb = openpyxl.load_workbook(BytesIO(excel_file.read()))
    ws = wb.active
    
    created_students = []
    errors = []
    
    for idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        first_name, last_name, phone = row[0], row[1], row[2]
        
        try:
            # Create user
            username = phone.replace('+', '').replace(' ', '')
            password = ''.join(random.choices(string.ascii_letters + string.digits, k=8))
            
            user = User.objects.create_user(
                username=username,
                phone=phone,
                first_name=first_name,
                last_name=last_name,
                password=password,
                role='student',
                library=request.user.library
            )
            
            student = StudentProfile.objects.create(
                user=user,
                library=request.user.library
            )
            
            group.students.add(student)
            
            created_students.append({
                'name': f"{first_name} {last_name}",
                'phone': phone,
                'username': username,
                'password': password
            })
            
        except Exception as e:
            errors.append({
                'row': idx,
                'name': f"{first_name} {last_name}",
                'error': str(e)
            })
    
    return Response({
        'success': True,
        'created': len(created_students),
        'students': created_students,
        'errors': errors
    })
```

---

## STEP 6: Frontend - SuperAdmin Billing Dashboard

**Fayl:** `frontend/src/pages/superadmin/BillingDashboard.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface OrganizationBilling {
  organization_id: number;
  organization_name: string;
  current_month_sessions: number;
  current_month_amount: number;
  current_month_status: string;
  unpaid_amount: number;
  yearly_total: number;
}

export const BillingDashboard: React.FC = () => {
  const [data, setData] = useState<OrganizationBilling[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchData();
  }, []);
  
  const fetchData = async () => {
    try {
      const response = await api.get('/billing/dashboard/');
      setData(response.data.organizations);
      setStats(response.data.stats);
    } catch (error) {
      console.error('Failed to fetch billing data:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-700';
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'overdue': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };
  
  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Billing Dashboard
        </h1>
        <p className="text-gray-600 mt-2">
          Manage payments and invoices for all organizations
        </p>
      </div>
      
      {/* Overall Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <p className="text-sm text-gray-600">Total Organizations</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              {stats.total_organizations}
            </p>
          </div>
          
          <div className="bg-white rounded-xl shadow-lg p-6">
            <p className="text-sm text-gray-600">Total Unpaid</p>
            <p className="text-3xl font-bold text-red-600 mt-2">
              {stats.total_unpaid.toLocaleString()} so'm
            </p>
          </div>
          
          <div className="bg-white rounded-xl shadow-lg p-6">
            <p className="text-sm text-gray-600">Yearly Revenue</p>
            <p className="text-3xl font-bold text-green-600 mt-2">
              {stats.total_yearly.toLocaleString()} so'm
            </p>
          </div>
        </div>
      )}
      
      {/* Organizations Table */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Organization
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                This Month
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Unpaid
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Year Total
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.map((org) => (
              <tr key={org.organization_id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="font-semibold text-gray-900">
                    {org.organization_name}
                  </div>
                </td>
                
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900">
                    {org.current_month_sessions} sessions
                  </div>
                  <div className="text-xs text-gray-500">
                    {org.current_month_amount.toLocaleString()} so'm
                  </div>
                </td>
                
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                    getStatusColor(org.current_month_status)
                  }`}>
                    {org.current_month_status}
                  </span>
                </td>
                
                <td className="px-6 py-4">
                  <span className="text-red-600 font-semibold">
                    {org.unpaid_amount.toLocaleString()} so'm
                  </span>
                </td>
                
                <td className="px-6 py-4">
                  <span className="text-gray-900 font-semibold">
                    {org.yearly_total.toLocaleString()} so'm
                  </span>
                </td>
                
                <td className="px-6 py-4">
                  <button
                    onClick={() => window.location.href = `/superadmin/billing/${org.organization_id}`}
                    className="text-blue-600 hover:text-blue-700 font-semibold"
                  >
                    View Details →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
```

---

## ✅ FEATURES SUMMARY

### 1. **Pricing Model:**
```
✅ Practice Mode: FREE
✅ Mock Session: 30,000 so'm per student
✅ Clear separation
✅ Fair pricing
```

### 2. **Auto-charging:**
```
✅ Session finalized → Charges auto-created
✅ Monthly invoice generation (cron)
✅ Billing cycle tracking
```

### 3. **Payment Management:**
```
✅ Multiple payment methods (cash/bank/card)
✅ Payment history tracking
✅ Invoice numbering
✅ Receipt management
```

### 4. **SuperAdmin Dashboard:**
```
✅ All organizations billing
✅ Unpaid amounts highlighted
✅ Mark as paid functionality
✅ Statistics & analytics
```

### 5. **Student Management:**
```
✅ Manual add (one by one)
✅ Bulk upload (Excel)
✅ Auto-generate credentials
✅ Group assignment
```

---

## 🎯 WORKFLOW:

```
1. Teacher adds students to group:
   └─ Manual or Excel upload
   └─ Students get credentials

2. Students practice:
   └─ Unlimited FREE practice
   └─ No charges

3. Mock Session:
   └─ Teacher creates session
   └─ Students join
   └─ Session finishes
   └─ ✅ Charges auto-created (30k each)

4. End of month:
   └─ Cron generates invoices
   └─ BillingCycle created
   └─ Invoice number assigned

5. SuperAdmin reviews:
   └─ Sees all unpaid invoices
   └─ Organization pays (yuzma-yuz)
   └─ Marks as paid
   └─ Payment history recorded

6. Reports & Analytics:
   └─ Monthly revenue
   └─ Per-organization breakdown
   └─ Payment trends
```

---

**ETAP 16 TO'LIQ - PROFESSIONAL BILLING SYSTEM!** 💰

**Platform MUKAMMAL!** 🚀
