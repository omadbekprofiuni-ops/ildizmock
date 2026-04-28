# ETAP 12: SESSION MANAGEMENT + INDIVIDUAL PRACTICE

**Maqsad:** 
1. Admin mock sessiyani yopa oladi (complete/cancel)
2. Practice mode: faqat Listening, faqat Reading, faqat Writing mashq qilish

---

## 📋 ETAP 12 QISMLARI

### 1. Mock Session Management
- Session status update (complete/cancel)
- Session close button
- Results finalization
- Session archive

### 2. Individual Section Practice
- Practice Listening only
- Practice Reading only
- Practice Writing only
- Separate progress tracking

---

## 🔧 QILINISHI KERAK ISHLAR

---

## 1️⃣ MOCK SESSION STATUS UPDATE

### A) View - Session Close

**Fayl:** `mock/views.py`

```python
from django.shortcuts import get_object_or_404, redirect
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.utils import timezone

@login_required
def mock_close_session(request, session_id):
    """Mock sessiyani yopish - Admin uchun"""
    
    session = get_object_or_404(
        MockSession,
        id=session_id,
        library=request.user.library
    )
    
    if request.method == 'POST':
        action = request.POST.get('action')
        
        if action == 'complete':
            # Mark as completed
            session.status = 'completed'
            session.completed_at = timezone.now()
            session.save()
            
            messages.success(request, f'Sessiya "{session.name}" tugallandi!')
            
        elif action == 'cancel':
            # Cancel session
            session.status = 'cancelled'
            session.save()
            
            messages.warning(request, f'Sessiya "{session.name}" bekor qilindi!')
        
        return redirect('mock_sessions_list')
    
    # Show confirmation page
    return render(request, 'mock/session_close_confirm.html', {
        'session': session,
    })


@login_required
def mock_reopen_session(request, session_id):
    """Sessiyani qayta ochish (agar xato yopilgan bo'lsa)"""
    
    session = get_object_or_404(
        MockSession,
        id=session_id,
        library=request.user.library
    )
    
    # Only allow reopening if not too old
    from datetime import timedelta
    
    if session.completed_at and (timezone.now() - session.completed_at) < timedelta(hours=24):
        session.status = 'in_progress'
        session.completed_at = None
        session.save()
        
        messages.success(request, f'Sessiya qayta ochildi!')
    else:
        messages.error(request, 'Bu sessiyani qayta ochib bo\'lmaydi (24 soatdan ko\'p vaqt o\'tdi)')
    
    return redirect('mock_sessions_list')
```

---

### B) Template - Close Confirmation

**Fayl:** `mock/templates/mock/session_close_confirm.html`

```html
{% extends 'admin_base.html' %}

{% block page_title %}Sessiyani Yopish{% endblock %}

{% block content %}
<div class="max-w-2xl mx-auto p-8">
    <div class="bg-white rounded-xl shadow-lg p-8">
        <div class="text-center mb-8">
            <div class="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg class="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
            </div>
            <h1 class="text-2xl font-bold text-gray-900 mb-2">Sessiyani Yopmoqchimisiz?</h1>
            <p class="text-gray-600">{{ session.name }}</p>
        </div>
        
        <!-- Session Info -->
        <div class="bg-gray-50 rounded-lg p-4 mb-6">
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <p class="text-sm text-gray-600">Sana:</p>
                    <p class="font-semibold">{{ session.date|date:"d M Y" }}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">Ishtirokchilar:</p>
                    <p class="font-semibold">{{ session.participants.count }} ta</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">Status:</p>
                    <p class="font-semibold capitalize">{{ session.status }}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">Access Code:</p>
                    <p class="font-semibold">{{ session.access_code }}</p>
                </div>
            </div>
        </div>
        
        <!-- Warning -->
        <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
            <div class="flex">
                <div class="flex-shrink-0">
                    <svg class="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                    </svg>
                </div>
                <div class="ml-3">
                    <p class="text-sm text-yellow-700">
                        <strong>Diqqat:</strong> Sessiyani yopgandan keyin yangi talabalar qo'shila olmaydi.
                    </p>
                </div>
            </div>
        </div>
        
        <!-- Actions -->
        <form method="post" class="space-y-3">
            {% csrf_token %}
            
            <!-- Complete Button -->
            <button type="submit" 
                    name="action" 
                    value="complete"
                    class="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold transition">
                ✓ Sessiyani Tugallash
            </button>
            
            <!-- Cancel Button -->
            <button type="submit" 
                    name="action" 
                    value="cancel"
                    class="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-semibold transition">
                ✗ Sessiyani Bekor Qilish
            </button>
            
            <!-- Back Button -->
            <a href="{% url 'mock_sessions_list' %}" 
               class="block w-full text-center bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold transition">
                ← Orqaga
            </a>
        </form>
        
        <!-- Info -->
        <div class="mt-6 text-center text-sm text-gray-500">
            <p><strong>Tugallash:</strong> Sessiya yakunlandi, natijalar saqlanadi</p>
            <p><strong>Bekor qilish:</strong> Sessiya o'chiriladi, natijalar saqlanmaydi</p>
        </div>
    </div>
</div>
{% endblock %}
```

