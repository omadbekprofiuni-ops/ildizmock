# ETAP 8: SUPER ADMIN + BILLING + CUSTOM ADMIN UI

**Maqsad:** 
1. Super Admin panel (Jasmina) - barcha markazlarni monitoring qilish
2. Session-based billing (har sessiya uchun to'lov)
3. Custom Admin UI (Django admin o'rniga professional interface)
4. Test yaratish osonlashtiriladi (wizard + bulk import)

---

## 📋 ETAP 8 QISMLARI

### 1. Super Admin Panel (Jasmina uchun)
- Barcha markazlarni ko'rish
- Har markaz activity monitoring
- Billing overview (qancha qarzdor)
- Invoice generation

### 2. Pricing & Billing System
- Har markaz uchun alohida narx
- Session-based calculation
- Auto billing
- Payment tracking

### 3. Custom Admin Interface
- Django admin'ni almashtirish
- Modern Tailwind UI
- User-friendly
- Dashboard-first approach

### 4. Test Creation Wizard
- Step-by-step form
- Section qo'shish oson
- Bulk import (CSV/Excel)

---

## 🔧 QILINISHI KERAK ISHLAR

---

## 1️⃣ PRICING & BILLING MODELS

### A) PricingTier Model

**Fayl:** `billing/models.py` (yangi app yaratamiz)

```bash
python manage.py startapp billing
```

```python
from django.db import models
from django.utils import timezone

class PricingTier(models.Model):
    """Har bir markaz uchun alohida narx"""
    
    library = models.OneToOneField(
        'Library',
        on_delete=models.CASCADE,
        related_name='pricing_tier'
    )
    
    # Pricing tiers
    TIER_CHOICES = [
        ('tier_1', '0-100 sessions'),
        ('tier_2', '101-500 sessions'),
        ('tier_3', '501+ sessions'),
    ]
    
    # Har tier uchun narx (so'mda)
    price_per_session_tier_1 = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=2000.00,
        help_text='0-100 sessions uchun narx (so\'mda)'
    )
    
    price_per_session_tier_2 = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=1500.00,
        help_text='101-500 sessions uchun narx'
    )
    
    price_per_session_tier_3 = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=1000.00,
        help_text='501+ sessions uchun narx'
    )
    
    # Contract info
    contract_start_date = models.DateField(null=True, blank=True)
    contract_end_date = models.DateField(null=True, blank=True)
    
    # Payment terms
    payment_period = models.CharField(
        max_length=20,
        choices=[
            ('monthly', 'Oylik'),
            ('quarterly', 'Kvartal'),
            ('annual', 'Yillik'),
        ],
        default='monthly'
    )
    
    # Status
    is_active = models.BooleanField(default=True)
    
    # Notes
    notes = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'pricing_tiers'
    
    def __str__(self):
        return f"{self.library.name} - Pricing"
    
    def get_price_for_session_count(self, count):
        """Session soni bo'yicha narx qaytaradi"""
        if count <= 100:
            return self.price_per_session_tier_1
        elif count <= 500:
            return self.price_per_session_tier_2
        else:
            return self.price_per_session_tier_3


class BillingCycle(models.Model):
    """Har oy/kvartal/yil uchun billing"""
    
    library = models.ForeignKey(
        'Library',
        on_delete=models.CASCADE,
        related_name='billing_cycles'
    )
    
    # Period
    period_start = models.DateField()
    period_end = models.DateField()
    
    # Session counts
    total_sessions = models.IntegerField(default=0)
    
    # Amount
    total_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        help_text='Jami summa (so\'mda)'
    )
    
    # Status
    STATUS_CHOICES = [
        ('pending', 'To\'lanmagan'),
        ('paid', 'To\'langan'),
        ('overdue', 'Muddati o\'tgan'),
    ]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    # Payment
    paid_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    paid_at = models.DateTimeField(null=True, blank=True)
    payment_method = models.CharField(max_length=50, blank=True)
    payment_reference = models.CharField(max_length=100, blank=True)
    
    # Invoice
    invoice_number = models.CharField(max_length=50, unique=True, blank=True)
    invoice_generated_at = models.DateTimeField(null=True, blank=True)
    
    # Notes
    notes = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'billing_cycles'
        ordering = ['-period_start']
    
    def __str__(self):
        return f"{self.library.name} - {self.period_start} to {self.period_end}"
    
    def calculate_amount(self):
        """Summani hisoblash"""
        pricing = self.library.pricing_tier
        
        # Get sessions in this period
        sessions = MockSession.objects.filter(
            library=self.library,
            date__gte=self.period_start,
            date__lte=self.period_end,
            status='completed'
        ).count()
        
        self.total_sessions = sessions
        
        # Calculate price
        price_per_session = pricing.get_price_for_session_count(sessions)
        self.total_amount = sessions * price_per_session
        
        self.save()
        return self.total_amount
    
    def generate_invoice_number(self):
        """Invoice raqam yaratish"""
        if not self.invoice_number:
            import datetime
            year = self.period_start.year
            month = self.period_start.month
            lib_code = self.library.name[:3].upper()
            self.invoice_number = f"INV-{year}{month:02d}-{lib_code}-{self.id:04d}"
            self.invoice_generated_at = timezone.now()
            self.save()


class SessionBillingLog(models.Model):
    """Har bir session uchun billing log"""
    
    session = models.OneToOneField(
        'MockSession',
        on_delete=models.CASCADE,
        related_name='billing_log'
    )
    
    billing_cycle = models.ForeignKey(
        BillingCycle,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='session_logs'
    )
    
    # Pricing at the time
    price_per_session = models.DecimalField(max_digits=10, decimal_places=2)
    
    # Participants
    participant_count = models.IntegerField(default=0)
    
    # Status
    is_billed = models.BooleanField(default=False)
    billed_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'session_billing_logs'
    
    def __str__(self):
        return f"{self.session.name} - {self.price_per_session} so'm"
```

---

### B) Auto Billing Logic

**Fayl:** `billing/utils.py`

```python
from datetime import datetime, timedelta
from django.utils import timezone
from .models import BillingCycle, SessionBillingLog

def create_monthly_billing_cycles():
    """Har oy uchun billing cycle yaratish (cron job)"""
    
    from core.models import Library
    
    # Last month
    today = timezone.now().date()
    first_day_last_month = (today.replace(day=1) - timedelta(days=1)).replace(day=1)
    last_day_last_month = today.replace(day=1) - timedelta(days=1)
    
    for library in Library.objects.filter(is_active=True):
        # Check if already exists
        existing = BillingCycle.objects.filter(
            library=library,
            period_start=first_day_last_month,
            period_end=last_day_last_month
        ).first()
        
        if not existing:
            # Create new billing cycle
            cycle = BillingCycle.objects.create(
                library=library,
                period_start=first_day_last_month,
                period_end=last_day_last_month,
                status='pending'
            )
            
            # Calculate amount
            cycle.calculate_amount()
            
            # Generate invoice
            cycle.generate_invoice_number()
            
            print(f"Created billing cycle for {library.name}: {cycle.total_amount} so'm")


def log_session_billing(session):
    """Session tugagandan keyin billing log yaratish"""
    
    if hasattr(session, 'billing_log'):
        return  # Already logged
    
    pricing = session.library.pricing_tier
    
    # Get current session count
    session_count = MockSession.objects.filter(
        library=session.library,
        status='completed'
    ).count()
    
    price = pricing.get_price_for_session_count(session_count)
    
    # Create log
    log = SessionBillingLog.objects.create(
        session=session,
        price_per_session=price,
        participant_count=session.participants.count(),
        is_billed=False
    )
    
    print(f"Session billing logged: {session.name} - {price} so'm")
    
    return log
```

---

### C) Signal to Auto-Log

**Fayl:** `mock/signals.py`

```python
from django.db.models.signals import post_save
from django.dispatch import receiver
from mock.models import MockSession
from billing.utils import log_session_billing

@receiver(post_save, sender=MockSession)
def session_completed_billing(sender, instance, created, **kwargs):
    """Session completed bo'lganda billing log yaratish"""
    
    if instance.status == 'completed' and not created:
        log_session_billing(instance)
```

**Fayl:** `mock/apps.py`

```python
class MockConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'mock'
    
    def ready(self):
        import mock.signals  # Import signals
```

---

## 2️⃣ SUPER ADMIN PANEL

### A) Super Admin Dashboard View

**Fayl:** `billing/views.py`

```python
from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required, user_passes_test
from django.db.models import Sum, Count, Avg
from django.utils import timezone
from datetime import timedelta

from core.models import Library
from mock.models import MockSession, MockParticipant
from .models import PricingTier, BillingCycle, SessionBillingLog


def is_superadmin(user):
    """Check if user is Jasmina (superadmin)"""
    return user.is_superuser or user.email == 'jasmina@ildiz.uz'


@login_required
@user_passes_test(is_superadmin)
def super_admin_dashboard(request):
    """Jasmina uchun super admin panel"""
    
    # === OVERVIEW STATS ===
    total_libraries = Library.objects.filter(is_active=True).count()
    total_sessions = MockSession.objects.filter(status='completed').count()
    total_participants = MockParticipant.objects.filter(overall_band_score__isnull=False).count()
    
    # === BILLING STATS ===
    # Total revenue
    total_revenue = BillingCycle.objects.filter(status='paid').aggregate(
        total=Sum('paid_amount')
    )['total'] or 0
    
    # Pending payments
    pending_amount = BillingCycle.objects.filter(status='pending').aggregate(
        total=Sum('total_amount')
    )['total'] or 0
    
    # This month revenue
    today = timezone.now().date()
    first_day_month = today.replace(day=1)
    
    monthly_revenue = BillingCycle.objects.filter(
        status='paid',
        paid_at__gte=first_day_month
    ).aggregate(total=Sum('paid_amount'))['total'] or 0
    
    # === LIBRARY STATS ===
    libraries = Library.objects.filter(is_active=True).annotate(
        session_count=Count('mock_sessions', filter=models.Q(mock_sessions__status='completed')),
        participant_count=Count('mock_sessions__participants'),
    ).order_by('-session_count')
    
    # Add billing info to each library
    for lib in libraries:
        # Get latest billing cycle
        latest_cycle = BillingCycle.objects.filter(library=lib).first()
        lib.latest_billing = latest_cycle
        
        # Get pending amount
        pending = BillingCycle.objects.filter(
            library=lib,
            status='pending'
        ).aggregate(total=Sum('total_amount'))['total'] or 0
        lib.pending_payment = pending
        
        # Get pricing
        if hasattr(lib, 'pricing_tier'):
            lib.current_price = lib.pricing_tier.get_price_for_session_count(lib.session_count)
        else:
            lib.current_price = 0
    
    # === RECENT ACTIVITY ===
    recent_sessions = MockSession.objects.filter(
        status='completed'
    ).select_related('library').order_by('-date')[:10]
    
    # === OVERDUE PAYMENTS ===
    overdue_cycles = BillingCycle.objects.filter(
        status='pending',
        period_end__lt=today - timedelta(days=30)
    ).select_related('library').order_by('period_end')
    
    return render(request, 'billing/super_admin_dashboard.html', {
        'total_libraries': total_libraries,
        'total_sessions': total_sessions,
        'total_participants': total_participants,
        'total_revenue': total_revenue,
        'pending_amount': pending_amount,
        'monthly_revenue': monthly_revenue,
        'libraries': libraries,
        'recent_sessions': recent_sessions,
        'overdue_cycles': overdue_cycles,
    })


@login_required
@user_passes_test(is_superadmin)
def library_detail_admin(request, library_id):
    """Bir markazning batafsil ma'lumotlari"""
    
    library = get_object_or_404(Library, id=library_id)
    
    # Sessions
    sessions = MockSession.objects.filter(
        library=library,
        status='completed'
    ).order_by('-date')[:20]
    
    # Billing cycles
    billing_cycles = BillingCycle.objects.filter(
        library=library
    ).order_by('-period_start')[:12]
    
    # Total stats
    total_sessions = MockSession.objects.filter(library=library, status='completed').count()
    total_participants = MockParticipant.objects.filter(session__library=library).count()
    
    # Revenue
    total_paid = BillingCycle.objects.filter(
        library=library,
        status='paid'
    ).aggregate(total=Sum('paid_amount'))['total'] or 0
    
    total_pending = BillingCycle.objects.filter(
        library=library,
        status='pending'
    ).aggregate(total=Sum('total_amount'))['total'] or 0
    
    return render(request, 'billing/library_detail_admin.html', {
        'library': library,
        'sessions': sessions,
        'billing_cycles': billing_cycles,
        'total_sessions': total_sessions,
        'total_participants': total_participants,
        'total_paid': total_paid,
        'total_pending': total_pending,
    })


@login_required
@user_passes_test(is_superadmin)
def mark_billing_paid(request, cycle_id):
    """Billing cycle'ni to'landi deb belgilash"""
    
    cycle = get_object_or_404(BillingCycle, id=cycle_id)
    
    if request.method == 'POST':
        amount = request.POST.get('amount')
        payment_method = request.POST.get('payment_method')
        reference = request.POST.get('reference')
        
        cycle.status = 'paid'
        cycle.paid_amount = amount
        cycle.paid_at = timezone.now()
        cycle.payment_method = payment_method
        cycle.payment_reference = reference
        cycle.save()
        
        messages.success(request, f"{cycle.library.name} uchun to'lov qabul qilindi!")
        return redirect('super_admin_dashboard')
    
    return render(request, 'billing/mark_paid.html', {'cycle': cycle})
```

---

### B) Super Admin Dashboard Template

**Fayl:** `billing/templates/billing/super_admin_dashboard.html`

```html
{% extends 'base.html' %}

{% block content %}
<div class="max-w-7xl mx-auto py-8 px-4">
    <!-- Header -->
    <div class="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg shadow-lg p-8 mb-8 text-white">
        <h1 class="text-3xl font-bold mb-2">👑 Super Admin Panel</h1>
        <p class="text-purple-100">Barcha markazlar monitoring va billing</p>
    </div>
    
    <!-- Stats -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div class="bg-white rounded-lg shadow p-6">
            <p class="text-sm text-gray-500 mb-1">Jami Markazlar</p>
            <p class="text-4xl font-bold text-blue-600">{{ total_libraries }}</p>
        </div>
        
        <div class="bg-white rounded-lg shadow p-6">
            <p class="text-sm text-gray-500 mb-1">Jami Sessiyalar</p>
            <p class="text-4xl font-bold text-green-600">{{ total_sessions }}</p>
        </div>
        
        <div class="bg-white rounded-lg shadow p-6">
            <p class="text-sm text-gray-500 mb-1">Jami Daromad</p>
            <p class="text-4xl font-bold text-purple-600">{{ total_revenue|floatformat:0 }}</p>
            <p class="text-xs text-gray-500">so'm</p>
        </div>
        
        <div class="bg-white rounded-lg shadow p-6">
            <p class="text-sm text-gray-500 mb-1">Kutilayotgan To'lov</p>
            <p class="text-4xl font-bold text-orange-600">{{ pending_amount|floatformat:0 }}</p>
            <p class="text-xs text-gray-500">so'm</p>
        </div>
    </div>
    
    <!-- Overdue Payments Alert -->
    {% if overdue_cycles %}
    <div class="bg-red-50 border-l-4 border-red-500 p-4 mb-8">
        <div class="flex">
            <div class="flex-shrink-0">
                <svg class="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
                </svg>
            </div>
            <div class="ml-3">
                <p class="text-sm text-red-700 font-semibold">
                    {{ overdue_cycles.count }} ta markaz to'lovni kechiktirmoqda!
                </p>
            </div>
        </div>
    </div>
    {% endif %}
    
    <!-- Libraries Table -->
    <div class="bg-white rounded-lg shadow overflow-hidden mb-8">
        <div class="px-6 py-4 border-b border-gray-200">
            <h2 class="text-xl font-bold">O'quv Markazlar</h2>
        </div>
        
        <div class="overflow-x-auto">
            <table class="w-full">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Markaz</th>
                        <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Sessiyalar</th>
                        <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Talabalar</th>
                        <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Narx/Sessiya</th>
                        <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Qarzdorlik</th>
                        <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th class="px-6 py-3"></th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                    {% for lib in libraries %}
                    <tr class="hover:bg-gray-50">
                        <td class="px-6 py-4">
                            <div class="flex items-center gap-3">
                                {% if lib.logo %}
                                <img src="{{ lib.logo.url }}" class="w-10 h-10 object-contain rounded">
                                {% endif %}
                                <div>
                                    <p class="font-semibold text-gray-900">{{ lib.name }}</p>
                                    <p class="text-xs text-gray-500">{{ lib.email }}</p>
                                </div>
                            </div>
                        </td>
                        <td class="px-6 py-4 text-center">
                            <span class="text-lg font-semibold">{{ lib.session_count }}</span>
                        </td>
                        <td class="px-6 py-4 text-center">
                            <span class="text-lg">{{ lib.participant_count }}</span>
                        </td>
                        <td class="px-6 py-4 text-center">
                            <span class="text-sm font-semibold text-green-600">{{ lib.current_price|floatformat:0 }} so'm</span>
                        </td>
                        <td class="px-6 py-4 text-center">
                            {% if lib.pending_payment > 0 %}
                            <span class="text-lg font-bold text-red-600">{{ lib.pending_payment|floatformat:0 }}</span>
                            <p class="text-xs text-gray-500">so'm</p>
                            {% else %}
                            <span class="text-sm text-gray-400">-</span>
                            {% endif %}
                        </td>
                        <td class="px-6 py-4 text-center">
                            {% if lib.is_active %}
                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Aktiv
                            </span>
                            {% else %}
                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                Faol emas
                            </span>
                            {% endif %}
                        </td>
                        <td class="px-6 py-4 text-right">
                            <a href="{% url 'library_detail_admin' lib.id %}" 
                               class="text-blue-600 hover:underline text-sm">
                                Batafsil →
                            </a>
                        </td>
                    </tr>
                    {% endfor %}
                </tbody>
            </table>
        </div>
    </div>
    
    <!-- Recent Sessions -->
    <div class="bg-white rounded-lg shadow p-6">
        <h2 class="text-xl font-bold mb-4">Oxirgi Sessiyalar</h2>
        
        <div class="space-y-3">
            {% for session in recent_sessions %}
            <div class="flex items-center justify-between border-b pb-3 last:border-0">
                <div>
                    <p class="font-semibold">{{ session.name }}</p>
                    <p class="text-sm text-gray-600">{{ session.library.name }} • {{ session.date|date:"d M Y" }}</p>
                </div>
                
                <div class="text-right">
                    <p class="text-sm text-gray-500">{{ session.participants.count }} talaba</p>
                    {% if session.billing_log %}
                    <p class="text-xs text-green-600 font-semibold">{{ session.billing_log.price_per_session|floatformat:0 }} so'm</p>
                    {% endif %}
                </div>
            </div>
            {% endfor %}
        </div>
    </div>
</div>
{% endblock %}
```

---

## 3️⃣ CUSTOM ADMIN UI (Django Admin O'RNIGA)

### A) Test Creation Wizard

**Fayl:** `tests/views.py`

```python
@login_required
def test_create_wizard(request):
    """Step-by-step test yaratish wizard"""
    
    library = request.user.library
    
    # Step 1: Basic Info
    if request.method == 'POST' and 'step' in request.POST:
        step = request.POST.get('step')
        
        if step == '1':
            # Save to session
            request.session['test_name'] = request.POST.get('name')
            request.session['test_description'] = request.POST.get('description')
            request.session['test_type'] = request.POST.get('test_type')
            request.session['test_duration'] = request.POST.get('duration_minutes')
            
            return redirect('test_wizard_step_2')
    
    return render(request, 'tests/wizard_step_1.html')


@login_required
def test_wizard_step_2(request):
    """Step 2: Audio/File Upload (for Listening)"""
    
    test_type = request.session.get('test_type')
    
    if test_type == 'listening':
        if request.method == 'POST':
            # Create test
            test = ListeningTest.objects.create(
                library=request.user.library,
                name=request.session.get('test_name'),
                description=request.session.get('test_description'),
                duration_minutes=request.session.get('test_duration'),
                audio_file=request.FILES.get('audio_file')
            )
            
            # Clear session
            for key in ['test_name', 'test_description', 'test_type', 'test_duration']:
                request.session.pop(key, None)
            
            return redirect('test_wizard_add_sections', test_id=test.id)
        
        return render(request, 'tests/wizard_step_2_listening.html')
    
    # Reading va Writing uchun boshqacha


@login_required
def test_wizard_add_sections(request, test_id):
    """Step 3: Section va Question qo'shish"""
    
    test = get_object_or_404(ListeningTest, id=test_id, library=request.user.library)
    
    if request.method == 'POST':
        action = request.POST.get('action')
        
        if action == 'add_section':
            # Add new section
            section = ListeningSection.objects.create(
                test=test,
                title=request.POST.get('title'),
                instructions=request.POST.get('instructions')
            )
            
            messages.success(request, 'Section qo\'shildi!')
            return redirect('test_wizard_add_sections', test_id=test.id)
        
        elif action == 'add_question':
            # Add question to section
            section_id = request.POST.get('section_id')
            section = get_object_or_404(ListeningSection, id=section_id)
            
            ListeningQuestion.objects.create(
                section=section,
                question_text=request.POST.get('question_text'),
                question_type=request.POST.get('question_type'),
                correct_answer=request.POST.get('correct_answer'),
                options=request.POST.getlist('options') if request.POST.get('question_type') == 'mcq' else []
            )
            
            messages.success(request, 'Savol qo\'shildi!')
            return redirect('test_wizard_add_sections', test_id=test.id)
        
        elif action == 'finish':
            messages.success(request, f'Test "{test.name}" muvaffaqiyatli yaratildi!')
            return redirect('admin_test_list')
    
    sections = test.sections.all()
    
    return render(request, 'tests/wizard_step_3_sections.html', {
        'test': test,
        'sections': sections,
    })
```

---

### B) Wizard Template (Step 1)

**Fayl:** `tests/templates/tests/wizard_step_1.html`

```html
{% extends 'base.html' %}

{% block content %}
<div class="max-w-3xl mx-auto py-8 px-4">
    <!-- Progress Bar -->
    <div class="mb-8">
        <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-semibold text-blue-600">Step 1: Asosiy Ma'lumot</span>
            <span class="text-sm text-gray-500">1 / 3</span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-2">
            <div class="bg-blue-600 h-2 rounded-full" style="width: 33%"></div>
        </div>
    </div>
    
    <div class="bg-white rounded-lg shadow-lg p-8">
        <h1 class="text-3xl font-bold mb-2">Yangi Test Yaratish</h1>
        <p class="text-gray-600 mb-8">Qadamma-qadam test yaratamiz</p>
        
        <form method="post">
            {% csrf_token %}
            <input type="hidden" name="step" value="1">
            
            <!-- Test Type -->
            <div class="mb-6">
                <label class="block text-sm font-semibold mb-2">Test Turi *</label>
                <div class="grid grid-cols-3 gap-4">
                    <label class="relative flex items-center justify-center p-4 border-2 border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 transition">
                        <input type="radio" name="test_type" value="listening" class="sr-only peer" required>
                        <div class="text-center peer-checked:text-blue-600">
                            <div class="text-3xl mb-2">🎧</div>
                            <div class="font-semibold">Listening</div>
                        </div>
                        <div class="absolute inset-0 border-2 border-blue-600 rounded-lg opacity-0 peer-checked:opacity-100"></div>
                    </label>
                    
                    <label class="relative flex items-center justify-center p-4 border-2 border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 transition">
                        <input type="radio" name="test_type" value="reading" class="sr-only peer">
                        <div class="text-center peer-checked:text-blue-600">
                            <div class="text-3xl mb-2">📖</div>
                            <div class="font-semibold">Reading</div>
                        </div>
                        <div class="absolute inset-0 border-2 border-blue-600 rounded-lg opacity-0 peer-checked:opacity-100"></div>
                    </label>
                    
                    <label class="relative flex items-center justify-center p-4 border-2 border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 transition">
                        <input type="radio" name="test_type" value="writing" class="sr-only peer">
                        <div class="text-center peer-checked:text-blue-600">
                            <div class="text-3xl mb-2">✍️</div>
                            <div class="font-semibold">Writing</div>
                        </div>
                        <div class="absolute inset-0 border-2 border-blue-600 rounded-lg opacity-0 peer-checked:opacity-100"></div>
                    </label>
                </div>
            </div>
            
            <!-- Test Name -->
            <div class="mb-6">
                <label class="block text-sm font-semibold mb-2">Test Nomi *</label>
                <input type="text" name="name" required
                       class="w-full border border-gray-300 rounded-lg px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                       placeholder="Misol: IELTS Listening Test 1">
            </div>
            
            <!-- Description -->
            <div class="mb-6">
                <label class="block text-sm font-semibold mb-2">Tavsif</label>
                <textarea name="description" rows="3"
                          class="w-full border border-gray-300 rounded-lg px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                          placeholder="Test haqida qisqa ma'lumot..."></textarea>
            </div>
            
            <!-- Duration -->
            <div class="mb-8">
                <label class="block text-sm font-semibold mb-2">Davomiyligi (daqiqa) *</label>
                <input type="number" name="duration_minutes" required min="1" max="180"
                       class="w-full border border-gray-300 rounded-lg px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                       placeholder="30">
            </div>
            
            <!-- Buttons -->
            <div class="flex items-center justify-between">
                <a href="{% url 'admin_test_list' %}" 
                   class="text-gray-600 hover:text-gray-900">
                    ← Orqaga
                </a>
                
                <button type="submit" 
                        class="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition">
                    Keyingi Qadam →
                </button>
            </div>
        </form>
    </div>
</div>
{% endblock %}
```

---

## 4️⃣ BULK IMPORT (CSV/Excel)

### A) Bulk Import View

**Fayl:** `tests/views.py`

```python
import pandas as pd

@login_required
def bulk_import_questions(request, test_id):
    """CSV/Excel orqali savollar import qilish"""
    
    test = get_object_or_404(ListeningTest, id=test_id, library=request.user.library)
    
    if request.method == 'POST':
        file = request.FILES.get('file')
        
        if not file:
            messages.error(request, 'Fayl tanlanmagan!')
            return redirect('bulk_import_questions', test_id=test.id)
        
        try:
            # Read file
            if file.name.endswith('.csv'):
                df = pd.read_csv(file)
            elif file.name.endswith(('.xlsx', '.xls')):
                df = pd.read_excel(file)
            else:
                messages.error(request, 'Faqat CSV yoki Excel fayllar qabul qilinadi!')
                return redirect('bulk_import_questions', test_id=test.id)
            
            # Validate columns
            required_columns = ['section_title', 'question_text', 'question_type', 'correct_answer']
            if not all(col in df.columns for col in required_columns):
                messages.error(request, f'Fayl noto\'g\'ri formatda! Kerakli ustunlar: {", ".join(required_columns)}')
                return redirect('bulk_import_questions', test_id=test.id)
            
            # Import
            imported_count = 0
            current_section = None
            
            for _, row in df.iterrows():
                # Get or create section
                section_title = row['section_title']
                
                if current_section is None or current_section.title != section_title:
                    current_section, _ = ListeningSection.objects.get_or_create(
                        test=test,
                        title=section_title
                    )
                
                # Create question
                question_type = row['question_type']
                options = []
                
                if question_type == 'mcq':
                    # Parse options (comma-separated)
                    options_str = row.get('options', '')
                    options = [opt.strip() for opt in options_str.split(',') if opt.strip()]
                
                ListeningQuestion.objects.create(
                    section=current_section,
                    question_text=row['question_text'],
                    question_type=question_type,
                    correct_answer=row['correct_answer'],
                    options=options,
                    explanation=row.get('explanation', '')
                )
                
                imported_count += 1
            
            messages.success(request, f'{imported_count} ta savol muvaffaqiyatli import qilindi!')
            return redirect('test_wizard_add_sections', test_id=test.id)
        
        except Exception as e:
            messages.error(request, f'Xatolik: {str(e)}')
            return redirect('bulk_import_questions', test_id=test.id)
    
    return render(request, 'tests/bulk_import.html', {'test': test})
```

---

### B) CSV Template Download

**Fayl:** `tests/views.py`

```python
import csv
from django.http import HttpResponse

@login_required
def download_import_template(request):
    """CSV template yuklab olish"""
    
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = 'attachment; filename="questions_template.csv"'
    
    writer = csv.writer(response)
    
    # Headers
    writer.writerow(['section_title', 'question_text', 'question_type', 'correct_answer', 'options', 'explanation'])
    
    # Sample rows
    writer.writerow(['Part 1', 'What is the speaker\'s name?', 'fill_blank', 'John Smith', '', 'Correct answer is mentioned at 0:15'])
    writer.writerow(['Part 1', 'Where is he from?', 'mcq', 'London', 'London,Paris,Berlin,Rome', ''])
    writer.writerow(['Part 2', 'The statement is true or false?', 'true_false', 'True', '', ''])
    
    return response
```

---

## 5️⃣ URL ROUTING

**Fayl:** `urls.py`

```python
from django.urls import path
from billing import views as billing_views
from tests import views as test_views

urlpatterns = [
    # ... mavjud patterns
    
    # === SUPER ADMIN ===
    path('super-admin/', billing_views.super_admin_dashboard, name='super_admin_dashboard'),
    path('super-admin/library/<int:library_id>/', billing_views.library_detail_admin, name='library_detail_admin'),
    path('super-admin/billing/<int:cycle_id>/mark-paid/', billing_views.mark_billing_paid, name='mark_billing_paid'),
    
    # === TEST WIZARD ===
    path('tests/create/', test_views.test_create_wizard, name='test_create_wizard'),
    path('tests/create/step-2/', test_views.test_wizard_step_2, name='test_wizard_step_2'),
    path('tests/<int:test_id>/sections/', test_views.test_wizard_add_sections, name='test_wizard_add_sections'),
    
    # === BULK IMPORT ===
    path('tests/<int:test_id>/import/', test_views.bulk_import_questions, name='bulk_import_questions'),
    path('tests/import-template/', test_views.download_import_template, name='download_import_template'),
]
```

---

## 6️⃣ CRON JOB (Monthly Billing)

### A) Django Management Command

**Fayl:** `billing/management/commands/generate_monthly_billing.py`

```python
from django.core.management.base import BaseCommand
from billing.utils import create_monthly_billing_cycles

class Command(BaseCommand):
    help = 'Generate monthly billing cycles for all libraries'
    
    def handle(self, *args, **kwargs):
        self.stdout.write('Generating monthly billing cycles...')
        create_monthly_billing_cycles()
        self.stdout.write(self.style.SUCCESS('Successfully generated billing cycles!'))
```

---

### B) Crontab Setup (Production)

```bash
# Edit crontab
crontab -e

# Add this line (har oyning 1-kuni soat 00:00 da)
0 0 1 * * cd /path/to/project && /path/to/venv/bin/python manage.py generate_monthly_billing
```

---

## 🧪 SINOV (TESTING)

### Test Ssenariysi:

1. **Pricing Setup**
   - Super admin sifatida login
   - Bir markaz uchun pricing tier yarating
   - Narxlarni sozlang

2. **Session Billing Log**
   - Markaz admin'i mock sessiya yaratadi
   - Sessiya tugagandan keyin
   - `SessionBillingLog` yaratilganini tekshiring

3. **Super Admin Dashboard**
   - `/super-admin/` ga kiring
   - Barcha markazlar ko'rinishi kerak
   - Har markaz qancha qarzdorligini ko'ring
   - Billing cycle'larni ko'ring

4. **Mark as Paid**
   - Bir billing cycle'ni tanlang
   - "To'landi" deb belgilang
   - Status "paid" bo'lishi kerak

5. **Test Wizard**
   - `/tests/create/` ga kiring
   - Step-by-step test yarating
   - Section va question qo'shing
   - Wizard intuitive bo'lishi kerak

6. **Bulk Import**
   - CSV template yuklab oling
   - 10-20 ta savol yozing
   - Import qiling
   - Barcha savollar qo'shilganini tekshiring

---

## ✅ ACCEPTANCE CRITERIA

### Billing:
1. ✅ Har markaz uchun alohida pricing tier
2. ✅ Session-based auto billing
3. ✅ Monthly billing cycle generation
4. ✅ Invoice raqamlar avtomatik
5. ✅ Super admin dashboard - barcha markazlar
6. ✅ To'lovni qabul qilish interface

### UI Improvements:
7. ✅ Test yaratish wizard (step-by-step)
8. ✅ Visual test type selection
9. ✅ Section va question inline qo'shish
10. ✅ Bulk import (CSV/Excel)
11. ✅ Template yuklab olish

### Monitoring:
12. ✅ Har markaz activity tracking
13. ✅ Overdue payment alerts
14. ✅ Revenue statistics

---

## 📦 MIGRATION VA DEPLOYMENT

### 1. Migration
```bash
python manage.py makemigrations billing
python manage.py migrate
pip install pandas openpyxl
```

### 2. Create Pricing Tiers
```python
python manage.py shell

>>> from core.models import Library
>>> from billing.models import PricingTier
>>> for lib in Library.objects.all():
>>>     PricingTier.objects.get_or_create(
>>>         library=lib,
>>>         defaults={
>>>             'price_per_session_tier_1': 2000,
>>>             'price_per_session_tier_2': 1500,
>>>             'price_per_session_tier_3': 1000,
>>>         }
>>>     )
```

### 3. Setup Cron Job
```bash
# Production serverda
0 0 1 * * cd /var/www/ielts_platform && /var/www/ielts_platform/venv/bin/python manage.py generate_monthly_billing
```

---

## 🎯 YAKUNIY XULOSA

**ETAP 8 tugagandan keyin:**

✅ **PROFESSIONAL BIZNES PLATFORMA**
- Super admin monitoring
- Session-based billing
- Har markaz uchun alohida narx
- Auto invoice generation

✅ **USER-FRIENDLY INTERFACE**
- Test yaratish wizard
- Bulk import
- Intuitive UI
- Django admin'siz

✅ **REAL BIZNES TOOL**
- Markazlarni kuzatish
- To'lovni tracking qilish
- Qarzdorlikni bilish
- Revenue analytics

---

**PLATFORMANGIZ HOZIR BIZNESGA TAYYOR!** 💰🚀

Markazlar bilan shartnoma tuzishingiz mumkin, platformani sotishingiz mumkin!

Omad! 💪
