# ETAP 9: ZAMONAVIY ADMIN PANEL - FULL CUSTOM UI

**Maqsad:** Django admin'ni almashtirish - rasmlardagi kabi zamonaviy, professional, oson ishlatiladigan admin panel. Test yaratish juda oson bo'lishi kerak.

---

## 📋 ETAP 9 QISMLARI

### 1. Modern Dashboard UI
- Stat kartalar (rasmlardagi kabi)
- Chart.js chartlar
- Clean sidebar navigation
- Responsive design

### 2. Easy Test Creation
- Visual wizard (step-by-step)
- Inline question editing
- Drag-and-drop ordering
- Auto-save
- Preview mode

### 3. Library Settings Fix
- Logo upload (ishlaydigan)
- Address, phone, email
- Contact info
- Preview

### 4. Certificate Update
- Ikkala logo (ILDIZ + Library)
- Address footer
- Professional layout

---

## 🔧 QILINISHI KERAK ISHLAR

---

## 1️⃣ LIBRARY MODEL TO'G'RILASH

### A) Model Update

**Fayl:** `core/models.py`

```python
from django.db import models
from django.core.validators import FileExtensionValidator

class Library(models.Model):
    """O'quv Markaz"""
    
    # Basic info
    name = models.CharField(max_length=200, verbose_name='Markaz nomi')
    
    # Branding
    logo = models.ImageField(
        upload_to='library_logos/',
        blank=True,
        null=True,
        validators=[FileExtensionValidator(['png', 'jpg', 'jpeg', 'svg'])],
        help_text='PNG, JPG yoki SVG (transparent background tavsiya etiladi)',
        verbose_name='Markaz logosi'
    )
    
    # Contact info
    address = models.TextField(
        blank=True,
        verbose_name='Manzil',
        help_text='To\'liq manzil: shahar, ko\'cha, bino raqami'
    )
    
    phone = models.CharField(
        max_length=50,
        blank=True,
        verbose_name='Telefon',
        help_text='Misol: +998 90 123 45 67'
    )
    
    email = models.EmailField(
        blank=True,
        verbose_name='Email'
    )
    
    website = models.URLField(
        blank=True,
        verbose_name='Website',
        help_text='Misol: https://example.uz'
    )
    
    # Primary color (ETAP 7 dan)
    primary_color = models.CharField(
        max_length=7,
        default='#2563EB',
        verbose_name='Asosiy rang'
    )
    
    # Settings
    is_active = models.BooleanField(default=True, verbose_name='Faol')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'libraries'
        verbose_name = 'O\'quv Markaz'
        verbose_name_plural = 'O\'quv Markazlar'
    
    def __str__(self):
        return self.name
```

---

## 2️⃣ ZAMONAVIY ADMIN DASHBOARD

### A) Dashboard View

**Fayl:** `core/views.py`