---

### C) Sessions List Update

**Fayl:** `mock/templates/mock/sessions_list.html` (yangilanishi kerak)

```html
<!-- Add Close/Reopen buttons -->
{% for session in sessions %}
<tr>
    <!-- ... existing columns ... -->
    
    <td class="px-6 py-4 text-right">
        {% if session.status == 'in_progress' %}
        <a href="{% url 'mock_close_session' session.id %}" 
           class="text-orange-600 hover:text-orange-700 text-sm font-semibold mr-3">
            Yopish
        </a>
        {% endif %}
        
        {% if session.status == 'completed' %}
        <span class="text-green-600 text-sm">✓ Tugallangan</span>
        
        <!-- Reopen option (within 24 hours) -->
        {% if session.can_reopen %}
        <a href="{% url 'mock_reopen_session' session.id %}" 
           class="text-blue-600 hover:text-blue-700 text-sm ml-3"
           onclick="return confirm('Sessiyani qayta ochmoqchimisiz?')">
            Qayta ochish
        </a>
        {% endif %}
        {% endif %}
        
        {% if session.status == 'cancelled' %}
        <span class="text-red-600 text-sm">✗ Bekor qilingan</span>
        {% endif %}
        
        <a href="{% url 'mock_results' session.id %}" 
           class="text-blue-600 hover:underline text-sm ml-3">
            Natijalar →
        </a>
    </td>
</tr>
{% endfor %}
```

---

## 2️⃣ INDIVIDUAL SECTION PRACTICE

### A) Model Update

**Fayl:** `mock/models.py` - `PracticeAttempt` model'ga field qo'shamiz

```python
class PracticeAttempt(TimeStampedModel):
    """Practice attempt - UPDATED for individual sections"""
    
    # ... existing fields ...
    
    # YANGI: Section-only practice
    is_full_test = models.BooleanField(
        default=True,
        help_text='To\'liq test yoki faqat bitta section?'
    )
    
    # For section-only practice, only ONE of these will be filled
    # listening_test OR reading_test OR writing_test
```

---

### B) Practice Mode - Individual Sections View

**Fayl:** `mock/views.py`

