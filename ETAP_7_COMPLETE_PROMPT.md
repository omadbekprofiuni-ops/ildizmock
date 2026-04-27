# ETAP 7: CO-BRANDING + ANALYTICS - FINAL ETAP

**Maqsad:** Har bir markaz o'z brendini ko'rsatadi (logo, ranglar), admin va ustoz uchun batafsil statistika va analytics dashboard, Excel export funksiyasi. Bu - platformaning oxirgi professional touch'i.

---

## 📋 CO-BRANDING + ANALYTICS QISMLARI

### 1. Co-Branding
- Har markaz o'z logosini yuklaydi
- Login sahifasida: ILDIZ logo + Markaz logo
- Test interface headerida markaz logosi
- Sertifikatda markaz logosi
- Optional: markaz ranglari (primary color)
- Optional: subdomain (taredu.ildizmock.uz)

### 2. Admin Analytics
- Dashboard statistika
- Chart.js chartlar: score distribution, trend
- Test performance analytics
- Student performance tracking
- Excel export

### 3. Teacher Analytics
- Baholash statistika
- Activity timeline
- Average grading time

---

## 🔧 QILINISHI KERAK ISHLAR

---

## 1️⃣ CO-BRANDING: LIBRARY MODEL YANGILANISHI

### A) Model Update

**Fayl:** `core/models.py` (yoki qayerda Library model joylashgan)

```python
from django.db import models
from colorfield.fields import ColorField  # pip install django-colorfield

class Library(models.Model):
    """EDU Center / Kutubxona"""
    name = models.CharField(max_length=200)
    
    # YANGI: Branding
    logo = models.ImageField(
        upload_to='library_logos/',
        blank=True,
        null=True,
        help_text='Markaz logosi (PNG yoki SVG, transparent background tavsiya etiladi)'
    )
    
    primary_color = ColorField(
        default='#2563EB',  # Blue
        help_text='Markaz asosiy rangi (buttons, links uchun)'
    )
    
    # Contact info
    address = models.TextField(blank=True)
    phone = models.CharField(max_length=50, blank=True)
    email = models.EmailField(blank=True)
    website = models.URLField(blank=True)
    
    # Subdomain (optional)
    subdomain = models.SlugField(
        max_length=50,
        unique=True,
        blank=True,
        null=True,
        help_text='Misol: taredu (taredu.ildizmock.uz)'
    )
    
    # Settings
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'libraries'
        ordering = ['name']
    
    def __str__(self):
        return self.name
    
    def get_primary_color_rgb(self):
        """Hex to RGB conversion for dynamic CSS"""
        hex_color = self.primary_color.lstrip('#')
        return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
```

---

### B) Migration

```bash
pip install django-colorfield Pillow
```

**requirements.txt:**
```
django-colorfield>=0.11.0
Pillow>=10.0.0
```

```bash
python manage.py makemigrations
python manage.py migrate
```

---

## 2️⃣ CO-BRANDING: LOGO INTEGRATION

### A) Base Template Update

**Fayl:** `templates/base.html` (admin/teacher uchun)

```html
<!DOCTYPE html>
<html lang="uz">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{% block title %}ILDIZ Mock{% endblock %}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    
    <!-- Dynamic CSS based on library colors -->
    {% if request.user.library %}
    <style>
        :root {
            --primary-color: {{ request.user.library.primary_color }};
            --primary-rgb: {{ request.user.library.get_primary_color_rgb.0 }}, {{ request.user.library.get_primary_color_rgb.1 }}, {{ request.user.library.get_primary_color_rgb.2 }};
        }
        
        .btn-primary {
            background-color: var(--primary-color) !important;
        }
        
        .text-primary {
            color: var(--primary-color) !important;
        }
        
        .border-primary {
            border-color: var(--primary-color) !important;
        }
        
        .bg-primary-50 {
            background-color: rgba(var(--primary-rgb), 0.1) !important;
        }
    </style>
    {% endif %}
</head>
<body class="bg-gray-50">
    <!-- Header with logos -->
    <nav class="bg-white shadow">
        <div class="max-w-7xl mx-auto px-4">
            <div class="flex justify-between items-center h-16">
                <div class="flex items-center gap-4">
                    <!-- ILDIZ Logo -->
                    <div class="flex items-center gap-2">
                        <div class="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                            <span class="text-white font-bold text-lg">IL</span>
                        </div>
                        <span class="text-xl font-bold text-gray-900">ILDIZ Mock</span>
                    </div>
                    
                    <!-- Separator -->
                    {% if request.user.library and request.user.library.logo %}
                    <div class="h-8 w-px bg-gray-300"></div>
                    
                    <!-- Library Logo -->
                    <div class="flex items-center gap-2">
                        <img src="{{ request.user.library.logo.url }}" 
                             alt="{{ request.user.library.name }}"
                             class="h-10 w-auto object-contain">
                        <span class="text-sm text-gray-600">{{ request.user.library.name }}</span>
                    </div>
                    {% endif %}
                </div>
                
                <!-- Navigation -->
                <div class="flex items-center gap-6">
                    <!-- ... menu items ... -->
                </div>
            </div>
        </div>
    </nav>
    
    <!-- Content -->
    {% block content %}{% endblock %}
</body>
</html>
```

