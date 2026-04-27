# ETAP 3: MOCK SESSIYA + SINXRON TEST

**Maqsad:** Markaz admini sessiya yaratadi, talabalar bitta linkdan kirib o'z ismini tanlaydi, admin START bossa HAMMA kompyuterlarda bir vaqtda test boshlanadi va avtomatik Listening → Reading → Writing ketma-ketligida o'tadi.

---

## 📋 NIMALAR QILINADI

### ✅ 1. Mock Sessiya Boshqaruvi

**Models** (`mock/models.py`):
```python
class MockSession(TimeStampedModel):
    """Markaz admini yaratadigan test sessiyasi"""
    library = models.ForeignKey(Library, on_delete=models.CASCADE)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    name = models.CharField(max_length=200)  # "2026-04-27 Kechki guruh"
    date = models.DateField()
    start_time = models.TimeField(null=True, blank=True)
    
    # Test topshirish tartibi
    test_order = models.JSONField(default=list)  # ["listening", "reading", "writing"]
    
    # Test ID'lar (ETAP 2 dan yaratilgan testlar)
    listening_test = models.ForeignKey('ListeningTest', null=True, on_delete=models.SET_NULL)
    reading_test = models.ForeignKey('ReadingTest', null=True, on_delete=models.SET_NULL)
    writing_test = models.ForeignKey('WritingTest', null=True, on_delete=models.SET_NULL)
    
    # Vaqt limitlari (daqiqada)
    listening_duration = models.IntegerField(default=30)
    reading_duration = models.IntegerField(default=60)
    writing_duration = models.IntegerField(default=60)
    
    # Status
    STATUS_CHOICES = [
        ('waiting', 'Kutilmoqda'),      # talabalar kirishmoqda
        ('listening', 'Listening'),
        ('reading', 'Reading'),
        ('writing', 'Writing'),
        ('finished', 'Tugagan'),
    ]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='waiting')
    
    # Maxsus linklar
    access_code = models.CharField(max_length=8, unique=True)  # 8 belgili kod
    
    class Meta:
        db_table = 'mock_sessions'


class MockParticipant(TimeStampedModel):
    """Sessiyaga qo'shilgan talaba"""
    session = models.ForeignKey(MockSession, on_delete=models.CASCADE, related_name='participants')
    full_name = models.CharField(max_length=200)
    
    # Qaysi kompyuter/brauzerdan kirdi
    browser_session_id = models.CharField(max_length=100, unique=True)
    
    # Join qilgan vaqt
    joined_at = models.DateTimeField(auto_now_add=True)
    
    # Javoblari
    listening_answers = models.JSONField(default=dict)
    reading_answers = models.JSONField(default=dict)
    writing_task1_text = models.TextField(blank=True)
    writing_task2_text = models.TextField(blank=True)
    
    # Natijalar
    listening_score = models.FloatField(null=True, blank=True)
    reading_score = models.FloatField(null=True, blank=True)
    writing_score = models.FloatField(null=True, blank=True)
    speaking_score = models.FloatField(null=True, blank=True)  # ustoz qo'yadi
    
    class Meta:
        db_table = 'mock_participants'
        unique_together = [['session', 'full_name']]  # bir sessiyada bir nom


class MockStateLog(models.Model):
    """Admin qachon START/PAUSE/NEXT bosganini log qilish"""
    session = models.ForeignKey(MockSession, on_delete=models.CASCADE)
    action = models.CharField(max_length=20)  # "start_listening", "advance_to_reading"
    timestamp = models.DateTimeField(auto_now_add=True)
    triggered_by = models.ForeignKey(User, on_delete=models.CASCADE)
    
    class Meta:
        db_table = 'mock_state_logs'
```

---

### ✅ 2. Admin Panel — Sessiya Yaratish