```python
@login_required
def practice_sections_home(request):
    """Practice mode - section tanlash"""
    
    profile = request.user.student_profile
    library = profile.library
    
    # Get available tests for each section
    listening_tests = ListeningTest.objects.filter(
        library=library,
        is_practice_enabled=True
    ).count()
    
    reading_tests = ReadingTest.objects.filter(
        library=library,
        is_practice_enabled=True
    ).count()
    
    writing_tests = WritingTest.objects.filter(
        library=library,
        is_practice_enabled=True
    ).count()
    
    # Recent attempts
    recent_attempts = PracticeAttempt.objects.filter(
        student_profile=profile,
        status='completed'
    ).order_by('-completed_at')[:10]
    
    return render(request, 'mock/practice_sections_home.html', {
        'listening_count': listening_tests,
        'reading_count': reading_tests,
        'writing_count': writing_tests,
        'recent_attempts': recent_attempts,
    })


@login_required
def practice_listening_list(request):
    """Faqat Listening practice - test ro'yxati"""
    
    profile = request.user.student_profile
    
    tests = ListeningTest.objects.filter(
        library=profile.library,
        is_practice_enabled=True
    ).order_by('-created_at')
    
    # Get user's attempts for each test
    for test in tests:
        test.user_attempts = PracticeAttempt.objects.filter(
            student_profile=profile,
            listening_test=test,
            status='completed'
        ).count()
        
        # Best score
        best = PracticeAttempt.objects.filter(
            student_profile=profile,
            listening_test=test,
            status='completed',
            score__isnull=False
        ).order_by('-score').first()
        
        test.best_score = best.score if best else None
    
    return render(request, 'mock/practice_listening_list.html', {
        'tests': tests,
    })


@login_required
def practice_reading_list(request):
    """Faqat Reading practice - test ro'yxati"""
    
    profile = request.user.student_profile
    
    tests = ReadingTest.objects.filter(
        library=profile.library,
        is_practice_enabled=True
    ).order_by('-created_at')
    
    # Get user's attempts
    for test in tests:
        test.user_attempts = PracticeAttempt.objects.filter(
            student_profile=profile,
            reading_test=test,
            status='completed'
        ).count()
        
        best = PracticeAttempt.objects.filter(
            student_profile=profile,
            reading_test=test,
            status='completed',
            score__isnull=False
        ).order_by('-score').first()
        
        test.best_score = best.score if best else None
    
    return render(request, 'mock/practice_reading_list.html', {
        'tests': tests,
    })


@login_required
def practice_writing_list(request):
    """Faqat Writing practice - test ro'yxati"""
    
    profile = request.user.student_profile
    
    tests = WritingTest.objects.filter(
        library=profile.library,
        is_practice_enabled=True
    ).order_by('-created_at')
    
    # Get user's attempts
    for test in tests:
        test.user_attempts = PracticeAttempt.objects.filter(
            student_profile=profile,
            writing_test=test,
            status='completed'
        ).count()
    
    return render(request, 'mock/practice_writing_list.html', {
        'tests': tests,
    })
```

---

### C) Template - Practice Sections Home

**Fayl:** `mock/templates/mock/practice_sections_home.html`