```python
from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.db.models import Count, Avg, Sum
from django.utils import timezone
from datetime import timedelta

from mock.models import MockSession, MockParticipant
from tests.models import ListeningTest, ReadingTest, WritingTest

@login_required
def admin_dashboard(request):
    """Modern admin dashboard - rasmlardagi kabi"""
    
    library = request.user.library
    
    # === QUICK STATS ===
    total_tests = (
        ListeningTest.objects.filter(library=library).count() +
        ReadingTest.objects.filter(library=library).count() +
        WritingTest.objects.filter(library=library).count()
    )
    
    total_sessions = MockSession.objects.filter(library=library).count()
    
    completed_sessions = MockSession.objects.filter(
        library=library,
        status='completed'
    ).count()
    
    total_students = MockParticipant.objects.filter(
        session__library=library
    ).values('full_name').distinct().count()
    
    # === AVERAGE SCORES ===
    avg_overall = MockParticipant.objects.filter(
        session__library=library,
        overall_band_score__isnull=False
    ).aggregate(avg=Avg('overall_band_score'))['avg'] or 0
    
    # === RECENT ACTIVITY (7 days) ===
    seven_days_ago = timezone.now() - timedelta(days=7)
    
    recent_sessions_count = MockSession.objects.filter(
        library=library,
        date__gte=seven_days_ago
    ).count()
    
    # === WEEKLY CHART DATA (last 7 days) ===
    weekly_data = []
    for i in range(7):
        day = timezone.now() - timedelta(days=6-i)
        day_start = day.replace(hour=0, minute=0, second=0)
        day_end = day.replace(hour=23, minute=59, second=59)
        
        count = MockSession.objects.filter(
            library=library,
            date__gte=day_start,
            date__lte=day_end
        ).count()
        
        weekly_data.append({
            'day': day.strftime('%a'),  # Mon, Tue, Wed
            'count': count
        })
    
    # === SCORE DISTRIBUTION ===
    score_ranges = [
        (0, 4.5, '0-4.5'),
        (5.0, 5.5, '5.0-5.5'),
        (6.0, 6.5, '6.0-6.5'),
        (7.0, 7.5, '7.0-7.5'),
        (8.0, 9.0, '8.0-9.0'),
    ]
    
    score_distribution = []
    for min_score, max_score, label in score_ranges:
        count = MockParticipant.objects.filter(
            session__library=library,
            overall_band_score__gte=min_score,
            overall_band_score__lte=max_score
        ).count()
        score_distribution.append({'label': label, 'count': count})
    
    # === RECENT SESSIONS ===
    recent_sessions = MockSession.objects.filter(
        library=library
    ).order_by('-date')[:5]
    
    # === PENDING TASKS ===
    pending_writing = MockParticipant.objects.filter(
        session__library=library,
        writing_status='pending',
        writing_task1_text__isnull=False
    ).count()
    
    pending_speaking = MockParticipant.objects.filter(
        session__library=library,
        speaking_status='pending'
    ).count()
    
    return render(request, 'core/admin_dashboard.html', {
        'total_tests': total_tests,
        'total_sessions': total_sessions,
        'completed_sessions': completed_sessions,
        'total_students': total_students,
        'avg_overall': round(avg_overall, 1),
        'recent_sessions_count': recent_sessions_count,
        'weekly_data': weekly_data,
        'score_distribution': score_distribution,
        'recent_sessions': recent_sessions,
        'pending_writing': pending_writing,
        'pending_speaking': pending_speaking,
    })
```

---

### B) Modern Dashboard Template

**Fayl:** `core/templates/core/admin_dashboard.html`