**View** (`mock/views.py`):
```python
from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.utils import timezone
import random
import string

def generate_access_code():
    """8 belgili unikal kod: ILDIZ123"""
    while True:
        code = 'ILDIZ' + ''.join(random.choices(string.digits, k=3))
        if not MockSession.objects.filter(access_code=code).exists():
            return code


@login_required
def create_session_view(request):
    """Sessiya yaratish sahifasi"""
    if request.method == 'POST':
        session = MockSession.objects.create(
            library=request.user.library,
            created_by=request.user,
            name=request.POST['name'],
            date=request.POST['date'],
            listening_test_id=request.POST.get('listening_test'),
            reading_test_id=request.POST.get('reading_test'),
            writing_test_id=request.POST.get('writing_test'),
            test_order=['listening', 'reading', 'writing'],
            access_code=generate_access_code(),
            status='waiting'
        )
        return redirect('mock_control_panel', session_id=session.id)
    
    # GET - forma ko'rsatish
    listening_tests = ListeningTest.objects.filter(library=request.user.library)
    reading_tests = ReadingTest.objects.filter(library=request.user.library)
    writing_tests = WritingTest.objects.filter(library=request.user.library)
    
    return render(request, 'mock/create_session.html', {
        'listening_tests': listening_tests,
        'reading_tests': reading_tests,
        'writing_tests': writing_tests,
    })
```

**Template** (`mock/templates/mock/create_session.html`):
```html
{% extends 'base.html' %}

{% block content %}
<div class="max-w-2xl mx-auto py-8">
    <h1 class="text-3xl font-bold mb-6">Yangi Mock Sessiya</h1>
    
    <form method="post" class="space-y-6">
        {% csrf_token %}
        
        <div>
            <label class="block text-sm font-medium mb-2">Sessiya nomi</label>
            <input type="text" name="name" required 
                   placeholder="Masalan: 2026-04-27 Kechki guruh"
                   class="w-full border px-4 py-2 rounded">
        </div>
        
        <div>
            <label class="block text-sm font-medium mb-2">Sana</label>
            <input type="date" name="date" required 
                   class="w-full border px-4 py-2 rounded">
        </div>
        
        <div>
            <label class="block text-sm font-medium mb-2">Listening Test</label>
            <select name="listening_test" required class="w-full border px-4 py-2 rounded">
                <option value="">Tanlang...</option>
                {% for test in listening_tests %}
                <option value="{{ test.id }}">{{ test.name }}</option>
                {% endfor %}
            </select>
        </div>
        
        <div>
            <label class="block text-sm font-medium mb-2">Reading Test</label>
            <select name="reading_test" required class="w-full border px-4 py-2 rounded">
                <option value="">Tanlang...</option>
                {% for test in reading_tests %}
                <option value="{{ test.id }}">{{ test.name }}</option>
                {% endfor %}
            </select>
        </div>
        
        <div>
            <label class="block text-sm font-medium mb-2">Writing Test</label>
            <select name="writing_test" required class="w-full border px-4 py-2 rounded">
                <option value="">Tanlang...</option>
                {% for test in writing_tests %}
                <option value="{{ test.id }}">{{ test.name }}</option>
                {% endfor %}
            </select>
        </div>
        
        <button type="submit" class="w-full bg-blue-600 text-white py-3 rounded font-semibold hover:bg-blue-700">
            Sessiya yaratish
        </button>
    </form>
</div>
{% endblock %}
```

---

### ✅ 3. Admin Control Panel