```html
{% extends 'student_base.html' %}

{% block content %}
<div class="max-w-7xl mx-auto py-8 px-4">
    <!-- Header -->
    <div class="bg-gradient-to-r from-green-600 to-teal-600 rounded-lg shadow-lg p-8 mb-8 text-white">
        <h1 class="text-3xl font-bold mb-2">Practice Mode</h1>
        <p class="text-green-100">O'zingiz uchun mashq qiling - darhol natijani ko'ring</p>
    </div>
    
    <!-- Section Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <!-- Listening Practice -->
        <a href="{% url 'practice_listening_list' %}" 
           class="bg-white rounded-xl shadow-lg hover:shadow-2xl transition-all p-8 text-center group">
            <div class="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition">
                <span class="text-4xl">🎧</span>
            </div>
            <h3 class="text-2xl font-bold text-gray-900 mb-2">Listening</h3>
            <p class="text-gray-600 mb-4">Audio tinglash va savollar</p>
            
            <div class="bg-blue-50 rounded-lg p-3">
                <p class="text-sm text-gray-600">Mavjud testlar:</p>
                <p class="text-2xl font-bold text-blue-600">{{ listening_count }}</p>
            </div>
        </a>
        
        <!-- Reading Practice -->
        <a href="{% url 'practice_reading_list' %}" 
           class="bg-white rounded-xl shadow-lg hover:shadow-2xl transition-all p-8 text-center group">
            <div class="w-20 h-20 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition">
                <span class="text-4xl">📖</span>
            </div>
            <h3 class="text-2xl font-bold text-gray-900 mb-2">Reading</h3>
            <p class="text-gray-600 mb-4">Matnlarni o'qish va tushunish</p>
            
            <div class="bg-purple-50 rounded-lg p-3">
                <p class="text-sm text-gray-600">Mavjud testlar:</p>
                <p class="text-2xl font-bold text-purple-600">{{ reading_count }}</p>
            </div>
        </a>
        
        <!-- Writing Practice -->
        <a href="{% url 'practice_writing_list' %}" 
           class="bg-white rounded-xl shadow-lg hover:shadow-2xl transition-all p-8 text-center group">
            <div class="w-20 h-20 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition">
                <span class="text-4xl">✍️</span>
            </div>
            <h3 class="text-2xl font-bold text-gray-900 mb-2">Writing</h3>
            <p class="text-gray-600 mb-4">Essay yozish mashqi</p>
            
            <div class="bg-orange-50 rounded-lg p-3">
                <p class="text-sm text-gray-600">Mavjud testlar:</p>
                <p class="text-2xl font-bold text-orange-600">{{ writing_count }}</p>
            </div>
        </a>
    </div>
    
    <!-- Recent Attempts -->
    {% if recent_attempts %}
    <div class="bg-white rounded-lg shadow-lg p-6">
        <h2 class="text-xl font-bold text-gray-900 mb-4">Oxirgi Mashqlar</h2>
        
        <div class="space-y-3">
            {% for attempt in recent_attempts %}
            <div class="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition">
                <div class="flex items-center gap-4">
                    <!-- Icon -->
                    <div class="w-12 h-12 rounded-lg flex items-center justify-center
                                {% if attempt.section == 'listening' %}bg-blue-100
                                {% elif attempt.section == 'reading' %}bg-purple-100
                                {% else %}bg-orange-100{% endif %}">
                        <span class="text-2xl">
                            {% if attempt.section == 'listening' %}🎧
                            {% elif attempt.section == 'reading' %}📖
                            {% else %}✍️{% endif %}
                        </span>
                    </div>
                    
                    <!-- Info -->
                    <div>
                        <p class="font-semibold text-gray-900">{{ attempt.get_section_display }}</p>
                        <p class="text-sm text-gray-600">{{ attempt.completed_at|date:"d M Y, H:i" }}</p>
                    </div>
                </div>
                
                <!-- Score -->
                <div class="text-right">
                    {% if attempt.score %}
                    <p class="text-3xl font-bold 
                              {% if attempt.section == 'listening' %}text-blue-600
                              {% elif attempt.section == 'reading' %}text-purple-600
                              {% else %}text-orange-600{% endif %}">
                        {{ attempt.score|floatformat:1 }}
                    </p>
                    <p class="text-xs text-gray-500">{{ attempt.correct_count }}/{{ attempt.total_count }}</p>
                    {% endif %}
                </div>
            </div>
            {% endfor %}
        </div>
    </div>
    {% endif %}
</div>
{% endblock %}
```

---

### D) Template - Listening Practice List

**Fayl:** `mock/templates/mock/practice_listening_list.html`