---

### B) Student Login Page with Co-branding

**Fayl:** `mock/templates/mock/student_login.html`

```html
<!DOCTYPE html>
<html lang="uz">
<head>
    <meta charset="UTF-8">
    <title>Login - {{ library.name }}</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
    <div class="min-h-screen flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
            <!-- Logos -->
            <div class="flex items-center justify-center gap-4 mb-8">
                <!-- ILDIZ Logo -->
                <div class="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                    <span class="text-white font-bold text-2xl">IL</span>
                </div>
                
                {% if library.logo %}
                <!-- Separator -->
                <div class="h-12 w-px bg-gray-300"></div>
                
                <!-- Library Logo -->
                <img src="{{ library.logo.url }}" 
                     alt="{{ library.name }}"
                     class="h-16 w-auto object-contain">
                {% endif %}
            </div>
            
            <div class="text-center mb-8">
                <h1 class="text-3xl font-bold text-gray-900">Talaba Kabineti</h1>
                <p class="text-gray-600 mt-2">{{ library.name }}</p>
            </div>
            
            <!-- Login form ... -->
        </div>
    </div>
</body>
</html>
```

---

### C) Certificate Update

**Fayl:** `mock/certificate.py` - `generate_certificate()` funksiyasi

```python
def generate_certificate(participant):
    """Mock IELTS sertifikat yaratish - co-branded"""
    
    buffer = BytesIO()
    width, height = landscape(A4)
    c = canvas.Canvas(buffer, pagesize=landscape(A4))
    
    # ... background, border, watermark (oldingi kodni saqlang)
    
    # === LOGOS ===
    # ILDIZ Logo (left)
    ildiz_logo_path = os.path.join(settings.STATIC_ROOT, 'images/ildiz_logo.png')
    if os.path.exists(ildiz_logo_path):
        c.drawImage(ildiz_logo_path, 3*cm, height-5*cm, width=4*cm, height=3*cm, preserveAspectRatio=True)
    
    # Library Logo (right) - YANGI
    if participant.session.library.logo:
        try:
            logo_path = participant.session.library.logo.path
            c.drawImage(logo_path, width-7*cm, height-5*cm, width=4*cm, height=3*cm, preserveAspectRatio=True, mask='auto')
        except Exception as e:
            print(f"Logo error: {e}")
    
    # === FOOTER with Library Info ===
    c.setFont("Helvetica", 10)
    c.setFillColorRGB(0.5, 0.5, 0.5)
    c.drawCentredString(width/2, 2.5*cm, participant.session.library.name)
    
    if participant.session.library.website:
        c.drawCentredString(width/2, 2.2*cm, participant.session.library.website)
    
    c.drawCentredString(width/2, 1.8*cm, "ILDIZ Mock Platform | Practice Test Certificate")
    
    c.showPage()
    c.save()
    
    buffer.seek(0)
    return buffer
```

---

## 3️⃣ ADMIN ANALYTICS DASHBOARD

### A) View

**Fayl:** `mock/views.py`