**View**:
```python
@login_required
def mock_control_panel(request, session_id):
    """Admin mock ni boshqarish paneli"""
    session = get_object_or_404(MockSession, id=session_id, library=request.user.library)
    participants = session.participants.all().order_by('full_name')
    
    # Access link
    join_url = request.build_absolute_uri(
        reverse('mock_student_join', kwargs={'access_code': session.access_code})
    )
    
    return render(request, 'mock/control_panel.html', {
        'session': session,
        'participants': participants,
        'join_url': join_url,
    })


@login_required
@require_POST
def mock_start_test(request, session_id):
    """Admin START tugmasini bosdi"""
    session = get_object_or_404(MockSession, id=session_id)
    
    if session.status == 'waiting':
        session.status = 'listening'
        session.start_time = timezone.now()
        session.save()
        
        MockStateLog.objects.create(
            session=session,
            action='start_listening',
            triggered_by=request.user
        )
    
    return redirect('mock_control_panel', session_id=session.id)


@login_required
@require_POST
def mock_advance_section(request, session_id):
    """Admin NEXT tugmasini bosdi — keyingi bo'limga o'tish"""
    session = get_object_or_404(MockSession, id=session_id)
    
    if session.status == 'listening':
        session.status = 'reading'
    elif session.status == 'reading':
        session.status = 'writing'
    elif session.status == 'writing':
        session.status = 'finished'
    
    session.save()
    
    MockStateLog.objects.create(
        session=session,
        action=f'advance_to_{session.status}',
        triggered_by=request.user
    )
    
    return redirect('mock_control_panel', session_id=session.id)
```

**Template** (`mock/templates/mock/control_panel.html`):
```html
{% extends 'base.html' %}

{% block content %}
<div class="max-w-6xl mx-auto py-8">
    <h1 class="text-3xl font-bold mb-2">{{ session.name }}</h1>
    <p class="text-gray-600 mb-6">{{ session.date }} | Status: <span class="font-semibold">{{ session.get_status_display }}</span></p>
    
    <!-- Talabalar uchun link -->
    <div class="bg-blue-50 border border-blue-200 rounded p-4 mb-8">
        <p class="font-semibold mb-2">Talabalar uchun link:</p>
        <div class="flex items-center gap-4">
            <input type="text" readonly value="{{ join_url }}" 
                   id="join-url-input"
                   class="flex-1 border px-4 py-2 rounded bg-white">
            <button onclick="copyLink()" class="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700">
                Nusxa olish
            </button>
        </div>
        <p class="text-sm text-gray-600 mt-2">Access Code: <code class="font-mono bg-white px-2 py-1 rounded">{{ session.access_code }}</code></p>
    </div>
    
    <!-- Boshqaruv tugmalari -->
    <div class="bg-white border rounded-lg p-6 mb-8">
        <h2 class="text-xl font-bold mb-4">Boshqaruv</h2>
        
        {% if session.status == 'waiting' %}
        <form method="post" action="{% url 'mock_start_test' session.id %}">
            {% csrf_token %}
            <button type="submit" class="bg-green-600 text-white px-8 py-3 rounded text-lg font-semibold hover:bg-green-700">
                ▶ START LISTENING
            </button>
        </form>
        <p class="text-sm text-gray-600 mt-2">{{ participants.count }} ta talaba qo'shilgan</p>
        
        {% elif session.status in 'listening reading writing' %}
        <div class="space-y-4">
            <div class="text-2xl font-mono text-center py-4 bg-gray-100 rounded">
                ⏱️ <span id="timer">--:--</span>
            </div>
            
            <form method="post" action="{% url 'mock_advance_section' session.id %}">
                {% csrf_token %}
                <button type="submit" class="w-full bg-orange-600 text-white px-8 py-3 rounded text-lg font-semibold hover:bg-orange-700">
                    {% if session.status == 'listening' %}
                        NEXT → Reading
                    {% elif session.status == 'reading' %}
                        NEXT → Writing
                    {% else %}
                        FINISH
                    {% endif %}
                </button>
            </form>
        </div>
        
        {% else %}
        <p class="text-green-600 text-xl font-semibold">✓ Sessiya tugadi</p>
        <a href="{% url 'mock_results' session.id %}" class="inline-block mt-4 bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700">
            Natijalarni ko'rish
        </a>
        {% endif %}
    </div>
    
    <!-- Talabalar ro'yxati -->
    <div class="bg-white border rounded-lg p-6">
        <h2 class="text-xl font-bold mb-4">Talabalar ({{ participants.count }})</h2>
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            {% for p in participants %}
            <div class="border rounded p-3">
                <p class="font-semibold">{{ p.full_name }}</p>
                <p class="text-xs text-gray-500">{{ p.joined_at|date:"H:i" }}</p>
            </div>
            {% empty %}
            <p class="text-gray-500 col-span-3">Hali hech kim qo'shilmagan</p>
            {% endfor %}
        </div>
    </div>
</div>

<script>
function copyLink() {
    const input = document.getElementById('join-url-input');
    input.select();
    document.execCommand('copy');
    alert('Link nusxalandi!');
}

// Polling — har 3 soniyada yangilanadi
setInterval(() => {
    location.reload();
}, 3000);
</script>
{% endblock %}
```