```html
{% extends 'admin_base.html' %}

{% block content %}
<div class="p-8">
    <!-- Header -->
    <div class="mb-8">
        <h1 class="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p class="text-gray-600 mt-1">{{ request.user.library.name }}</p>
    </div>
    
    <!-- Quick Stats -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <!-- Total Tests -->
        <div class="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
            <div class="flex items-center justify-between mb-4">
                <div class="p-3 bg-white bg-opacity-30 rounded-lg">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                </div>
                <span class="text-2xl">📝</span>
            </div>
            <div class="text-3xl font-bold mb-1">{{ total_tests }}</div>
            <div class="text-blue-100 text-sm">Jami Testlar</div>
        </div>
        
        <!-- Total Sessions -->
        <div class="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
            <div class="flex items-center justify-between mb-4">
                <div class="p-3 bg-white bg-opacity-30 rounded-lg">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <span class="text-2xl">🎯</span>
            </div>
            <div class="text-3xl font-bold mb-1">{{ completed_sessions }}</div>
            <div class="text-purple-100 text-sm">Mock Sessiyalar</div>
        </div>
        
        <!-- Total Students -->
        <div class="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
            <div class="flex items-center justify-between mb-4">
                <div class="p-3 bg-white bg-opacity-30 rounded-lg">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                </div>
                <span class="text-2xl">👥</span>
            </div>
            <div class="text-3xl font-bold mb-1">{{ total_students }}</div>
            <div class="text-green-100 text-sm">Jami Talabalar</div>
        </div>
        
        <!-- Average Score -->
        <div class="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg p-6 text-white">
            <div class="flex items-center justify-between mb-4">
                <div class="p-3 bg-white bg-opacity-30 rounded-lg">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                </div>
                <span class="text-2xl">📊</span>
            </div>
            <div class="text-3xl font-bold mb-1">{{ avg_overall }}</div>
            <div class="text-orange-100 text-sm">O'rtacha Ball</div>
        </div>
    </div>
    
    <!-- Charts Row -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <!-- Weekly Activity -->
        <div class="bg-white rounded-xl shadow-lg p-6">
            <h3 class="text-lg font-bold text-gray-900 mb-4">Oxirgi 7 Kun</h3>
            <canvas id="weeklyChart" height="200"></canvas>
        </div>
        
        <!-- Score Distribution -->
        <div class="bg-white rounded-xl shadow-lg p-6">
            <h3 class="text-lg font-bold text-gray-900 mb-4">Ballar Taqsimoti</h3>
            <canvas id="scoreChart" height="200"></canvas>
        </div>
    </div>
    
    <!-- Recent Activity & Pending Tasks -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Recent Sessions -->
        <div class="lg:col-span-2 bg-white rounded-xl shadow-lg p-6">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-lg font-bold text-gray-900">Oxirgi Sessiyalar</h3>
                <a href="{% url 'mock_sessions_list' %}" class="text-blue-600 hover:underline text-sm">
                    Barchasi →
                </a>
            </div>
            
            <div class="space-y-3">
                {% for session in recent_sessions %}
                <div class="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition">
                    <div>
                        <p class="font-semibold text-gray-900">{{ session.name }}</p>
                        <p class="text-sm text-gray-500">{{ session.date|date:"d M Y" }} • {{ session.participants.count }} talaba</p>
                    </div>
                    
                    <div>
                        {% if session.status == 'completed' %}
                        <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Tugallangan
                        </span>
                        {% elif session.status == 'in_progress' %}
                        <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Jarayonda
                        </span>
                        {% else %}
                        <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            Kutilmoqda
                        </span>
                        {% endif %}
                    </div>
                </div>
                {% empty %}
                <p class="text-center text-gray-500 py-8">Sessiya yo'q</p>
                {% endfor %}
            </div>
        </div>
        
        <!-- Pending Tasks -->
        <div class="bg-white rounded-xl shadow-lg p-6">
            <h3 class="text-lg font-bold text-gray-900 mb-4">Vazifalar</h3>
            
            <div class="space-y-4">
                <!-- Writing Grading -->
                <div class="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                    <div class="flex items-center justify-between mb-2">
                        <span class="font-semibold text-orange-900">Writing</span>
                        <span class="text-2xl font-bold text-orange-600">{{ pending_writing }}</span>
                    </div>
                    <p class="text-sm text-orange-700 mb-3">Baholash kutilmoqda</p>
                    <a href="{% url 'writing_grading_queue' %}" 
                       class="block w-full text-center bg-orange-600 text-white py-2 rounded-lg hover:bg-orange-700 transition">
                        Baholash
                    </a>
                </div>
                
                <!-- Speaking Grading -->
                <div class="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div class="flex items-center justify-between mb-2">
                        <span class="font-semibold text-blue-900">Speaking</span>
                        <span class="text-2xl font-bold text-blue-600">{{ pending_speaking }}</span>
                    </div>
                    <p class="text-sm text-blue-700 mb-3">Baholash kutilmoqda</p>
                    <a href="{% url 'speaking_grading_queue' %}" 
                       class="block w-full text-center bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition">
                        Baholash
                    </a>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- Chart.js -->
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<script>
// Weekly Chart
const weeklyCtx = document.getElementById('weeklyChart').getContext('2d');
new Chart(weeklyCtx, {
    type: 'bar',
    data: {
        labels: [{% for day in weekly_data %}'{{ day.day }}',{% endfor %}],
        datasets: [{
            label: 'Sessiyalar',
            data: [{% for day in weekly_data %}{{ day.count }},{% endfor %}],
            backgroundColor: 'rgba(59, 130, 246, 0.8)',
            borderRadius: 8,
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false }
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: { stepSize: 1 }
            }
        }
    }
});

// Score Distribution Chart
const scoreCtx = document.getElementById('scoreChart').getContext('2d');
new Chart(scoreCtx, {
    type: 'doughnut',
    data: {
        labels: [{% for item in score_distribution %}'{{ item.label }}',{% endfor %}],
        datasets: [{
            data: [{% for item in score_distribution %}{{ item.count }},{% endfor %}],
            backgroundColor: [
                'rgba(239, 68, 68, 0.8)',
                'rgba(249, 115, 22, 0.8)',
                'rgba(234, 179, 8, 0.8)',
                'rgba(34, 197, 94, 0.8)',
                'rgba(59, 130, 246, 0.8)',
            ],
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom'
            }
        }
    }
});
</script>
{% endblock %}
```