```python
from django.db.models import Count, Avg, Max, Min, Q
from django.utils import timezone
from datetime import timedelta

@login_required
def admin_analytics_dashboard(request):
    """Admin uchun batafsil analytics"""
    
    library = request.user.library
    
    # === BASIC STATISTICS ===
    total_students = StudentProfile.objects.filter(library=library).count()
    
    total_mock_sessions = MockSession.objects.filter(library=library).count()
    
    total_participants = MockParticipant.objects.filter(
        session__library=library
    ).count()
    
    completed_tests = MockParticipant.objects.filter(
        session__library=library,
        overall_band_score__isnull=False
    ).count()
    
    # === AVERAGE SCORES ===
    avg_scores = MockParticipant.objects.filter(
        session__library=library,
        overall_band_score__isnull=False
    ).aggregate(
        avg_overall=Avg('overall_band_score'),
        avg_listening=Avg('listening_score'),
        avg_reading=Avg('reading_score'),
        avg_writing=Avg('writing_score'),
        avg_speaking=Avg('speaking_score'),
        max_overall=Max('overall_band_score'),
        min_overall=Min('overall_band_score'),
    )
    
    # === SCORE DISTRIBUTION (for Chart.js) ===
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
    
    # === RECENT ACTIVITY (last 30 days) ===
    thirty_days_ago = timezone.now() - timedelta(days=30)
    
    recent_sessions = MockSession.objects.filter(
        library=library,
        date__gte=thirty_days_ago
    ).order_by('-date')[:10]
    
    # === MONTHLY TREND (last 6 months) ===
    monthly_data = []
    for i in range(6):
        month_start = timezone.now() - timedelta(days=30 * i)
        month_end = timezone.now() - timedelta(days=30 * (i - 1)) if i > 0 else timezone.now()
        
        count = MockParticipant.objects.filter(
            session__library=library,
            session__date__gte=month_start,
            session__date__lt=month_end,
            overall_band_score__isnull=False
        ).count()
        
        avg_score = MockParticipant.objects.filter(
            session__library=library,
            session__date__gte=month_start,
            session__date__lt=month_end,
            overall_band_score__isnull=False
        ).aggregate(avg=Avg('overall_band_score'))['avg'] or 0
        
        monthly_data.insert(0, {
            'month': month_start.strftime('%b %Y'),
            'count': count,
            'avg_score': round(avg_score, 1) if avg_score else 0
        })
    
    # === SECTION PERFORMANCE ===
    section_avg = {
        'listening': avg_scores['avg_listening'] or 0,
        'reading': avg_scores['avg_reading'] or 0,
        'writing': avg_scores['avg_writing'] or 0,
        'speaking': avg_scores['avg_speaking'] or 0,
    }
    
    # === TOP PERFORMERS ===
    top_students = MockParticipant.objects.filter(
        session__library=library,
        overall_band_score__isnull=False
    ).order_by('-overall_band_score')[:10]
    
    return render(request, 'mock/admin_analytics.html', {
        'total_students': total_students,
        'total_mock_sessions': total_mock_sessions,
        'total_participants': total_participants,
        'completed_tests': completed_tests,
        'avg_scores': avg_scores,
        'score_distribution': score_distribution,
        'recent_sessions': recent_sessions,
        'monthly_data': monthly_data,
        'section_avg': section_avg,
        'top_students': top_students,
    })
```

---

### B) Template

**Fayl:** `mock/templates/mock/admin_analytics.html`