---

### ✅ 4. Talaba Interfeysi — Join Link

**URL**:
```python
path('join/<str:access_code>/', views.mock_student_join, name='mock_student_join'),
path('test/<str:browser_session_id>/', views.mock_test_interface, name='mock_test_interface'),
```

**View** (`mock/views.py`):
```python
def mock_student_join(request, access_code):
    """Talaba birinchi marta link ochganda"""
    session = get_object_or_404(MockSession, access_code=access_code)
    
    if session.status != 'waiting':
        return render(request, 'mock/error.html', {
            'message': 'Sessiya allaqachon boshlangan yoki tugagan.'
        })
    
    if request.method == 'POST':
        full_name = request.POST['full_name'].strip()
        
        # Ism tekshirish
        if MockParticipant.objects.filter(session=session, full_name=full_name).exists():
            return render(request, 'mock/join.html', {
                'session': session,
                'error': 'Bu ism allaqachon band.'
            })
        
        # Browser session ID yaratish
        browser_session_id = ''.join(random.choices(string.ascii_letters + string.digits, k=32))
        
        # Participant yaratish
        participant = MockParticipant.objects.create(
            session=session,
            full_name=full_name,
            browser_session_id=browser_session_id
        )
        
        # Browser'ga cookie yozish
        response = redirect('mock_test_interface', browser_session_id=browser_session_id)
        response.set_cookie('mock_bsid', browser_session_id, max_age=86400)  # 1 kun
        return response
    
    # GET - forma ko'rsatish
    participants = session.participants.all()
    return render(request, 'mock/join.html', {
        'session': session,
        'participants': participants,
    })


def mock_test_interface(request, browser_session_id):
    """Talaba test topshiradigan interfeys"""
    participant = get_object_or_404(MockParticipant, browser_session_id=browser_session_id)
    session = participant.session
    
    # Polling uchun status olish
    ctx = {
        'participant': participant,
        'session': session,
        'status': session.status,
    }
    
    if session.status == 'waiting':
        return render(request, 'mock/waiting_room.html', ctx)
    elif session.status == 'listening':
        ctx['test'] = session.listening_test
        return render(request, 'mock/test_listening.html', ctx)
    elif session.status == 'reading':
        ctx['test'] = session.reading_test
        return render(request, 'mock/test_reading.html', ctx)
    elif session.status == 'writing':
        ctx['test'] = session.writing_test
        return render(request, 'mock/test_writing.html', ctx)
    else:
        return render(request, 'mock/test_finished.html', ctx)
```