---

### C) Admin Base Template (Sidebar)

**Fayl:** `core/templates/admin_base.html`

```html
<!DOCTYPE html>
<html lang="uz">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{% block title %}Admin Panel{% endblock %} - {{ request.user.library.name }}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    
    <!-- Custom CSS -->
    <style>
        :root {
            --primary: {{ request.user.library.primary_color|default:'#2563EB' }};
        }
        
        .sidebar-link.active {
            background-color: var(--primary);
            color: white;
        }
    </style>
</head>
<body class="bg-gray-50">
    <div class="flex h-screen overflow-hidden">
        <!-- Sidebar -->
        <aside class="w-64 bg-gray-900 text-white flex-shrink-0">
            <!-- Logo -->
            <div class="p-6 border-b border-gray-800">
                <div class="flex items-center gap-3">
                    {% if request.user.library.logo %}
                    <img src="{{ request.user.library.logo.url }}" class="w-10 h-10 object-contain rounded">
                    {% else %}
                    <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                        <span class="text-white font-bold text-lg">{{ request.user.library.name|first|upper }}</span>
                    </div>
                    {% endif %}
                    <div>
                        <h1 class="text-lg font-bold">ILDIZMock</h1>
                        <p class="text-xs text-gray-400">Admin Panel</p>
                    </div>
                </div>
            </div>
            
            <!-- Navigation -->
            <nav class="p-4 space-y-2">
                <a href="{% url 'admin_dashboard' %}" 
                   class="sidebar-link flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-800 transition {% if request.resolver_match.url_name == 'admin_dashboard' %}active{% endif %}">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    <span>Dashboard</span>
                </a>
                
                <!-- Tests Section -->
                <div class="pt-4 pb-2">
                    <p class="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Testlar</p>
                </div>
                
                <a href="{% url 'test_create_wizard' %}" 
                   class="sidebar-link flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-800 transition">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Yangi Test</span>
                </a>
                
                <a href="{% url 'tests_list' %}" 
                   class="sidebar-link flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-800 transition">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>Testlar Ro'yxati</span>
                </a>
                
                <!-- Mock Sessions -->
                <div class="pt-4 pb-2">
                    <p class="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Mock Testlar</p>
                </div>
                
                <a href="{% url 'mock_create_session' %}" 
                   class="sidebar-link flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-800 transition">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Yangi Sessiya</span>
                </a>
                
                <a href="{% url 'mock_sessions_list' %}" 
                   class="sidebar-link flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-800 transition">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Sessiyalar</span>
                </a>
                
                <!-- Analytics -->
                <div class="pt-4 pb-2">
                    <p class="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Analytics</p>
                </div>
                
                <a href="{% url 'admin_analytics_dashboard' %}" 
                   class="sidebar-link flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-800 transition">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <span>Statistika</span>
                </a>
                
                <!-- Settings -->
                <div class="pt-4 pb-2">
                    <p class="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Sozlamalar</p>
                </div>
                
                <a href="{% url 'library_settings' %}" 
                   class="sidebar-link flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-800 transition">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>Markaz Sozlamalari</span>
                </a>
            </nav>
            
            <!-- User Menu -->
            <div class="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-800">
                <div class="flex items-center gap-3 mb-3">
                    <div class="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                        <span class="text-white font-bold">{{ request.user.first_name|first|upper }}</span>
                    </div>
                    <div class="flex-1">
                        <p class="text-sm font-semibold">{{ request.user.get_full_name }}</p>
                        <p class="text-xs text-gray-400">{{ request.user.role|title }}</p>
                    </div>
                </div>
                <a href="{% url 'logout' %}" 
                   class="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span>Chiqish</span>
                </a>
            </div>
        </aside>
        
        <!-- Main Content -->
        <main class="flex-1 overflow-y-auto">
            <!-- Top Bar -->
            <div class="bg-white border-b border-gray-200 px-8 py-4">
                <div class="flex items-center justify-between">
                    <div>
                        <h2 class="text-2xl font-bold text-gray-900">{% block page_title %}Dashboard{% endblock %}</h2>
                    </div>
                    
                    <div class="flex items-center gap-4">
                        <!-- Notifications -->
                        <button class="relative p-2 text-gray-400 hover:text-gray-600">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                            {% if pending_writing > 0 or pending_speaking > 0 %}
                            <span class="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500"></span>
                            {% endif %}
                        </button>
                        
                        <!-- Current Time -->
                        <div class="text-sm text-gray-600">
                            <span id="current-time"></span>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Page Content -->
            <div class="bg-gray-50">
                {% block content %}{% endblock %}
            </div>
        </main>
    </div>
    
    <script>
        // Update time
        function updateTime() {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
            const dateStr = now.toLocaleDateString('uz-UZ', { weekday: 'short', day: 'numeric', month: 'short' });
            document.getElementById('current-time').textContent = `${dateStr}, ${timeStr}`;
        }
        updateTime();
        setInterval(updateTime, 60000);
    </script>
</body>
</html>
```