```html
{% extends 'base.html' %}

{% block content %}
<div class="max-w-7xl mx-auto py-8 px-4">
    <h1 class="text-3xl font-bold mb-8">📊 Analytics Dashboard</h1>
    
    <!-- Quick Stats -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div class="bg-white rounded-lg shadow p-6">
            <p class="text-sm text-gray-500 mb-1">Jami Talabalar</p>
            <p class="text-4xl font-bold text-blue-600">{{ total_students }}</p>
        </div>
        
        <div class="bg-white rounded-lg shadow p-6">
            <p class="text-sm text-gray-500 mb-1">Mock Sessiyalar</p>
            <p class="text-4xl font-bold text-purple-600">{{ total_mock_sessions }}</p>
        </div>
        
        <div class="bg-white rounded-lg shadow p-6">
            <p class="text-sm text-gray-500 mb-1">Tugallangan Testlar</p>
            <p class="text-4xl font-bold text-green-600">{{ completed_tests }}</p>
        </div>
        
        <div class="bg-white rounded-lg shadow p-6">
            <p class="text-sm text-gray-500 mb-1">O'rtacha Overall</p>
            <p class="text-4xl font-bold text-orange-600">{{ avg_scores.avg_overall|floatformat:1 }}</p>
        </div>
    </div>
    
    <!-- Charts Row 1 -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <!-- Score Distribution -->
        <div class="bg-white rounded-lg shadow p-6">
            <h2 class="text-xl font-bold mb-4">Score Distribution</h2>
            <canvas id="scoreDistributionChart" height="250"></canvas>
        </div>
        
        <!-- Section Performance -->
        <div class="bg-white rounded-lg shadow p-6">
            <h2 class="text-xl font-bold mb-4">Section O'rtacha Ballar</h2>
            <canvas id="sectionPerformanceChart" height="250"></canvas>
        </div>
    </div>
    
    <!-- Monthly Trend -->
    <div class="bg-white rounded-lg shadow p-6 mb-8">
        <h2 class="text-xl font-bold mb-4">6 Oylik Trend</h2>
        <canvas id="monthlyTrendChart" height="100"></canvas>
    </div>
    
    <!-- Top Performers -->
    <div class="bg-white rounded-lg shadow p-6 mb-8">
        <div class="flex items-center justify-between mb-4">
            <h2 class="text-xl font-bold">Top 10 Talabalar</h2>
            <a href="{% url 'admin_export_excel' %}" 
               class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
                📥 Excel Export
            </a>
        </div>
        
        <div class="overflow-x-auto">
            <table class="w-full">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-4 py-3 text-left">#</th>
                        <th class="px-4 py-3 text-left">Ism</th>
                        <th class="px-4 py-3 text-center">L</th>
                        <th class="px-4 py-3 text-center">R</th>
                        <th class="px-4 py-3 text-center">W</th>
                        <th class="px-4 py-3 text-center">S</th>
                        <th class="px-4 py-3 text-center">Overall</th>
                        <th class="px-4 py-3 text-center">Sana</th>
                    </tr>
                </thead>
                <tbody>
                    {% for student in top_students %}
                    <tr class="border-t">
                        <td class="px-4 py-3 font-bold">{{ forloop.counter }}</td>
                        <td class="px-4 py-3">{{ student.full_name }}</td>
                        <td class="px-4 py-3 text-center">{{ student.listening_score|floatformat:1 }}</td>
                        <td class="px-4 py-3 text-center">{{ student.reading_score|floatformat:1 }}</td>
                        <td class="px-4 py-3 text-center">{{ student.writing_score|floatformat:1 }}</td>
                        <td class="px-4 py-3 text-center">{{ student.speaking_score|floatformat:1 }}</td>
                        <td class="px-4 py-3 text-center">
                            <span class="text-xl font-bold text-green-600">{{ student.overall_band_score|floatformat:1 }}</span>
                        </td>
                        <td class="px-4 py-3 text-center text-sm">{{ student.session.date|date:"d M Y" }}</td>
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
                    <p class="text-sm text-gray-600">{{ session.date|date:"d M Y" }}</p>
                </div>
                
                <div class="text-right">
                    <p class="text-sm text-gray-500">{{ session.participants.count }} talaba</p>
                    <a href="{% url 'mock_results' session.id %}" class="text-blue-600 hover:underline text-sm">
                        Natijalar →
                    </a>
                </div>
            </div>
            {% endfor %}
        </div>
    </div>
</div>

<!-- Chart.js -->
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<script>
// Score Distribution Chart
const scoreDistCtx = document.getElementById('scoreDistributionChart').getContext('2d');
new Chart(scoreDistCtx, {
    type: 'bar',
    data: {
        labels: [{% for item in score_distribution %}'{{ item.label }}',{% endfor %}],
        datasets: [{
            label: 'Talabalar soni',
            data: [{% for item in score_distribution %}{{ item.count }},{% endfor %}],
            backgroundColor: 'rgba(37, 99, 235, 0.8)',
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: {
                beginAtZero: true,
                ticks: { stepSize: 1 }
            }
        }
    }
});

// Section Performance Chart
const sectionCtx = document.getElementById('sectionPerformanceChart').getContext('2d');
new Chart(sectionCtx, {
    type: 'radar',
    data: {
        labels: ['Listening', 'Reading', 'Writing', 'Speaking'],
        datasets: [{
            label: 'O\'rtacha Band Score',
            data: [
                {{ section_avg.listening|floatformat:1 }},
                {{ section_avg.reading|floatformat:1 }},
                {{ section_avg.writing|floatformat:1 }},
                {{ section_avg.speaking|floatformat:1 }}
            ],
            backgroundColor: 'rgba(34, 197, 94, 0.2)',
            borderColor: 'rgb(34, 197, 94)',
            borderWidth: 2,
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            r: {
                beginAtZero: true,
                max: 9,
                ticks: { stepSize: 1 }
            }
        }
    }
});

// Monthly Trend Chart
const trendCtx = document.getElementById('monthlyTrendChart').getContext('2d');
new Chart(trendCtx, {
    type: 'line',
    data: {
        labels: [{% for item in monthly_data %}'{{ item.month }}',{% endfor %}],
        datasets: [
            {
                label: 'Testlar soni',
                data: [{% for item in monthly_data %}{{ item.count }},{% endfor %}],
                borderColor: 'rgb(59, 130, 246)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                yAxisID: 'y',
            },
            {
                label: 'O\'rtacha Ball',
                data: [{% for item in monthly_data %}{{ item.avg_score }},{% endfor %}],
                borderColor: 'rgb(249, 115, 22)',
                backgroundColor: 'rgba(249, 115, 22, 0.1)',
                yAxisID: 'y1',
            }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: {
                type: 'linear',
                display: true,
                position: 'left',
                title: { display: true, text: 'Testlar soni' }
            },
            y1: {
                type: 'linear',
                display: true,
                position: 'right',
                title: { display: true, text: 'O\'rtacha Ball' },
                grid: { drawOnChartArea: false },
                max: 9
            }
        }
    }
});
</script>
{% endblock %}
```

