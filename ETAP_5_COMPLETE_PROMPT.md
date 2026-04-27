# ETAP 5: TALABA PROFILI + SERTIFIKAT + PROGRESS TRACKING

**Maqsad:** Talaba o'z shaxsiy kabinetiga kirib, barcha mock test natijalarini ko'radi, progress grafigini kuzatadi va mock sertifikatni yuklab oladi.

---

## 📋 TALABA FUNKSIONALARI

### 1. Student Dashboard
- Talaba login qiladi (username/email + parol)
- Barcha o'tkazgan mock testlar ro'yxati
- Har test uchun: L/R/W/S/Overall ballar
- Test sanalari va statuslari

### 2. Progress Tracking
- Grafik: oxirgi 10 ta mock testdagi score dinamikasi
- Chart.js line chart - 5 ta chiziq (L, R, W, S, Overall)
- Trend ko'rsatkichi (yaxshilanish/yomonlashuv)

### 3. Mock Certificate
- PDF formatda professional sertifikat
- Talaba ismi, overall band score, test sanasi
- "MOCK IELTS TEST" watermark (haqiqiy test emas)
- Markaz logosi + ILDIZ platform logosi
- Download tugmasi

### 4. Test Detail Page
- Bitta test uchun batafsil ma'lumot
- Har section bo'yicha natija
- Writing feedback (agar ustoz yozgan bo'lsa)
- Speaking feedback

---

## 🔧 QILINISHI KERAK ISHLAR

---

## 1️⃣ STUDENT AUTHENTICATION

### A) Student User Model

2 ta variant:
- **Variant A:** Mavjud Django User modelidan foydalanish
- **Variant B:** Alohida Student model yaratish

**Tavsiya:** Variant A (oddiyroq, tezroq)

**Fayl:** `mock/models.py`

```python
from django.contrib.auth.models import User

class StudentProfile(models.Model):
    """Talaba profili"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='student_profile')
    library = models.ForeignKey('Library', on_delete=models.CASCADE)
    phone = models.CharField(max_length=20, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    
    # Profile picture (optional)
    photo = models.ImageField(upload_to='student_photos/', blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'student_profiles'
    
    def __str__(self):
        return f"{self.user.get_full_name()} ({self.library.name})"
    
    def get_mock_tests(self):
        """Talabaning barcha mock testlari"""
        return MockParticipant.objects.filter(
            full_name__icontains=self.user.get_full_name(),
            session__library=self.library
        ).select_related('session').order_by('-session__date')
    
    def get_latest_overall_score(self):
        """Eng oxirgi overall band score"""
        latest = self.get_mock_tests().filter(
            overall_band_score__isnull=False
        ).first()
        return latest.overall_band_score if latest else None
```

---

### B) Student Registration View

**Fayl:** `mock/views.py`

```python
from django.contrib.auth import login, authenticate
from django.contrib.auth.forms import AuthenticationForm
from django.shortcuts import render, redirect
from django.contrib import messages

def student_register(request):
    """Talaba ro'yxatdan o'tish"""
    
    if request.method == 'POST':
        # Basic validation
        full_name = request.POST.get('full_name')
        email = request.POST.get('email')
        phone = request.POST.get('phone')
        password = request.POST.get('password')
        library_id = request.POST.get('library')
        
        # Create User
        username = email.split('@')[0]  # email'dan username yaratish
        
        if User.objects.filter(username=username).exists():
            messages.error(request, 'Bu email allaqachon ro\'yxatdan o\'tgan')
            return redirect('student_register')
        
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=full_name.split()[0] if full_name else '',
            last_name=' '.join(full_name.split()[1:]) if len(full_name.split()) > 1 else ''
        )
        
        # Create StudentProfile
        StudentProfile.objects.create(
            user=user,
            library_id=library_id,
            phone=phone
        )
        
        # Auto-login
        login(request, user)
        
        messages.success(request, f'Xush kelibsiz, {full_name}!')
        return redirect('student_dashboard')
    
    # GET - form ko'rsatish
    libraries = Library.objects.all()
    return render(request, 'mock/student_register.html', {
        'libraries': libraries,
    })


def student_login(request):
    """Talaba login"""
    
    if request.method == 'POST':
        username = request.POST.get('username')
        password = request.POST.get('password')
        
        user = authenticate(request, username=username, password=password)
        
        if user is not None and hasattr(user, 'student_profile'):
            login(request, user)
            return redirect('student_dashboard')
        else:
            messages.error(request, 'Login yoki parol noto\'g\'ri')
    
    return render(request, 'mock/student_login.html')
```

---

### C) Login Template

**Fayl:** `mock/templates/mock/student_login.html`

```html
<!DOCTYPE html>
<html lang="uz">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Talaba Login</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
    <div class="min-h-screen flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
            <!-- Logo -->
            <div class="text-center mb-8">
                <h1 class="text-3xl font-bold text-gray-900">ILDIZ Mock</h1>
                <p class="text-gray-600 mt-2">Talaba Kabineti</p>
            </div>
            
            <!-- Error Messages -->
            {% if messages %}
            <div class="mb-6">
                {% for message in messages %}
                <div class="bg-red-50 border border-red-200 text-red-800 rounded p-3 text-sm">
                    {{ message }}
                </div>
                {% endfor %}
            </div>
            {% endif %}
            
            <!-- Login Form -->
            <form method="post" class="space-y-6">
                {% csrf_token %}
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                        Email yoki Username
                    </label>
                    <input type="text" name="username" required
                           class="w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:border-blue-500 focus:outline-none">
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                        Parol
                    </label>
                    <input type="password" name="password" required
                           class="w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:border-blue-500 focus:outline-none">
                </div>
                
                <button type="submit" 
                        class="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition">
                    Kirish
                </button>
            </form>
            
            <!-- Register Link -->
            <p class="text-center text-sm text-gray-600 mt-6">
                Akkauntingiz yo'qmi? 
                <a href="{% url 'student_register' %}" class="text-blue-600 hover:underline font-semibold">
                    Ro'yxatdan o'tish
                </a>
            </p>
        </div>
    </div>
</body>
</html>
```

---

## 2️⃣ STUDENT DASHBOARD

### A) View

**Fayl:** `mock/views.py`

```python
from django.contrib.auth.decorators import login_required

@login_required
def student_dashboard(request):
    """Talaba shaxsiy kabineti"""
    
    # Check if user is student
    if not hasattr(request.user, 'student_profile'):
        messages.error(request, 'Siz talaba emassiz')
        return redirect('student_login')
    
    profile = request.user.student_profile
    
    # Get all mock tests
    mock_tests = profile.get_mock_tests()
    
    # Latest score
    latest_score = profile.get_latest_overall_score()
    
    # Statistics
    total_tests = mock_tests.count()
    completed_tests = mock_tests.filter(overall_band_score__isnull=False).count()
    
    # Average scores
    completed = mock_tests.filter(overall_band_score__isnull=False)
    avg_overall = completed.aggregate(Avg('overall_band_score'))['overall_band_score__avg']
    avg_listening = completed.aggregate(Avg('listening_score'))['listening_score__avg']
    avg_reading = completed.aggregate(Avg('reading_score'))['reading_score__avg']
    avg_writing = completed.aggregate(Avg('writing_score'))['writing_score__avg']
    avg_speaking = completed.aggregate(Avg('speaking_score'))['speaking_score__avg']
    
    return render(request, 'mock/student_dashboard.html', {
        'profile': profile,
        'mock_tests': mock_tests,
        'latest_score': latest_score,
        'total_tests': total_tests,
        'completed_tests': completed_tests,
        'avg_overall': avg_overall,
        'avg_listening': avg_listening,
        'avg_reading': avg_reading,
        'avg_writing': avg_writing,
        'avg_speaking': avg_speaking,
    })
```

---

### B) Dashboard Template

**Fayl:** `mock/templates/mock/student_dashboard.html`

```html
{% extends 'student_base.html' %}

{% block content %}
<div class="max-w-7xl mx-auto py-8 px-4">
    <!-- Header -->
    <div class="bg-white rounded-lg shadow p-6 mb-8">
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-4">
                {% if profile.photo %}
                <img src="{{ profile.photo.url }}" alt="{{ request.user.get_full_name }}" 
                     class="w-16 h-16 rounded-full object-cover">
                {% else %}
                <div class="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-white text-2xl font-bold">
                    {{ request.user.first_name.0 }}{{ request.user.last_name.0 }}
                </div>
                {% endif %}
                
                <div>
                    <h1 class="text-2xl font-bold">{{ request.user.get_full_name }}</h1>
                    <p class="text-gray-600">{{ profile.library.name }}</p>
                </div>
            </div>
            
            {% if latest_score %}
            <div class="text-center">
                <p class="text-sm text-gray-500 mb-1">Oxirgi Overall Band</p>
                <p class="text-4xl font-bold text-blue-600">{{ latest_score|floatformat:1 }}</p>
            </div>
            {% endif %}
        </div>
    </div>
    
    <!-- Statistics -->
    <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div class="bg-white rounded-lg shadow p-4 text-center">
            <p class="text-sm text-gray-500 mb-1">Jami Testlar</p>
            <p class="text-3xl font-bold text-gray-900">{{ total_tests }}</p>
        </div>
        
        <div class="bg-white rounded-lg shadow p-4 text-center">
            <p class="text-sm text-gray-500 mb-1">O'rtacha L</p>
            <p class="text-3xl font-bold text-green-600">{{ avg_listening|floatformat:1|default:'-' }}</p>
        </div>
        
        <div class="bg-white rounded-lg shadow p-4 text-center">
            <p class="text-sm text-gray-500 mb-1">O'rtacha R</p>
            <p class="text-3xl font-bold text-blue-600">{{ avg_reading|floatformat:1|default:'-' }}</p>
        </div>
        
        <div class="bg-white rounded-lg shadow p-4 text-center">
            <p class="text-sm text-gray-500 mb-1">O'rtacha W</p>
            <p class="text-3xl font-bold text-orange-600">{{ avg_writing|floatformat:1|default:'-' }}</p>
        </div>
        
        <div class="bg-white rounded-lg shadow p-4 text-center">
            <p class="text-sm text-gray-500 mb-1">O'rtacha S</p>
            <p class="text-3xl font-bold text-purple-600">{{ avg_speaking|floatformat:1|default:'-' }}</p>
        </div>
    </div>
    
    <!-- Progress Chart -->
    <div class="bg-white rounded-lg shadow p-6 mb-8">
        <h2 class="text-xl font-bold mb-4">Progress</h2>
        <canvas id="progressChart" height="80"></canvas>
    </div>
    
    <!-- Mock Tests List -->
    <div class="bg-white rounded-lg shadow">
        <div class="p-6 border-b">
            <h2 class="text-xl font-bold">Mock Test Tarixi</h2>
        </div>
        
        <div class="overflow-x-auto">
            <table class="w-full">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-6 py-3 text-left">Sana</th>
                        <th class="px-6 py-3 text-left">Sessiya</th>
                        <th class="px-6 py-3 text-center">L</th>
                        <th class="px-6 py-3 text-center">R</th>
                        <th class="px-6 py-3 text-center">W</th>
                        <th class="px-6 py-3 text-center">S</th>
                        <th class="px-6 py-3 text-center">Overall</th>
                        <th class="px-6 py-3"></th>
                    </tr>
                </thead>
                <tbody>
                    {% for test in mock_tests %}
                    <tr class="border-t hover:bg-gray-50">
                        <td class="px-6 py-4">{{ test.session.date|date:"d M Y" }}</td>
                        <td class="px-6 py-4 text-sm text-gray-600">{{ test.session.name }}</td>
                        <td class="px-6 py-4 text-center font-semibold">{{ test.listening_score|floatformat:1|default:'-' }}</td>
                        <td class="px-6 py-4 text-center font-semibold">{{ test.reading_score|floatformat:1|default:'-' }}</td>
                        <td class="px-6 py-4 text-center font-semibold">{{ test.writing_score|floatformat:1|default:'-' }}</td>
                        <td class="px-6 py-4 text-center font-semibold">{{ test.speaking_score|floatformat:1|default:'-' }}</td>
                        <td class="px-6 py-4 text-center">
                            {% if test.overall_band_score %}
                            <span class="text-xl font-bold text-blue-600">{{ test.overall_band_score|floatformat:1 }}</span>
                            {% else %}
                            <span class="text-sm text-gray-400">Kutilmoqda</span>
                            {% endif %}
                        </td>
                        <td class="px-6 py-4 text-right">
                            <a href="{% url 'student_test_detail' test.id %}" 
                               class="text-blue-600 hover:underline">
                                Batafsil
                            </a>
                        </td>
                    </tr>
                    {% empty %}
                    <tr>
                        <td colspan="8" class="px-6 py-12 text-center text-gray-500">
                            Hali mock test topshirmadingiz
                        </td>
                    </tr>
                    {% endfor %}
                </tbody>
            </table>
        </div>
    </div>
</div>

<!-- Chart.js -->
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<script>
// Progress Chart
const ctx = document.getElementById('progressChart').getContext('2d');

// Data from Django
const testsData = [
    {% for test in mock_tests reversed %}
    {
        date: '{{ test.session.date|date:"d M" }}',
        listening: {{ test.listening_score|default:'null' }},
        reading: {{ test.reading_score|default:'null' }},
        writing: {{ test.writing_score|default:'null' }},
        speaking: {{ test.speaking_score|default:'null' }},
        overall: {{ test.overall_band_score|default:'null' }},
    },
    {% endfor %}
];

const labels = testsData.map(t => t.date);

new Chart(ctx, {
    type: 'line',
    data: {
        labels: labels,
        datasets: [
            {
                label: 'Overall',
                data: testsData.map(t => t.overall),
                borderColor: 'rgb(37, 99, 235)',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                borderWidth: 3,
                tension: 0.4,
            },
            {
                label: 'Listening',
                data: testsData.map(t => t.listening),
                borderColor: 'rgb(34, 197, 94)',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                borderWidth: 2,
                tension: 0.4,
            },
            {
                label: 'Reading',
                data: testsData.map(t => t.reading),
                borderColor: 'rgb(59, 130, 246)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 2,
                tension: 0.4,
            },
            {
                label: 'Writing',
                data: testsData.map(t => t.writing),
                borderColor: 'rgb(249, 115, 22)',
                backgroundColor: 'rgba(249, 115, 22, 0.1)',
                borderWidth: 2,
                tension: 0.4,
            },
            {
                label: 'Speaking',
                data: testsData.map(t => t.speaking),
                borderColor: 'rgb(168, 85, 247)',
                backgroundColor: 'rgba(168, 85, 247, 0.1)',
                borderWidth: 2,
                tension: 0.4,
            },
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
            },
        },
        scales: {
            y: {
                beginAtZero: true,
                max: 9,
                ticks: {
                    stepSize: 1
                }
            }
        }
    }
});
</script>
{% endblock %}
```

---

## 3️⃣ TEST DETAIL PAGE

### A) View

```python
@login_required
def student_test_detail(request, participant_id):
    """Bitta test uchun batafsil ma'lumot"""
    
    participant = get_object_or_404(
        MockParticipant,
        id=participant_id,
    )
    
    # Security: faqat o'z testlarini ko'rishi mumkin
    profile = request.user.student_profile
    if participant.full_name != request.user.get_full_name():
        messages.error(request, 'Bu test sizga tegishli emas')
        return redirect('student_dashboard')
    
    return render(request, 'mock/student_test_detail.html', {
        'participant': participant,
        'session': participant.session,
    })
```

---

### B) Template

```html
{% extends 'student_base.html' %}

{% block content %}
<div class="max-w-4xl mx-auto py-8 px-4">
    <!-- Back Button -->
    <a href="{% url 'student_dashboard' %}" 
       class="inline-block text-blue-600 hover:underline mb-6">
        ← Orqaga
    </a>
    
    <!-- Test Header -->
    <div class="bg-white rounded-lg shadow p-6 mb-6">
        <h1 class="text-2xl font-bold mb-2">{{ session.name }}</h1>
        <p class="text-gray-600">{{ session.date|date:"d M Y" }}</p>
        
        {% if participant.overall_band_score %}
        <div class="mt-4 text-center">
            <p class="text-sm text-gray-500">Overall Band Score</p>
            <p class="text-6xl font-bold text-blue-600">{{ participant.overall_band_score|floatformat:1 }}</p>
        </div>
        {% else %}
        <div class="mt-4 bg-yellow-50 border border-yellow-200 rounded p-4 text-center">
            <p class="text-yellow-800">Baholash jarayonida...</p>
        </div>
        {% endif %}
    </div>
    
    <!-- Scores Breakdown -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div class="bg-white rounded-lg shadow p-4 text-center">
            <p class="text-sm text-gray-500 mb-2">Listening</p>
            <p class="text-3xl font-bold text-green-600">{{ participant.listening_score|floatformat:1|default:'-' }}</p>
        </div>
        
        <div class="bg-white rounded-lg shadow p-4 text-center">
            <p class="text-sm text-gray-500 mb-2">Reading</p>
            <p class="text-3xl font-bold text-blue-600">{{ participant.reading_score|floatformat:1|default:'-' }}</p>
        </div>
        
        <div class="bg-white rounded-lg shadow p-4 text-center">
            <p class="text-sm text-gray-500 mb-2">Writing</p>
            <p class="text-3xl font-bold text-orange-600">{{ participant.writing_score|floatformat:1|default:'-' }}</p>
            {% if participant.writing_status == 'pending' %}
            <p class="text-xs text-gray-500 mt-1">Kutilmoqda</p>
            {% endif %}
        </div>
        
        <div class="bg-white rounded-lg shadow p-4 text-center">
            <p class="text-sm text-gray-500 mb-2">Speaking</p>
            <p class="text-3xl font-bold text-purple-600">{{ participant.speaking_score|floatformat:1|default:'-' }}</p>
            {% if participant.speaking_status == 'pending' %}
            <p class="text-xs text-gray-500 mt-1">Kutilmoqda</p>
            {% endif %}
        </div>
    </div>
    
    <!-- Writing Feedback -->
    {% if participant.writing_feedback %}
    <div class="bg-white rounded-lg shadow p-6 mb-6">
        <h2 class="text-lg font-bold mb-3">Writing Feedback</h2>
        <div class="bg-blue-50 border border-blue-200 rounded p-4">
            <p class="text-sm whitespace-pre-wrap">{{ participant.writing_feedback }}</p>
        </div>
    </div>
    {% endif %}
    
    <!-- Speaking Feedback -->
    {% if participant.speaking_feedback %}
    <div class="bg-white rounded-lg shadow p-6 mb-6">
        <h2 class="text-lg font-bold mb-3">Speaking Feedback</h2>
        <div class="bg-purple-50 border border-purple-200 rounded p-4">
            <p class="text-sm whitespace-pre-wrap">{{ participant.speaking_feedback }}</p>
        </div>
    </div>
    {% endif %}
    
    <!-- Certificate Download -->
    {% if participant.overall_band_score %}
    <div class="text-center">
        <a href="{% url 'student_certificate_download' participant.id %}" 
           class="inline-block bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 shadow-lg">
            📜 Sertifikatni Yuklab Olish
        </a>
    </div>
    {% endif %}
</div>
{% endblock %}
```

---

## 4️⃣ MOCK CERTIFICATE (PDF)

### A) Install Required Library

```bash
pip install reportlab Pillow
```

**Fayl:** `requirements.txt`
```
reportlab>=4.0.0
Pillow>=10.0.0
```

---

### B) Certificate Generator

**Yangi fayl:** `mock/certificate.py`

```python
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfgen import canvas
from reportlab.lib.units import cm
from reportlab.lib.utils import ImageReader
from io import BytesIO
from datetime import datetime
import os

def generate_certificate(participant):
    """Mock IELTS sertifikat yaratish"""
    
    buffer = BytesIO()
    
    # A4 landscape
    width, height = landscape(A4)
    c = canvas.Canvas(buffer, pagesize=landscape(A4))
    
    # === BACKGROUND ===
    # Gradient simulation (light blue to white)
    c.setFillColorRGB(0.95, 0.97, 1.0)
    c.rect(0, 0, width, height, fill=1, stroke=0)
    
    # Border
    c.setStrokeColorRGB(0.2, 0.4, 0.8)
    c.setLineWidth(3)
    c.rect(1.5*cm, 1.5*cm, width-3*cm, height-3*cm, fill=0, stroke=1)
    
    # === WATERMARK ===
    c.setFillColorRGB(0.9, 0.9, 0.9)
    c.setFont("Helvetica-Bold", 60)
    c.saveState()
    c.translate(width/2, height/2)
    c.rotate(45)
    c.drawCentredString(0, 0, "MOCK TEST")
    c.restoreState()
    
    # === LOGOS ===
    # ILDIZ Logo (left)
    # c.drawImage('path/to/ildiz_logo.png', 3*cm, height-5*cm, width=4*cm, height=3*cm, preserveAspectRatio=True)
    
    # Library Logo (right)
    if participant.session.library.logo:
        try:
            logo_path = participant.session.library.logo.path
            c.drawImage(logo_path, width-7*cm, height-5*cm, width=4*cm, height=3*cm, preserveAspectRatio=True)
        except:
            pass
    
    # === TITLE ===
    c.setFillColorRGB(0.1, 0.2, 0.5)
    c.setFont("Helvetica-Bold", 32)
    c.drawCentredString(width/2, height-6*cm, "IELTS MOCK TEST")
    
    c.setFont("Helvetica", 18)
    c.drawCentredString(width/2, height-7*cm, "Certificate of Completion")
    
    # === STUDENT NAME ===
    c.setFont("Helvetica-Bold", 28)
    c.setFillColorRGB(0, 0, 0)
    c.drawCentredString(width/2, height-10*cm, participant.full_name)
    
    # === OVERALL BAND SCORE ===
    c.setFont("Helvetica", 16)
    c.drawCentredString(width/2, height-11.5*cm, "achieved an Overall Band Score of")
    
    # Score box
    c.setFillColorRGB(0.2, 0.4, 0.8)
    c.roundRect(width/2-3*cm, height-14*cm, 6*cm, 2*cm, 0.5*cm, fill=1, stroke=0)
    
    c.setFillColorRGB(1, 1, 1)
    c.setFont("Helvetica-Bold", 48)
    score_text = f"{participant.overall_band_score:.1f}"
    c.drawCentredString(width/2, height-13.5*cm, score_text)
    
    # === SECTION SCORES ===
    c.setFillColorRGB(0, 0, 0)
    c.setFont("Helvetica", 14)
    
    y_start = height - 16*cm
    x_start = width/2 - 8*cm
    
    sections = [
        ("Listening:", participant.listening_score),
        ("Reading:", participant.reading_score),
        ("Writing:", participant.writing_score),
        ("Speaking:", participant.speaking_score),
    ]
    
    for i, (label, score) in enumerate(sections):
        x = x_start + (i * 4.5*cm)
        c.drawString(x, y_start, label)
        c.setFont("Helvetica-Bold", 16)
        c.drawString(x + 2*cm, y_start, f"{score:.1f}" if score else "-")
        c.setFont("Helvetica", 14)
    
    # === DATE ===
    c.setFont("Helvetica", 12)
    c.drawCentredString(width/2, 4*cm, f"Test Date: {participant.session.date.strftime('%d %B %Y')}")
    
    # === FOOTER ===
    c.setFont("Helvetica-Oblique", 10)
    c.setFillColorRGB(0.5, 0.5, 0.5)
    c.drawCentredString(width/2, 2.5*cm, f"{participant.session.library.name}")
    c.drawCentredString(width/2, 2*cm, "ILDIZ Mock Platform | This is a practice test certificate, not an official IELTS result")
    
    # === GENERATE ===
    c.showPage()
    c.save()
    
    buffer.seek(0)
    return buffer
```

---

### C) Certificate Download View

```python
from django.http import HttpResponse
from .certificate import generate_certificate

@login_required
def student_certificate_download(request, participant_id):
    """Sertifikatni yuklab olish"""
    
    participant = get_object_or_404(MockParticipant, id=participant_id)
    
    # Security check
    if participant.full_name != request.user.get_full_name():
        messages.error(request, 'Bu sertifikat sizga tegishli emas')
        return redirect('student_dashboard')
    
    # Check if completed
    if not participant.overall_band_score:
        messages.error(request, 'Test hali tugallanmagan')
        return redirect('student_test_detail', participant_id=participant.id)
    
    # Generate PDF
    pdf_buffer = generate_certificate(participant)
    
    # Response
    response = HttpResponse(pdf_buffer, content_type='application/pdf')
    filename = f"IELTS_Mock_Certificate_{participant.full_name.replace(' ', '_')}_{participant.session.date}.pdf"
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    
    return response
```

---

## 5️⃣ URL ROUTING

**Fayl:** `urls.py`

```python
urlpatterns = [
    # Student Auth
    path('student/register/', mock_views.student_register, name='student_register'),
    path('student/login/', mock_views.student_login, name='student_login'),
    path('student/logout/', LogoutView.as_view(next_page='student_login'), name='student_logout'),
    
    # Student Dashboard
    path('student/dashboard/', mock_views.student_dashboard, name='student_dashboard'),
    path('student/test/<int:participant_id>/', mock_views.student_test_detail, name='student_test_detail'),
    path('student/certificate/<int:participant_id>/', mock_views.student_certificate_download, name='student_certificate_download'),
]
```

---

## 6️⃣ STUDENT BASE TEMPLATE

**Fayl:** `mock/templates/student_base.html`

```html
<!DOCTYPE html>
<html lang="uz">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{% block title %}ILDIZ Mock - Student{% endblock %}</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50">
    <!-- Navigation -->
    <nav class="bg-white shadow">
        <div class="max-w-7xl mx-auto px-4">
            <div class="flex justify-between items-center h-16">
                <div class="flex items-center">
                    <h1 class="text-xl font-bold text-blue-600">ILDIZ Mock</h1>
                </div>
                
                <div class="flex items-center gap-6">
                    <a href="{% url 'student_dashboard' %}" 
                       class="text-gray-700 hover:text-blue-600">
                        Dashboard
                    </a>
                    
                    <div class="relative group">
                        <button class="flex items-center gap-2 text-gray-700 hover:text-blue-600">
                            <span>{{ request.user.get_full_name }}</span>
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                            </svg>
                        </button>
                        
                        <div class="hidden group-hover:block absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-2">
                            <a href="{% url 'student_logout' %}" 
                               class="block px-4 py-2 text-gray-700 hover:bg-gray-100">
                                Chiqish
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </nav>
    
    <!-- Messages -->
    {% if messages %}
    <div class="max-w-7xl mx-auto px-4 mt-4">
        {% for message in messages %}
        <div class="bg-{{ message.tags }}-50 border border-{{ message.tags }}-200 text-{{ message.tags }}-800 rounded-lg p-4 mb-4">
            {{ message }}
        </div>
        {% endfor %}
    </div>
    {% endif %}
    
    <!-- Content -->
    {% block content %}{% endblock %}
    
    <!-- Footer -->
    <footer class="bg-white border-t mt-12">
        <div class="max-w-7xl mx-auto px-4 py-6 text-center text-gray-600 text-sm">
            © 2026 ILDIZ Mock Platform. All rights reserved.
        </div>
    </footer>
</body>
</html>
```

---

## 🧪 SINOV (TESTING)

### Test Ssenariysi:

1. **Student Registration**
   - `/student/register/` ga kiring
   - To'liq ma'lumotlarni kiriting
   - Ro'yxatdan o'ting
   - Avtomatik dashboard'ga yo'naltirilishi kerak

2. **Login**
   - Logout qiling
   - `/student/login/` ga kiring
   - Username + parol bilan login qiling

3. **Dashboard**
   - Barcha mock testlar ko'rinishi kerak
   - Progress grafigi chizilishi kerak (Chart.js)
   - Statistika to'g'ri hisoblanishi kerak

4. **Test Detail**
   - Bitta testni tanlang
   - Batafsil ma'lumot ko'rinishi kerak
   - Feedback'lar ko'rinishi kerak

5. **Certificate Download**
   - "Sertifikatni Yuklab Olish" tugmasini bosing
   - PDF yuklanishi kerak
   - Sertifikatda barcha ma'lumotlar to'g'ri bo'lishi kerak:
     - Talaba ismi
     - Overall band score
     - Section scores
     - Test sanasi
     - Markaz logosi
     - MOCK IELTS watermark

---

## ✅ ACCEPTANCE CRITERIA

1. ✅ Talaba ro'yxatdan o'tadi va login qiladi
2. ✅ Dashboard barcha testlarni ko'rsatadi
3. ✅ Progress grafigi Chart.js bilan chiziladi
4. ✅ Statistika to'g'ri hisoblanadi (o'rtacha ballar)
5. ✅ Test detail sahifasida batafsil ma'lumot
6. ✅ Feedback'lar ko'rsatiladi (agar ustoz yozgan bo'lsa)
7. ✅ PDF sertifikat yuklanadi
8. ✅ Sertifikatda professional dizayn
9. ✅ MOCK IELTS watermark borlig
10. ✅ Markaz logosi ko'rsatiladi

---

## 📦 MIGRATION VA DEPLOYMENT

### 1. Migration
```bash
python manage.py makemigrations mock
python manage.py migrate mock
```

### 2. Requirements
```bash
pip install reportlab Pillow
```

### 3. Test Student yaratish
```python
python manage.py shell

>>> from django.contrib.auth.models import User
>>> from mock.models import StudentProfile, Library
>>> 
>>> # Create user
>>> user = User.objects.create_user(
...     username='aziz',
...     email='aziz@test.com',
...     password='test123',
...     first_name='Aziz',
...     last_name='Karimov'
... )
>>>
>>> # Create profile
>>> library = Library.objects.first()
>>> StudentProfile.objects.create(
...     user=user,
...     library=library,
...     phone='+998901234567'
... )
```

### 4. MockParticipant linkini update qilish
```python
# ETAP 3 da talaba full_name kiritadi
# StudentProfile.user.get_full_name() bilan match qilish kerak
# 
# Yoki MockParticipant modelga student_profile ForeignKey qo'shish:
# student_profile = models.ForeignKey(StudentProfile, null=True, on_delete=models.SET_NULL)
```

---

## 🚨 MUHIM ESLATMALAR

### 1. Student-Participant Linking
Ikki usul:

**Usul A:** `full_name` orqali match (oddiy, lekin ideal emas)
```python
MockParticipant.objects.filter(full_name__iexact=user.get_full_name())
```

**Usul B:** ForeignKey qo'shish (to'g'riroq)
```python
# MockParticipant modelga:
student_profile = models.ForeignKey(StudentProfile, null=True, blank=True, on_delete=models.SET_NULL)

# Mock join paytida:
if request.user.is_authenticated and hasattr(request.user, 'student_profile'):
    participant.student_profile = request.user.student_profile
```

### 2. Certificate Customization
- Library logosi path to'g'ri bo'lishi kerak
- ILDIZ logosi static file'da bo'lishi kerak
- Font'lar system'da mavjud bo'lishi kerak
- Color scheme markazga moslashishi mumkin

### 3. Chart.js Performance
- Ko'p mock testlar bo'lsa (50+), faqat oxirgi 10-20 ni ko'rsatish
- AJAX pagination qo'shish mumkin

### 4. Security
- Talaba faqat o'z testlarini ko'rishi mumkin
- Certificate faqat o'z sertifikatini yuklay oladi
- Session timeout sozlash (30 daqiqa)

---

## 🎯 YAKUNIY ARXITEKTURA

```
┌────────────────────────────────────────────────────────┐
│                STUDENT AUTHENTICATION                  │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Register → Login → Dashboard                     │  │
│  │ User + StudentProfile + Library                  │  │
│  └──────────────────────────────────────────────────┘  │
│                          ↓                             │
├────────────────────────────────────────────────────────┤
│                  STUDENT DASHBOARD                     │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Statistics (total, avg scores)                   │  │
│  │ Progress Chart (Chart.js line graph)            │  │
│  │ Mock Tests List (clickable rows)                │  │
│  └──────────────────────────────────────────────────┘  │
│                          ↓                             │
├────────────────────────────────────────────────────────┤
│                 TEST DETAIL PAGE                       │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Overall Band Score (large)                       │  │
│  │ Section Scores (L/R/W/S)                        │  │
│  │ Feedback (Writing, Speaking)                    │  │
│  │ Certificate Download Button                     │  │
│  └──────────────────────────────────────────────────┘  │
│                          ↓                             │
├────────────────────────────────────────────────────────┤
│              MOCK CERTIFICATE (PDF)                    │
│  ┌──────────────────────────────────────────────────┐  │
│  │ ReportLab PDF Generation                        │  │
│  │ - Student Name                                  │  │
│  │ - Overall Band Score (large box)                │  │
│  │ - Section Scores                                │  │
│  │ - Test Date                                     │  │
│  │ - Library Logo + ILDIZ Logo                     │  │
│  │ - MOCK TEST Watermark                           │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

---

## 🎯 OXIRGI ESLATMA

ETAP 5 tugagandan keyin:

✅ **To'liq Student Funksional**
- Registration + Login
- Personal dashboard
- Progress tracking
- Test history
- Professional certificate

✅ **PROFESSIONAL PLATFORMA**
- Admin: test yaratadi + mock boshqaradi + natija ko'radi
- Teacher: Writing/Speaking baholaydi
- Student: testda qatnashadi + natija ko'radi + sertifikat oladi

✅ **DEMO UCHUN TAYYOR**
- Mijozlarga full flow ko'rsatish mumkin
- End-to-end test
- Real sertifikat namuna

---

**ETAP 6 (optional):** Practice Mode (talaba uyda mashq qilish)
**ETAP 7 (muhim):** Co-branding + Analytics (markaz logosi, statistika)

Omad! 🚀