---

## 3️⃣ LIBRARY SETTINGS PAGE

### A) View

**Fayl:** `core/views.py`

```python
from django.contrib import messages

@login_required
def library_settings(request):
    """Markaz sozlamalari - logo, address, contact"""
    
    library = request.user.library
    
    if request.method == 'POST':
        # Update library info
        library.name = request.POST.get('name')
        library.address = request.POST.get('address', '')
        library.phone = request.POST.get('phone', '')
        library.email = request.POST.get('email', '')
        library.website = request.POST.get('website', '')
        library.primary_color = request.POST.get('primary_color', '#2563EB')
        
        # Logo upload
        if request.FILES.get('logo'):
            library.logo = request.FILES['logo']
        
        library.save()
        
        messages.success(request, 'Sozlamalar saqlandi!')
        return redirect('library_settings')
    
    return render(request, 'core/library_settings.html', {
        'library': library
    })
```

---

### B) Template

**Fayl:** `core/templates/core/library_settings.html`

```html
{% extends 'admin_base.html' %}

{% block page_title %}Markaz Sozlamalari{% endblock %}

{% block content %}
<div class="p-8">
    <div class="max-w-4xl mx-auto">
        <!-- Success Message -->
        {% if messages %}
        <div class="mb-6">
            {% for message in messages %}
            <div class="bg-green-50 border-l-4 border-green-500 p-4 rounded">
                <p class="text-green-800">{{ message }}</p>
            </div>
            {% endfor %}
        </div>
        {% endif %}
        
        <form method="post" enctype="multipart/form-data">
            {% csrf_token %}
            
            <!-- Logo Upload -->
            <div class="bg-white rounded-xl shadow-lg p-8 mb-6">
                <h3 class="text-xl font-bold text-gray-900 mb-6">Brending</h3>
                
                <div class="mb-6">
                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                        Markaz Logosi
                    </label>
                    
                    <div class="flex items-start gap-6">
                        <!-- Current Logo -->
                        <div class="flex-shrink-0">
                            {% if library.logo %}
                            <img src="{{ library.logo.url }}" 
                                 alt="{{ library.name }}"
                                 class="w-32 h-32 object-contain border-2 border-gray-200 rounded-lg p-2 bg-white">
                            {% else %}
                            <div class="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
                                <span class="text-gray-400 text-sm text-center">Logo yo'q</span>
                            </div>
                            {% endif %}
                        </div>
                        
                        <!-- Upload -->
                        <div class="flex-1">
                            <input type="file" 
                                   name="logo" 
                                   id="logo"
                                   accept="image/png, image/jpeg, image/svg+xml"
                                   class="block w-full text-sm text-gray-500
                                          file:mr-4 file:py-2 file:px-4
                                          file:rounded-lg file:border-0
                                          file:text-sm file:font-semibold
                                          file:bg-blue-50 file:text-blue-700
                                          hover:file:bg-blue-100">
                            <p class="text-xs text-gray-500 mt-2">
                                PNG, JPG yoki SVG. Max 2MB. Transparent background tavsiya etiladi.
                            </p>
                        </div>
                    </div>
                </div>
                
                <!-- Primary Color -->
                <div>
                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                        Asosiy Rang
                    </label>
                    <div class="flex items-center gap-4">
                        <input type="color" 
                               name="primary_color" 
                               value="{{ library.primary_color }}"
                               class="h-12 w-24 rounded-lg border border-gray-300 cursor-pointer">
                        <p class="text-sm text-gray-600">
                            Bu rang buttonlar va linklar uchun ishlatiladi
                        </p>
                    </div>
                </div>
            </div>
            
            <!-- Basic Info -->
            <div class="bg-white rounded-xl shadow-lg p-8 mb-6">
                <h3 class="text-xl font-bold text-gray-900 mb-6">Asosiy Ma'lumotlar</h3>
                
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            Markaz Nomi *
                        </label>
                        <input type="text" 
                               name="name" 
                               value="{{ library.name }}"
                               required
                               class="w-full border border-gray-300 rounded-lg px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            To'liq Manzil
                        </label>
                        <textarea name="address" 
                                  rows="3"
                                  class="w-full border border-gray-300 rounded-lg px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                  placeholder="Shahar, ko'cha, bino raqami">{{ library.address }}</textarea>
                        <p class="text-xs text-gray-500 mt-1">
                            Bu manzil certificate'da ko'rinadi
                        </p>
                    </div>
                </div>
            </div>
            
            <!-- Contact Info -->
            <div class="bg-white rounded-xl shadow-lg p-8 mb-6">
                <h3 class="text-xl font-bold text-gray-900 mb-6">Kontakt Ma'lumotlari</h3>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            Telefon
                        </label>
                        <input type="text" 
                               name="phone" 
                               value="{{ library.phone }}"
                               class="w-full border border-gray-300 rounded-lg px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                               placeholder="+998 90 123 45 67">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            Email
                        </label>
                        <input type="email" 
                               name="email" 
                               value="{{ library.email }}"
                               class="w-full border border-gray-300 rounded-lg px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                               placeholder="info@example.uz">
                    </div>
                    
                    <div class="md:col-span-2">
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            Website
                        </label>
                        <input type="url" 
                               name="website" 
                               value="{{ library.website }}"
                               class="w-full border border-gray-300 rounded-lg px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                               placeholder="https://example.uz">
                    </div>
                </div>
            </div>
            
            <!-- Save Button -->
            <div class="flex items-center justify-end gap-4">
                <a href="{% url 'admin_dashboard' %}" 
                   class="px-6 py-3 text-gray-700 hover:text-gray-900">
                    Bekor qilish
                </a>
                
                <button type="submit" 
                        class="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition">
                    Saqlash
                </button>
            </div>
        </form>
    </div>
</div>
{% endblock %}
```