---

## 4️⃣ TEACHER ANALYTICS

### A) View Update

**Fayl:** `mock/views.py` - `teacher_dashboard` ni yangilash

```python
@login_required
def teacher_dashboard(request):
    """Ustoz dashboard - batafsil statistika bilan"""
    
    # Pending counts (ETAP 4 dan)
    writing_pending = MockParticipant.objects.filter(
        session__library=request.user.library,
        writing_status='pending',
        writing_task1_text__isnull=False,
    ).count()
    
    speaking_pending = MockParticipant.objects.filter(
        session__library=request.user.library,
        speaking_status='pending',
    ).count()
    
    # YANGI: Grading Statistics
    from datetime import timedelta
    from django.utils import timezone
    
    # Last 7 days
    seven_days_ago = timezone.now() - timedelta(days=7)
    
    recent_writings = MockParticipant.objects.filter(
        session__library=request.user.library,
        writing_graded_by=request.user,
        writing_graded_at__gte=seven_days_ago
    ).count()
    
    recent_speakings = MockParticipant.objects.filter(
        session__library=request.user.library,
        speaking_graded_by=request.user,
        speaking_graded_at__gte=seven_days_ago
    ).count()
    
    # Total graded
    total_writings = MockParticipant.objects.filter(
        session__library=request.user.library,
        writing_graded_by=request.user
    ).count()
    
    total_speakings = MockParticipant.objects.filter(
        session__library=request.user.library,
        speaking_graded_by=request.user
    ).count()
    
    # Average scores (ustoz bergan)
    avg_writing = MockParticipant.objects.filter(
        session__library=request.user.library,
        writing_graded_by=request.user,
        writing_score__isnull=False
    ).aggregate(avg=Avg('writing_score'))['avg']
    
    avg_speaking = MockParticipant.objects.filter(
        session__library=request.user.library,
        speaking_graded_by=request.user,
        speaking_score__isnull=False
    ).aggregate(avg=Avg('speaking_score'))['avg']
    
    # YANGI: Daily activity chart (last 7 days)
    daily_activity = []
    for i in range(7):
        day = timezone.now() - timedelta(days=6-i)
        day_start = day.replace(hour=0, minute=0, second=0)
        day_end = day.replace(hour=23, minute=59, second=59)
        
        w_count = MockParticipant.objects.filter(
            session__library=request.user.library,
            writing_graded_by=request.user,
            writing_graded_at__gte=day_start,
            writing_graded_at__lte=day_end
        ).count()
        
        s_count = MockParticipant.objects.filter(
            session__library=request.user.library,
            speaking_graded_by=request.user,
            speaking_graded_at__gte=day_start,
            speaking_graded_at__lte=day_end
        ).count()
        
        daily_activity.append({
            'date': day.strftime('%a'),  # Mon, Tue, Wed
            'writing': w_count,
            'speaking': s_count,
        })
    
    return render(request, 'mock/teacher_dashboard.html', {
        'writing_pending': writing_pending,
        'speaking_pending': speaking_pending,
        'recent_writings': recent_writings,
        'recent_speakings': recent_speakings,
        'total_writings': total_writings,
        'total_speakings': total_speakings,
        'avg_writing': avg_writing,
        'avg_speaking': avg_speaking,
        'daily_activity': daily_activity,
    })
```

---

### B) Template Update

**Fayl:** `mock/templates/mock/teacher_dashboard.html`