```html
{% extends 'student_base.html' %}

{% block content %}
<div class="max-w-7xl mx-auto py-8 px-4">
    <!-- Header -->
    <div class="mb-6">
        <a href="{% url 'practice_sections_home' %}" class="text-blue-600 hover:underline">← Practice Home</a>
    </div>
    
    <div class="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg shadow-lg p-8 mb-8 text-white">
        <div class="flex items-center gap-4">
            <span class="text-6xl">🎧</span>
            <div>
                <h1 class="text-3xl font-bold mb-2">Listening Practice</h1>
                <p class="text-blue-100">Audio tinglash va savollar - instant feedback</p>
            </div>
        </div>
    </div>
    
    <!-- Tests Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {% for test in tests %}
        <div class="bg-white rounded-xl shadow-lg hover:shadow-2xl transition overflow-hidden">
            <!-- Header -->
            <div class="bg-gradient-to-r from-blue-500 to-blue-600 p-6 text-white">
                <h3 class="text-xl font-bold mb-2">{{ test.name }}</h3>
                <p class="text-sm text-blue-100">{{ test.duration_minutes }} daqiqa</p>
            </div>
            
            <!-- Stats -->
            <div class="p-6">
                <div class="grid grid-cols-2 gap-4 mb-4">
                    <div class="text-center p-3 bg-gray-50 rounded-lg">
                        <p class="text-sm text-gray-600">Urinishlar</p>
                        <p class="text-2xl font-bold text-gray-900">{{ test.user_attempts }}</p>
                    </div>
                    
                    <div class="text-center p-3 bg-blue-50 rounded-lg">
                        <p class="text-sm text-gray-600">Eng Yaxshi</p>
                        {% if test.best_score %}
                        <p class="text-2xl font-bold text-blue-600">{{ test.best_score|floatformat:1 }}</p>
                        {% else %}
                        <p class="text-2xl font-bold text-gray-400">-</p>
                        {% endif %}
                    </div>
                </div>
                
                <!-- Description -->
                {% if test.description %}
                <p class="text-sm text-gray-600 mb-4">{{ test.description|truncatewords:20 }}</p>
                {% endif %}
                
                <!-- Sections -->
                <div class="mb-4">
                    <p class="text-xs text-gray-500 mb-2">Sections:</p>
                    <div class="flex flex-wrap gap-1">
                        {% for section in test.sections.all %}
                        <span class="inline-block px-2 py-1 bg-gray-100 rounded text-xs">
                            {{ section.title }}
                        </span>
                        {% endfor %}
                    </div>
                </div>
                
                <!-- Start Button -->
                <a href="{% url 'practice_start_listening' test.id %}" 
                   class="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition">
                    Boshlash →
                </a>
            </div>
        </div>
        {% empty %}
        <div class="col-span-3 text-center py-12">
            <p class="text-gray-500 mb-4">Listening practice testlar yo'q</p>
        </div>
        {% endfor %}
    </div>
</div>
{% endblock %}
```

---

## 3️⃣ URL ROUTING UPDATE

**Fayl:** `urls.py`

```python
urlpatterns = [
    # ... mavjud patterns
    
    # === MOCK SESSION MANAGEMENT ===
    path('mock/session/<int:session_id>/close/', mock_views.mock_close_session, name='mock_close_session'),
    path('mock/session/<int:session_id>/reopen/', mock_views.mock_reopen_session, name='mock_reopen_session'),
    
    # === INDIVIDUAL SECTION PRACTICE ===
    path('practice/', mock_views.practice_sections_home, name='practice_sections_home'),
    
    # Listening Practice
    path('practice/listening/', mock_views.practice_listening_list, name='practice_listening_list'),
    path('practice/listening/<int:test_id>/start/', mock_views.practice_start_listening, name='practice_start_listening'),
    
    # Reading Practice
    path('practice/reading/', mock_views.practice_reading_list, name='practice_reading_list'),
    path('practice/reading/<int:test_id>/start/', mock_views.practice_start_reading, name='practice_start_reading'),
    
    # Writing Practice
    path('practice/writing/', mock_views.practice_writing_list, name='practice_writing_list'),
    path('practice/writing/<int:test_id>/start/', mock_views.practice_start_writing, name='practice_start_writing'),
]
```

---

## 4️⃣ STUDENT NAVIGATION UPDATE

**Fayl:** `student_base.html`

```html
<nav class="bg-white shadow">
    <div class="max-w-7xl mx-auto px-4">
        <div class="flex items-center gap-8">
            <!-- ... logo ... -->
            
            <a href="{% url 'student_dashboard' %}" class="...">
                Dashboard
            </a>
            
            <!-- Practice Dropdown -->
            <div class="relative group">
                <button class="flex items-center gap-1 text-gray-700 hover:text-blue-600">
                    Practice
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
                
                <!-- Dropdown -->
                <div class="absolute left-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-2 hidden group-hover:block">
                    <a href="{% url 'practice_sections_home' %}" 
                       class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                        Practice Home
                    </a>
                    <a href="{% url 'practice_listening_list' %}" 
                       class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                        🎧 Listening
                    </a>
                    <a href="{% url 'practice_reading_list' %}" 
                       class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                        📖 Reading
                    </a>
                    <a href="{% url 'practice_writing_list' %}" 
                       class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                        ✍️ Writing
                    </a>
                </div>
            </div>
            
            <a href="{% url 'practice_history' %}" class="...">
                Tarix
            </a>
        </div>
    </div>
</nav>
```