---

## 4️⃣ CERTIFICATE UPDATE (Ikkala Logo)

### A) Certificate Function Update

**Fayl:** `mock/certificate.py`

```python
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfgen import canvas
from reportlab.lib.units import cm
from io import BytesIO
import os
from django.conf import settings

def generate_certificate(participant):
    """Mock IELTS sertifikat - ikkala logo bilan"""
    
    buffer = BytesIO()
    width, height = landscape(A4)
    c = canvas.Canvas(buffer, pagesize=landscape(A4))
    
    # Background gradient (simulated with rectangles)
    from reportlab.lib.colors import HexColor
    c.setFillColor(HexColor('#F0F9FF'))
    c.rect(0, 0, width, height, fill=True, stroke=False)
    
    # Border
    c.setStrokeColor(HexColor('#2563EB'))
    c.setLineWidth(3)
    c.rect(1*cm, 1*cm, width-2*cm, height-2*cm)
    
    # === IKKALA LOGO ===
    # ILDIZ Logo (left top)
    ildiz_logo_path = os.path.join(settings.STATIC_ROOT, 'images/ildiz_logo.png')
    if os.path.exists(ildiz_logo_path):
        c.drawImage(ildiz_logo_path, 2*cm, height-4.5*cm, width=3.5*cm, height=3*cm, preserveAspectRatio=True, mask='auto')
    
    # Library Logo (right top) - YANGI!
    library = participant.session.library
    if library.logo:
        try:
            logo_path = library.logo.path
            c.drawImage(logo_path, width-5.5*cm, height-4.5*cm, width=3.5*cm, height=3*cm, preserveAspectRatio=True, mask='auto')
        except Exception as e:
            print(f"Logo error: {e}")
    
    # === HEADER ===
    c.setFont("Helvetica-Bold", 28)
    c.setFillColor(HexColor('#1E40AF'))
    c.drawCentredString(width/2, height-5*cm, "MOCK IELTS TEST CERTIFICATE")
    
    # === STUDENT NAME ===
    c.setFont("Helvetica", 14)
    c.setFillColor(HexColor('#374151'))
    c.drawCentredString(width/2, height-7*cm, "This is to certify that")
    
    c.setFont("Helvetica-Bold", 24)
    c.setFillColor(HexColor('#111827'))
    c.drawCentredString(width/2, height-8.5*cm, participant.full_name.upper())
    
    # === OVERALL BAND SCORE (Big Box) ===
    box_y = height - 13*cm
    box_size = 4*cm
    
    # Box
    c.setFillColor(HexColor('#DBEAFE'))
    c.setStrokeColor(HexColor('#2563EB'))
    c.setLineWidth(2)
    c.roundRect(width/2 - box_size/2, box_y, box_size, box_size, 10, fill=True, stroke=True)
    
    # Overall Score
    c.setFont("Helvetica", 12)
    c.setFillColor(HexColor('#1E40AF'))
    c.drawCentredString(width/2, box_y + box_size - 0.8*cm, "Overall Band Score")
    
    c.setFont("Helvetica-Bold", 48)
    c.setFillColor(HexColor('#2563EB'))
    c.drawCentredString(width/2, box_y + 1.5*cm, str(participant.overall_band_score))
    
    # === SECTION SCORES ===
    section_y = box_y - 2*cm
    sections = [
        ('LISTENING', participant.listening_score),
        ('READING', participant.reading_score),
        ('WRITING', participant.writing_score),
        ('SPEAKING', participant.speaking_score),
    ]
    
    section_width = width / 5
    start_x = section_width
    
    for i, (name, score) in enumerate(sections):
        x = start_x + (i * section_width)
        
        # Score box
        c.setFillColor(HexColor('#F3F4F6'))
        c.roundRect(x - 1.5*cm, section_y, 3*cm, 1.5*cm, 8, fill=True, stroke=False)
        
        # Name
        c.setFont("Helvetica", 10)
        c.setFillColor(HexColor('#6B7280'))
        c.drawCentredString(x, section_y + 1*cm, name)
        
        # Score
        c.setFont("Helvetica-Bold", 20)
        c.setFillColor(HexColor('#111827'))
        c.drawCentredString(x, section_y + 0.3*cm, str(score))
    
    # === FOOTER with Library Info ===
    footer_y = 2.5*cm
    
    c.setFont("Helvetica-Bold", 12)
    c.setFillColor(HexColor('#111827'))
    c.drawCentredString(width/2, footer_y + 1.5*cm, library.name)
    
    # Address - YANGI!
    if library.address:
        c.setFont("Helvetica", 9)
        c.setFillColor(HexColor('#6B7280'))
        c.drawCentredString(width/2, footer_y + 1*cm, library.address)
    
    # Contact info
    contact_parts = []
    if library.phone:
        contact_parts.append(f"Tel: {library.phone}")
    if library.email:
        contact_parts.append(f"Email: {library.email}")
    if library.website:
        contact_parts.append(library.website)
    
    if contact_parts:
        c.setFont("Helvetica", 8)
        c.setFillColor(HexColor('#9CA3AF'))
        c.drawCentredString(width/2, footer_y + 0.5*cm, " | ".join(contact_parts))
    
    # ILDIZ Platform watermark
    c.setFont("Helvetica-Oblique", 8)
    c.setFillColor(HexColor('#D1D5DB'))
    c.drawCentredString(width/2, footer_y, "Powered by ILDIZ Mock Platform")
    
    # Date
    c.setFont("Helvetica", 9)
    c.setFillColor(HexColor('#6B7280'))
    c.drawRightString(width - 2*cm, footer_y, f"Date: {participant.session.date.strftime('%d %B %Y')}")
    
    c.showPage()
    c.save()
    
    buffer.seek(0)
    return buffer
```