```html
{% extends 'base.html' %}

{% block content %}
<div class="max-w-6xl mx-auto py-8">
    <h1 class="text-3xl font-bold mb-8">👨‍🏫 Ustoz Paneli</h1>
    
    <!-- Quick Stats -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div class="bg-white rounded-lg shadow p-4">
            <p class="text-sm text-gray-500 mb-1">Writing kutilmoqda</p>
            <p class="text-4xl font-bold text-orange-600">{{ writing_pending }}</p>
        </div>
        
        <div class="bg-white rounded-lg shadow p-4">
            <p class="text-sm text-gray-500 mb-1">Speaking kutilmoqda</p>
            <p class="text-4xl font-bold text-blue-600">{{ speaking_pending }}</p>
        </div>
        
        <div class="bg-white rounded-lg shadow p-4">
            <p class="text-sm text-gray-500 mb-1">Jami Writing</p>
            <p class="text-4xl font-bold text-green-600">{{ total_writings }}</p>
        </div>
        
        <div class="bg-white rounded-lg shadow p-4">
            <p class="text-sm text-gray-500 mb-1">Jami Speaking</p>
            <p class="text-4xl font-bold text-purple-600">{{ total_speakings }}</p>
        </div>
    </div>
    
    <!-- Charts -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <!-- Daily Activity -->
        <div class="bg-white rounded-lg shadow p-6">
            <h2 class="text-xl font-bold mb-4">Oxirgi 7 Kun</h2>
            <canvas id="dailyActivityChart" height="200"></canvas>
        </div>
        
        <!-- Average Scores -->
        <div class="bg-white rounded-lg shadow p-6">
            <h2 class="text-xl font-bold mb-4">O'rtacha Ballar</h2>
            
            <div class="space-y-4">
                <div>
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-sm text-gray-600">Writing</span>
                        <span class="text-2xl font-bold text-orange-600">{{ avg_writing|floatformat:1|default:'-' }}</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2">
                        <div class="bg-orange-600 h-2 rounded-full" style="width: {{ avg_writing|default:0|floatformat:0|divisibleby:9|multiply:100 }}%"></div>
                    </div>
                </div>
                
                <div>
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-sm text-gray-600">Speaking</span>
                        <span class="text-2xl font-bold text-blue-600">{{ avg_speaking|floatformat:1|default:'-' }}</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2">
                        <div class="bg-blue-600 h-2 rounded-full" style="width: {{ avg_speaking|default:0|floatformat:0|divisibleby:9|multiply:100 }}%"></div>
                    </div>
                </div>
                
                <p class="text-xs text-gray-500 mt-4">
                    Oxirgi 7 kun: {{ recent_writings }} Writing, {{ recent_speakings }} Speaking baholandi
                </p>
            </div>
        </div>
    </div>
    
    <!-- Actions -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <a href="{% url 'writing_grading_queue' %}" 
           class="block bg-orange-600 hover:bg-orange-700 text-white rounded-lg shadow p-8 text-center transition">
            <h2 class="text-2xl font-bold mb-2">📝 Writing Baholash</h2>
            <p class="text-orange-100">{{ writing_pending }} ta kutilmoqda</p>
        </a>
        
        <a href="{% url 'speaking_grading_queue' %}" 
           class="block bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow p-8 text-center transition">
            <h2 class="text-2xl font-bold mb-2">🎤 Speaking Baholash</h2>
            <p class="text-blue-100">{{ speaking_pending }} ta kutilmoqda</p>
        </a>
    </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<script>
const ctx = document.getElementById('dailyActivityChart').getContext('2d');
new Chart(ctx, {
    type: 'bar',
    data: {
        labels: [{% for day in daily_activity %}'{{ day.date }}',{% endfor %}],
        datasets: [
            {
                label: 'Writing',
                data: [{% for day in daily_activity %}{{ day.writing }},{% endfor %}],
                backgroundColor: 'rgba(249, 115, 22, 0.8)',
            },
            {
                label: 'Speaking',
                data: [{% for day in daily_activity %}{{ day.speaking }},{% endfor %}],
                backgroundColor: 'rgba(59, 130, 246, 0.8)',
            }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: {
                beginAtZero: true,
                ticks: { stepSize: 1 }
            }
        }
    }
});
</script>
{% endblock %}
```

---

## 5️⃣ EXCEL EXPORT

### A) Install openpyxl

```bash
pip install openpyxl
```

**requirements.txt:**
```
openpyxl>=3.1.0
```

---

### B) View

**Fayl:** `mock/views.py`