---

## 🧪 SINOV (TESTING)

### Test Ssenariysi:

### **1. Mock Session Close**
```
Admin:
1. Mock sessions list'ga kiring
2. Bir sessiyani toping (status: in_progress)
3. [Yopish] tugmasini bosing
4. Confirmation page ochiladi
5. [Tugallash] yoki [Bekor qilish] tanlang
6. Session status o'zgaradi
```

### **2. Individual Section Practice**
```
Student:
1. /practice/ ga kiring
2. 3 ta katta karta ko'rinadi:
   - 🎧 Listening
   - 📖 Reading
   - ✍️ Writing
3. Listening'ni tanlang
4. Test ro'yxati ochiladi
5. Bir test'ni boshlang
6. Faqat Listening test
7. Submit → Instant feedback
```

### **3. Progress Tracking**
```
Student:
1. Listening practice 3 marta
2. Reading practice 2 marta
3. Dashboard'da:
   - Listening: 3 attempts, best: 7.5
   - Reading: 2 attempts, best: 6.5
4. Recent attempts list'da hammasi
```

---

## ✅ ACCEPTANCE CRITERIA:

### Session Management:
1. ✅ Admin sessiyani yopa oladi
2. ✅ "Complete" va "Cancel" options
3. ✅ Confirmation page
4. ✅ Status update
5. ✅ Reopen option (24 hours ichida)

### Individual Practice:
6. ✅ Practice home - 3 ta section
7. ✅ Faqat Listening practice
8. ✅ Faqat Reading practice
9. ✅ Faqat Writing practice
10. ✅ Separate progress tracking
11. ✅ Best score per section
12. ✅ Attempt count per section

---

## 📊 WORKFLOW:

### **Mock Session Lifecycle:**
```
1. Admin: Create Session → (status: waiting)
2. Admin: START → (status: in_progress)
3. Students: Join and complete
4. Admin: Close Session → (status: completed)
   OR
   Admin: Cancel Session → (status: cancelled)
```

### **Individual Practice:**
```
1. Student: Practice Home
2. Choose: Listening / Reading / Writing
3. Select test from list
4. Complete ONLY that section
5. Get instant feedback
6. Track progress separately
```

---

## 🎯 FARQI:

### **Hozir (ETAP 6):**
```
Practice = To'liq test (L + R + W)
- Faqat full test
- Bir yo'l
```

### **Endi (ETAP 12):**
```
Practice = Individual sections
- Faqat Listening ✅
- Faqat Reading ✅
- Faqat Writing ✅
- To'liq test ham mumkin ✅
```

---

## 🎨 PRACTICE HOME SCREENSHOT:

```
┌──────────────────────────────────────────┐
│  PRACTICE MODE                           │
│  O'zingiz uchun mashq qiling            │
├──────────────────────────────────────────┤
│  ┌────────┐  ┌────────┐  ┌────────┐    │
│  │  🎧    │  │  📖    │  │  ✍️    │    │
│  │Listening│  │Reading │  │Writing │    │
│  │  12    │  │   8    │  │   5    │    │
│  │ tests  │  │ tests  │  │ tests  │    │
│  └────────┘  └────────┘  └────────┘    │
│                                          │
│  Oxirgi Mashqlar:                       │
│  🎧 Listening - 7.5 - 2 soat oldin      │
│  📖 Reading - 6.5 - kecha               │
│  ✍️ Writing - Task 1 - 2 kun oldin     │
└──────────────────────────────────────────┘
```

---

**ETAP 12 TAYYOR!** ✅

Admin:
- ✅ Sessiyani yopa oladi
- ✅ Complete/Cancel

Student:
- ✅ Faqat Listening mashq qiladi
- ✅ Faqat Reading mashq qiladi
- ✅ Faqat Writing mashq qiladi
- ✅ Alohida progress tracking

**Implementatsiya qilaylikmi?** 😊