**Template** (`mock/templates/mock/join.html`):
```html
<!DOCTYPE html>
<html lang="uz">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mock Test - Join</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100">
    <div class="min-h-screen flex items-center justify-center p-4">
        <div class="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
            <h1 class="text-3xl font-bold text-center mb-2">{{ session.name }}</h1>
            <p class="text-center text-gray-600 mb-8">{{ session.date }}</p>
            
            {% if error %}
            <div class="bg-red-50 border border-red-200 text-red-800 rounded p-4 mb-6">
                {{ error }}
            </div>
            {% endif %}
            
            <form method="post" class="space-y-6">
                {% csrf_token %}
                <div>
                    <label class="block text-sm font-medium mb-2">Ism va Familiyangizni kiriting</label>
                    <input type="text" name="full_name" required 
                           placeholder="Masalan: Aziz Karimov"
                           class="w-full border-2 px-4 py-3 rounded-lg focus:border-blue-500 focus:outline-none text-lg">
                </div>
                
                <button type="submit" class="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold text-lg hover:bg-blue-700">
                    Qo'shilish
                </button>
            </form>
            
            <!-- Qo'shilgan talabalar ro'yxati -->
            <div class="mt-8 pt-8 border-t">
                <p class="text-sm font-medium text-gray-600 mb-3">Qo'shilganlar ({{ participants.count }}):</p>
                <div class="space-y-1 max-h-40 overflow-y-auto">
                    {% for p in participants %}
                    <p class="text-sm text-gray-700">• {{ p.full_name }}</p>
                    {% endfor %}
                </div>
            </div>
        </div>
    </div>
    
    <script>
    // Har 5 soniyada ro'yxatni yangilash
    setInterval(() => {
        location.reload();
    }, 5000);
    </script>
</body>
</html>
```

**Template** (`mock/templates/mock/waiting_room.html`):
```html
<!DOCTYPE html>
<html lang="uz">
<head>
    <meta charset="UTF-8">
    <title>Kutilmoqda...</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100">
    <div class="min-h-screen flex items-center justify-center p-4">
        <div class="bg-white rounded-lg shadow-xl p-12 max-w-lg w-full text-center">
            <div class="mb-6">
                <div class="inline-block w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
            
            <h1 class="text-2xl font-bold mb-2">Salom, {{ participant.full_name }}!</h1>
            <p class="text-gray-600 mb-4">Mock test boshlashini kuting...</p>
            
            <p class="text-sm text-gray-500">O'qituvchi START tugmasini bosganda avtomatik boshlanadi</p>
        </div>
    </div>
    
    <script>
    // Har 2 soniyada status tekshirish
    setInterval(() => {
        location.reload();
    }, 2000);
    </script>
</body>
</html>
```

---

### ✅ 5. Test Interfeyslari

**Listening Template** (`mock/templates/mock/test_listening.html`):
```html
<!DOCTYPE html>
<html lang="uz">
<head>
    <meta charset="UTF-8">
    <title>Listening Test</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50">
    <div class="max-w-4xl mx-auto py-8 px-4">
        <!-- Timer -->
        <div class="bg-white rounded-lg shadow p-4 mb-6 flex justify-between items-center">
            <h1 class="text-2xl font-bold">Listening Test</h1>
            <div class="text-3xl font-mono text-red-600 font-bold" id="timer">30:00</div>
        </div>
        
        <!-- Audio Player -->
        <div class="bg-white rounded-lg shadow p-6 mb-6">
            <audio id="audio-player" controls class="w-full">
                <source src="{{ test.audio_file.url }}" type="audio/mpeg">
            </audio>
            <p class="text-sm text-gray-600 mt-2">Audio faqat bir marta tinglash mumkin</p>
        </div>
        
        <!-- Questions -->
        <form id="listening-form" method="post" action="{% url 'mock_submit_listening' participant.id %}">
            {% csrf_token %}
            
            {% for section in test.sections.all %}
            <div class="bg-white rounded-lg shadow p-6 mb-6">
                <h2 class="text-xl font-bold mb-4">{{ section.title }}</h2>
                
                {% for q in section.questions.all %}
                <div class="mb-4 pb-4 border-b last:border-0">
                    <p class="font-semibold mb-2">{{ forloop.counter }}. {{ q.question_text }}</p>
                    
                    {% if q.question_type == 'mcq' %}
                        {% for opt in q.options %}
                        <label class="block mb-1">
                            <input type="radio" name="q_{{ q.id }}" value="{{ opt }}" class="mr-2">
                            {{ opt }}
                        </label>
                        {% endfor %}
                    {% elif q.question_type == 'fill_blank' %}
                        <input type="text" name="q_{{ q.id }}" 
                               class="border px-3 py-2 rounded w-full max-w-sm"
                               placeholder="Javobni kiriting">
                    {% endif %}
                </div>
                {% endfor %}
            </div>
            {% endfor %}
            
            <button type="submit" class="w-full bg-green-600 text-white py-3 rounded-lg font-semibold text-lg hover:bg-green-700">
                Tugatish
            </button>
        </form>
    </div>
    
    <script>
    // Timer
    let seconds = {{ session.listening_duration }} * 60;
    const timerEl = document.getElementById('timer');
    
    const interval = setInterval(() => {
        seconds--;
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        timerEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
        
        if (seconds <= 0) {
            clearInterval(interval);
            document.getElementById('listening-form').submit();
        }
    }, 1000);
    
    // Audio finished event
    const audio = document.getElementById('audio-player');
    audio.addEventListener('ended', () => {
        audio.controls = false;
        audio.style.display = 'none';
    });
    
    // Polling — admin advance qilsa avtomatik o'tish
    setInterval(() => {
        fetch('/api/mock/status/{{ session.id }}/')
            .then(r => r.json())
            .then(data => {
                if (data.status !== 'listening') {
                    location.reload();
                }
            });
    }, 3000);
    </script>
</body>
</html>
```