```python
from django.http import HttpResponse
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill
from openpyxl.utils import get_column_letter

@login_required
def admin_export_excel(request):
    """Excel export - barcha natijalar"""
    
    library = request.user.library
    
    # Get all completed tests
    participants = MockParticipant.objects.filter(
        session__library=library,
        overall_band_score__isnull=False
    ).select_related('session').order_by('-session__date', 'full_name')
    
    # Create workbook
    wb = Workbook()
    ws = wb.active
    ws.title = "Mock Test Results"
    
    # Headers
    headers = [
        'Talaba', 'Sessiya', 'Sana', 
        'Listening', 'Reading', 'Writing', 'Speaking', 
        'Overall Band Score'
    ]
    
    # Style headers
    header_fill = PatternFill(start_color='2563EB', end_color='2563EB', fill_type='solid')
    header_font = Font(bold=True, color='FFFFFF')
    
    for col_num, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col_num)
        cell.value = header
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal='center', vertical='center')
    
    # Data rows
    for row_num, p in enumerate(participants, 2):
        ws.cell(row=row_num, column=1, value=p.full_name)
        ws.cell(row=row_num, column=2, value=p.session.name)
        ws.cell(row=row_num, column=3, value=p.session.date.strftime('%d.%m.%Y'))
        ws.cell(row=row_num, column=4, value=float(p.listening_score) if p.listening_score else '-')
        ws.cell(row=row_num, column=5, value=float(p.reading_score) if p.reading_score else '-')
        ws.cell(row=row_num, column=6, value=float(p.writing_score) if p.writing_score else '-')
        ws.cell(row=row_num, column=7, value=float(p.speaking_score) if p.speaking_score else '-')
        ws.cell(row=row_num, column=8, value=float(p.overall_band_score))
        
        # Center alignment for scores
        for col in range(4, 9):
            ws.cell(row=row_num, column=col).alignment = Alignment(horizontal='center')
    
    # Adjust column widths
    ws.column_dimensions['A'].width = 25  # Name
    ws.column_dimensions['B'].width = 30  # Session
    ws.column_dimensions['C'].width = 12  # Date
    for col in ['D', 'E', 'F', 'G', 'H']:
        ws.column_dimensions[col].width = 12
    
    # Summary section
    row_num = participants.count() + 3
    ws.cell(row=row_num, column=1, value="XULOSA").font = Font(bold=True, size=14)
    
    row_num += 1
    ws.cell(row=row_num, column=1, value="Jami testlar:")
    ws.cell(row=row_num, column=2, value=participants.count())
    
    row_num += 1
    avg_overall = participants.aggregate(avg=Avg('overall_band_score'))['avg']
    ws.cell(row=row_num, column=1, value="O'rtacha Overall:")
    ws.cell(row=row_num, column=2, value=round(avg_overall, 1) if avg_overall else 0)
    
    # Response
    response = HttpResponse(
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    response['Content-Disposition'] = f'attachment; filename="IELTS_Mock_Results_{library.name.replace(" ", "_")}.xlsx"'
    
    wb.save(response)
    return response
```

---

## 6️⃣ QUESTION PERFORMANCE ANALYTICS

### A) View

**Fayl:** `mock/views.py`

```python
@login_required
def test_performance_analytics(request, test_id):
    """Bitta test uchun batafsil analytics - qaysi savollar qiyin"""
    
    from django.db.models import Count, Q
    
    test = get_object_or_404(ListeningTest, id=test_id, library=request.user.library)
    
    # Get all participants who took this test
    participants = MockParticipant.objects.filter(
        listening_test=test,
        listening_score__isnull=False
    )
    
    total_participants = participants.count()
    
    if total_participants == 0:
        messages.info(request, 'Bu test hali hech kim topshirmagan')
        return redirect('admin_analytics_dashboard')
    
    # Analyze each question
    question_stats = []
    
    for section in test.sections.all():
        for q in section.questions.all():
            correct_count = 0
            
            for p in participants:
                user_answer = p.listening_answers.get(str(q.id), '').strip().lower()
                if user_answer == q.correct_answer.lower():
                    correct_count += 1
            
            incorrect_count = total_participants - correct_count
            success_rate = (correct_count / total_participants) * 100
            
            question_stats.append({
                'section': section.title,
                'question': q.question_text[:50] + '...' if len(q.question_text) > 50 else q.question_text,
                'correct_count': correct_count,
                'incorrect_count': incorrect_count,
                'success_rate': round(success_rate, 1),
                'difficulty': 'Easy' if success_rate >= 75 else 'Medium' if success_rate >= 50 else 'Hard'
            })
    
    return render(request, 'mock/test_performance.html', {
        'test': test,
        'total_participants': total_participants,
        'question_stats': question_stats,
    })
```

---

## 7️⃣ URL ROUTING

**Fayl:** `urls.py`

```python
urlpatterns = [
    # ... mavjud patterns
    
    # Analytics
    path('analytics/', mock_views.admin_analytics_dashboard, name='admin_analytics_dashboard'),
    path('analytics/export/', mock_views.admin_export_excel, name='admin_export_excel'),
    path('analytics/test/<int:test_id>/', mock_views.test_performance_analytics, name='test_performance_analytics'),
]
```

---

## 8️⃣ NAVIGATION UPDATE

Sidebar'ga analytics link qo'shish:

```html
{% if request.user.is_staff or request.user.role == 'admin' %}
<nav>
    <a href="{% url 'admin_analytics_dashboard' %}" class="...">
        📊 Analytics
    </a>
    <!-- ... boshqa linklar -->
</nav>
{% endif %}
```

---

## 🧪 SINOV (TESTING)

### Test Ssenariysi:

1. **Logo Upload**
   - Admin panelga kiring
   - Library edit sahifasiga
   - Logo yuklang (PNG/SVG)
   - Primary color tanlang
   - Save

2. **Co-branding Check**
   - Login sahifasiga kiring
   - Ikkala logo ko'rsatilishi kerak
   - Test interface headerida markaz logosi
   - Sertifikat yuklab oling - logo borligini tekshiring

3. **Analytics Dashboard**
   - `/analytics/` ga kiring
   - Barcha statistika kartalar to'ldirilganligini tekshiring
   - Chart.js chartlar render bo'lishi kerak
   - Interactive bo'lishi kerak (hover effects)

4. **Excel Export**
   - "Excel Export" tugmasini bosing
   - Fayl yuklanishi kerak
   - Excel ochib tekshiring:
     - Barcha talabalar
     - Barcha ballar
     - Formatlanish to'g'ri

5. **Teacher Analytics**
   - Ustoz sifatida login
   - Dashboard'da yangi chartlar ko'rinishi kerak
   - 7 kunlik activity chart
   - O'rtacha ballar

---

## ✅ ACCEPTANCE CRITERIA

### Co-Branding:
1. ✅ Admin logo yuklaydi
2. ✅ Login sahifasida ikkala logo
3. ✅ Test interface headerida markaz logosi
4. ✅ Sertifikatda markaz logosi
5. ✅ Primary color dinamik qo'llaniladi
6. ✅ Markaz ma'lumotlari footer'da

### Analytics:
7. ✅ Admin dashboard - to'liq statistika
8. ✅ Chart.js chartlar: bar, line, radar
9. ✅ Score distribution
10. ✅ Monthly trend (6 oy)
11. ✅ Top 10 talabalar
12. ✅ Teacher analytics - 7 kunlik activity
13. ✅ Excel export - formatlangan
14. ✅ Test performance analytics (savollar bo'yicha)

---

## 📦 MIGRATION VA DEPLOYMENT

### 1. Migration
```bash
pip install django-colorfield openpyxl Pillow
python manage.py makemigrations
python manage.py migrate
```

### 2. Static Files (ILDIZ Logo)
```bash
mkdir -p static/images
# ILDIZ logosini static/images/ ga joylashtiring
python manage.py collectstatic
```

### 3. Test Data
```python
python manage.py shell

>>> from core.models import Library
>>> lib = Library.objects.first()
>>> lib.primary_color = '#10B981'  # Green
>>> lib.save()
```

---

## 🎯 YAKUNIY XULOSA

**ETAP 7 tugagandan keyin:**

✅ **PROFESSIONAL CO-BRANDED PLATFORM**
- Har markaz o'z logosi
- Custom ranglar
- Brand consistency barcha joylarda

✅ **POWERFUL ANALYTICS**
- Real-time statistics
- Chart.js visualizations
- Excel export
- Performance tracking

✅ **COMPLETE IELTS MOCK PLATFORM**
- ETAP 1-7: Hammasi tugallangan
- Admin ✓ Teacher ✓ Student ✓
- Mock Mode ✓ Practice Mode ✓
- Analytics ✓ Export ✓

---

## 🎉 PLATFORMANGIZ TAYYOR!

Siz hozir **to'liq ishlaydigan, professional, production-ready IELTS Mock platformaga** ega bo'ldingiz:

### **Admin:**
- Test baza yaratadi (L/R/W)
- Mock sessiya boshqaradi
- Analytics ko'radi
- Excel export qiladi

### **Teacher:**
- Writing/Speaking baholaydi
- Statistika kuzatadi
- Feedback beradi

### **Student:**
- Mock testda qatnashadi
- Practice qiladi
- Progress kuzatadi
- Sertifikat oladi

### **Markaz:**
- O'z brendi bilan ishlaydi
- Logo va ranglar
- Professional ko'rinish

---

**BARCHA 7 ETAP PROMPTLARI TAYYOR!** 🚀

| # | Qatorlar |
|---|----------|
| ETAP 2.5 | 887 |
| ETAP 3 | 937 |
| ETAP 4 | 1,104 |
| ETAP 5 | 1,109 |
| ETAP 6 | 1,199 |
| ETAP 7 | [hozir yozildi] |
| **JAMI** | **~6,500+** |

Omad biznesingizda! 💪🎓📊