---

## 5️⃣ URL ROUTING

**Fayl:** `urls.py`

```python
urlpatterns = [
    # ... mavjud patterns
    
    # Modern Admin
    path('admin/dashboard/', core_views.admin_dashboard, name='admin_dashboard'),
    path('admin/settings/', core_views.library_settings, name='library_settings'),
]
```

---

## 🧪 SINOV (TESTING)

### Test Ssenariysi:

1. **Logo Upload Test**
   - Library settings'ga kiring
   - Logo yuklang (PNG/JPG)
   - Save qiling
   - Logo dashboard'da ko'rinishi kerak

2. **Address va Contact Test**
   - Manzil, telefon, email kiriting
   - Save qiling
   - Certificate yuklab oling
   - Footer'da ko'rinishi kerak

3. **Dashboard Test**
   - `/admin/dashboard/` ga kiring
   - Barcha stat kartalar to'ldirilgan
   - Chartlar render bo'lgan
   - Sidebar navigation ishlaydi

4. **Certificate Test**
   - Bir talaba uchun certificate download qiling
   - Ikkala logo bor (ILDIZ + Library)
   - Manzil footer'da
   - Professional ko'rinish

---

## ✅ ACCEPTANCE CRITERIA

### Logo & Address:
1. ✅ Logo upload ishlaydi
2. ✅ PNG, JPG, SVG qabul qilinadi
3. ✅ Address, phone, email save bo'ladi
4. ✅ Certificate'da ikkala logo
5. ✅ Certificate footer'da manzil

### Modern UI:
6. ✅ Dashboard zamonaviy (rasmlardagi kabi)
7. ✅ Stat kartalar rangdor va animatsiyali
8. ✅ Chart.js chartlar render
9. ✅ Sidebar navigation clean
10. ✅ Responsive design

### UX:
11. ✅ Oson navigation
12. ✅ Clear sections
13. ✅ Professional ko'rinish
14. ✅ Fast loading

---

## 📦 MIGRATION

```bash
python manage.py makemigrations
python manage.py migrate
```

---

## 🎯 KEYINGI ETAP

**ETAP 10 nima bo'lsin?**

1. **Test Creation - JUDA OSON**
   - Visual wizard
   - Drag-and-drop questions
   - Inline editing
   - Auto-save

2. **Mobile Responsive**
   - Touch-friendly
   - Mobile navigation
   - Responsive tables

3. **Email Notifications**
   - Test tugaganda email
   - Baholanganda email
   - Ustoz'ga notification

**Qaysi birini yozaylik?** 😊

Yoki test yaratish ETAP 8'da wizard bor edi - uni to'liq implement qilamizmi?