**Reading va Writing templatelar xuddi shunday tuziladi** (Reading - matn + savollar, Writing - Task 1 va Task 2 textarea'lar).

---

### ✅ 6. API - Polling uchun

**View**:
```python
from django.http import JsonResponse

def mock_session_status_api(request, session_id):
    """Talaba polling qilish uchun - hozirgi status"""
    session = get_object_or_404(MockSession, id=session_id)
    
    return JsonResponse({
        'status': session.status,
        'current_section': session.status if session.status in ['listening', 'reading', 'writing'] else None,
        'time_remaining': calculate_remaining_time(session),  # funktsiya yozish kerak
    })
```

**URL**:
```python
path('api/mock/status/<int:session_id>/', views.mock_session_status_api, name='mock_session_status_api'),
```

---

### ✅ 7. Javoblarni Saqlash

**View**:
```python
@require_POST
def mock_submit_listening(request, participant_id):
    """Listening javoblarini saqlash"""
    participant = get_object_or_404(MockParticipant, id=participant_id)
    
    answers = {}
    for key, value in request.POST.items():
        if key.startswith('q_'):
            question_id = key.replace('q_', '')
            answers[question_id] = value
    
    participant.listening_answers = answers
    participant.save()
    
    # Auto-grade
    score = calculate_listening_score(participant)
    participant.listening_score = score
    participant.save()
    
    # Redirect back to test interface (waiting room va h.k.)
    return redirect('mock_test_interface', browser_session_id=participant.browser_session_id)


def calculate_listening_score(participant):
    """Listening javoblarini tekshirish"""
    test = participant.session.listening_test
    correct = 0
    total = 0
    
    for section in test.sections.all():
        for q in section.questions.all():
            total += 1
            user_answer = participant.listening_answers.get(str(q.id), '').strip().lower()
            correct_answer = q.correct_answer.strip().lower()
            
            if user_answer == correct_answer:
                correct += 1
    
    # Band score calculation (IELTS 40 savol = 9.0 scale)
    if total == 0:
        return 0
    
    percentage = (correct / total) * 100
    
    # Simplified band conversion
    if percentage >= 90: return 9.0
    elif percentage >= 80: return 8.0
    elif percentage >= 70: return 7.0
    elif percentage >= 60: return 6.0
    elif percentage >= 50: return 5.0
    elif percentage >= 40: return 4.0
    elif percentage >= 30: return 3.0
    else: return 2.0
```

---

### ✅ 8. Natijalar Sahifasi

**View**:
```python
@login_required
def mock_results_view(request, session_id):
    """Admin natijalarni ko'rish"""
    session = get_object_or_404(MockSession, id=session_id, library=request.user.library)
    participants = session.participants.all().order_by('-listening_score')
    
    return render(request, 'mock/results.html', {
        'session': session,
        'participants': participants,
    })
```

**Template** (`mock/templates/mock/results.html`):
```html
{% extends 'base.html' %}

{% block content %}
<div class="max-w-6xl mx-auto py-8">
    <h1 class="text-3xl font-bold mb-6">{{ session.name }} - Natijalar</h1>
    
    <div class="bg-white rounded-lg shadow overflow-hidden">
        <table class="w-full">
            <thead class="bg-gray-50">
                <tr>
                    <th class="px-6 py-3 text-left">Ism</th>
                    <th class="px-6 py-3 text-center">Listening</th>
                    <th class="px-6 py-3 text-center">Reading</th>
                    <th class="px-6 py-3 text-center">Writing</th>
                    <th class="px-6 py-3 text-center">Speaking</th>
                    <th class="px-6 py-3 text-center">Overall</th>
                    <th class="px-6 py-3"></th>
                </tr>
            </thead>
            <tbody>
                {% for p in participants %}
                <tr class="border-t">
                    <td class="px-6 py-4 font-semibold">{{ p.full_name }}</td>
                    <td class="px-6 py-4 text-center">{{ p.listening_score|default:'-' }}</td>
                    <td class="px-6 py-4 text-center">{{ p.reading_score|default:'-' }}</td>
                    <td class="px-6 py-4 text-center">{{ p.writing_score|default:'-' }}</td>
                    <td class="px-6 py-4 text-center">{{ p.speaking_score|default:'-' }}</td>
                    <td class="px-6 py-4 text-center font-bold">
                        {% if p.listening_score and p.reading_score %}
                        {{ p.listening_score|add:p.reading_score|add:p.writing_score|add:p.speaking_score|floatformat:1 }}
                        {% else %}
                        -
                        {% endif %}
                    </td>
                    <td class="px-6 py-4">
                        <a href="{% url 'mock_participant_detail' p.id %}" class="text-blue-600 hover:underline">
                            Batafsil
                        </a>
                    </td>
                </tr>
                {% endfor %}
            </tbody>
        </table>
    </div>
</div>
{% endblock %}
```

---

## 🧪 SINOV (TESTING)

### Test Ssenariysi:

1. **Admin paneldan sessiya yaratish**
   - `/mock/create/` ga kiring
   - Listening/Reading/Writing testlar tanlang
   - "Sessiya yaratish" bosing
   - Access code generatsiya qilinganini tekshiring

2. **3 ta brauzer ochish (talabalar simulatsiya)**
   - 1-brauzer: Aziz Karimov
   - 2-brauzer: Dilnoza Umarova
   - 3-brauzer: Jasur Rahimov
   - Har biri `/join/ILDIZ123/` ga kiradi
   - Ismini kiritadi va "Qo'shilish" bosadi
   - Waiting room sahifasiga tushishi kerak

3. **Admin START bosadi**
   - Control panelda "START LISTENING" tugmasini bosing
   - 3 ta talaba brauzerida avtomatik Listening sahifasi ochilishi kerak (2-3 soniyada)

4. **Test topshirish**
   - 1 ta talaba Listening savollariga javob beradi
   - "Tugatish" bosadi
   - Waiting room'ga qaytadi (Reading kutadi)

5. **Admin NEXT bosadi**
   - "NEXT → Reading" tugmasini bosing
   - Barcha talabalar Reading sahifasiga o'tishi kerak

6. **Natijalarni ko'rish**
   - Sessiya "finished" bo'lgandan keyin
   - `/mock/results/<session_id>/` sahifasiga kiring
   - Listening/Reading auto-grade ko'rsatilishi kerak

---

## ✅ ACCEPTANCE CRITERIA

1. ✅ Admin 1 daqiqada sessiya yaratadi
2. ✅ Talabalar bitta linkdan kirib ismini tanlaydi
3. ✅ Admin START bosdi → 3 soniyada hamma brauzerda test boshlanadi
4. ✅ Listening tugadi → Admin NEXT bosdi → hamma Reading'ga o'tdi
5. ✅ Listening/Reading avtomatik baholanadi (band score)
6. ✅ Writing matnlari saqlanadi (ustoz keyinchalik baholaydi)
7. ✅ Natijalar jadvalda ko'rsatiladi

---

## 📊 YAKUNIY ARXITEKTURA

```
┌─────────────────────────────────────────────────────────────┐
│                     ADMIN PANEL                             │
│  ┌───────────────────────────────────────────────────┐      │
│  │ Create Session → Control Panel → Results          │      │
│  │                       ↓                            │      │
│  │            [START] [NEXT] [FINISH]                │      │
│  └───────────────────────────────────────────────────┘      │
│                          │                                   │
│                          │ (status updates via DB)           │
│                          ↓                                   │
├─────────────────────────────────────────────────────────────┤
│              TALABA INTERFEYSI (Polling)                     │
│  ┌──────────┬──────────┬──────────┬──────────┐             │
│  │ Waiting  │Listening │ Reading  │ Writing  │             │
│  │  Room    │  Test    │   Test   │   Test   │             │
│  └──────────┴──────────┴──────────┴──────────┘             │
│       ↑          ↑          ↑          ↑                    │
│       └──────────┴──────────┴──────────┘                    │
│         Every 2-3 sec: fetch /api/mock/status/              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 BOSHLASH TARTIBI

### 1. Migration
```bash
python manage.py makemigrations mock
python manage.py migrate
```

### 2. URLs qo'shish (`urls.py`):
```python
from mock import views as mock_views

urlpatterns = [
    # Admin
    path('mock/create/', mock_views.create_session_view, name='mock_create_session'),
    path('mock/<int:session_id>/control/', mock_views.mock_control_panel, name='mock_control_panel'),
    path('mock/<int:session_id>/start/', mock_views.mock_start_test, name='mock_start_test'),
    path('mock/<int:session_id>/advance/', mock_views.mock_advance_section, name='mock_advance_section'),
    path('mock/<int:session_id>/results/', mock_views.mock_results_view, name='mock_results'),
    
    # Talaba
    path('join/<str:access_code>/', mock_views.mock_student_join, name='mock_student_join'),
    path('test/<str:browser_session_id>/', mock_views.mock_test_interface, name='mock_test_interface'),
    
    # API
    path('api/mock/status/<int:session_id>/', mock_views.mock_session_status_api, name='mock_session_status_api'),
    
    # Submit
    path('mock/submit/listening/<int:participant_id>/', mock_views.mock_submit_listening, name='mock_submit_listening'),
]
```

### 3. Birinchi Test
- Admin sifatida kiring: `/mock/create/`
- Sessiya yarating
- Linkni nusxa oling
- 3 ta incognito tab ochib, har birida linkni oching
- Har birida boshqa ism kiriting
- Admin panelda START bosing
- Talaba tablarida avtomatik yangilanishni kuzating

---

## 🎯 OXIRGI ESLATMA

Bu **ETAP 3** — eng murakkab etap. Sinxronizatsiya, polling, vaqt boshqaruvi.

**Bu ETAPda hammasi ishlasagina ilg'or platformaga ega bo'lasiz.**

Demo qilishingiz mumkin:
- "Markaz admini 1 daqiqada sessiya yaratadi"
- "Bitta link Telegramga tashlanadi"
- "12 talaba kirib o'z ismini tanlaydi"
- "Admin START bossa, hamma 12 kompyuterda BIR VAQTDA Listening boshlanadi"
- "Avtomatik Reading → Writing"
- "Hech qanday texnik bilim talab qilmaydi"

**Markazlar shu narsa uchun pul to'lashga tayyor.**

Sekin sekin qilamiz. Sifat birinchi.

Omad! 🚀
