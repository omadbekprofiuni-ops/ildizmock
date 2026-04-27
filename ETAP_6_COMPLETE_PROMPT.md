# ETAP 6: PRACTICE MODE - MUSTAQIL MASHQ QILISH

**Maqsad:** Talaba mock testdan tashqari, uyda o'zi mashq qilish uchun test topshiradi. Vaqt limit yo'q (yoki bo'sh), javob topshirgandan keyin darhol to'g'ri javoblarni ko'radi, va o'z progressini kuzatadi.

---

## 📋 PRACTICE MODE VS MOCK MODE

| Xususiyat | Mock Mode | Practice Mode |
|-----------|-----------|---------------|
| Admin boshqaradi | ✅ Ha (START/NEXT) | ❌ Yo'q |
| Sinxron test | ✅ Ha (barcha talaba bir vaqtda) | ❌ Yo'q (har kim o'z vaqtida) |
| Vaqt limit | ✅ Qattiq (30/60 min) | 🟡 Optional (yoki yo'q) |
| Instant feedback | ❌ Yo'q (baholanadi keyin) | ✅ Ha (darhol) |
| Writing baholash | ✅ Ustoz baholaydi | ❌ Baholanmaydi (faqat yozadi) |
| Speaking | ✅ Yuzma-yuz | ❌ Yo'q |
| Sertifikat | ✅ Ha | ❌ Yo'q |
| Takrorlash | ❌ Bir marta | ✅ Cheksiz |
| Natija saqlanadi | ✅ Ha (official) | ✅ Ha (practice history) |

---

## 🔧 QILINISHI KERAK ISHLAR

---

## 1️⃣ TEST MARKING (Practice uchun belgilash)

### A) Model yangilanishi

**Fayl:** `tests/models.py`

```python
class ListeningTest(models.Model):
    # ... mavjud maydonlar
    
    # YANGI: Practice Mode
    is_practice_enabled = models.BooleanField(
        default=False,
        help_text='Talabalar practice mode uchun ishlatishi mumkinmi?'
    )
    practice_time_limit = models.IntegerField(
        null=True,
        blank=True,
        help_text='Practice mode vaqt limit (daqiqada). Bo\'sh qoldirilsa - limit yo\'q'
    )
    
    class Meta:
        db_table = 'listening_tests'


class ReadingTest(models.Model):
    # ... mavjud maydonlar
    
    is_practice_enabled = models.BooleanField(default=False)
    practice_time_limit = models.IntegerField(null=True, blank=True)
    
    class Meta:
        db_table = 'reading_tests'


class WritingTest(models.Model):
    # ... mavjud maydonlar
    
    is_practice_enabled = models.BooleanField(default=False)
    practice_time_limit = models.IntegerField(null=True, blank=True)
    
    class Meta:
        db_table = 'writing_tests'
```

---

### B) Admin Panel Update

**Fayl:** `tests/admin.py`

```python
@admin.register(ListeningTest)
class ListeningTestAdmin(admin.ModelAdmin):
    list_display = ['name', 'library', 'duration_minutes', 'is_practice_enabled', 'action_buttons', 'created_at']
    list_filter = ['library', 'is_practice_enabled', 'created_at']
    
    fieldsets = [
        ('Basic Information', {
            'fields': ['library', 'name', 'description', 'audio_file', 'duration_minutes']
        }),
        ('Practice Mode', {
            'fields': ['is_practice_enabled', 'practice_time_limit'],
            'classes': ['collapse'],
        }),
    ]
```

---

## 2️⃣ PRACTICE ATTEMPT MODEL

### A) Model yaratish

**Fayl:** `mock/models.py`

```python
class PracticeAttempt(TimeStampedModel):
    """Talaba practice qilganda"""
    
    # Student
    student_profile = models.ForeignKey(
        'StudentProfile',
        on_delete=models.CASCADE,
        related_name='practice_attempts'
    )
    
    # Test info
    SECTION_CHOICES = [
        ('listening', 'Listening'),
        ('reading', 'Reading'),
        ('writing', 'Writing'),
    ]
    section = models.CharField(max_length=20, choices=SECTION_CHOICES)
    
    # ForeignKeys to actual tests
    listening_test = models.ForeignKey('ListeningTest', null=True, blank=True, on_delete=models.CASCADE)
    reading_test = models.ForeignKey('ReadingTest', null=True, blank=True, on_delete=models.CASCADE)
    writing_test = models.ForeignKey('WritingTest', null=True, blank=True, on_delete=models.CASCADE)
    
    # Answers
    answers = models.JSONField(default=dict)  # {question_id: answer}
    
    # Writing (agar writing test bo'lsa)
    writing_task1_text = models.TextField(blank=True)
    writing_task2_text = models.TextField(blank=True)
    
    # Score
    score = models.FloatField(null=True, blank=True)  # Band score (0-9)
    correct_count = models.IntegerField(default=0)
    total_count = models.IntegerField(default=0)
    
    # Time tracking
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    time_taken_seconds = models.IntegerField(null=True, blank=True)
    
    # Status
    STATUS_CHOICES = [
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
    ]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='in_progress')
    
    class Meta:
        db_table = 'practice_attempts'
        ordering = ['-started_at']
    
    def __str__(self):
        return f"{self.student_profile.user.get_full_name()} - {self.section} - {self.started_at.date()}"
    
    def calculate_score(self):
        """Score hisoblash (faqat Listening va Reading uchun)"""
        if self.section not in ['listening', 'reading']:
            return None
        
        if self.total_count == 0:
            return 0
        
        percentage = (self.correct_count / self.total_count) * 100
        
        # IELTS band conversion (simplified)
        if percentage >= 90: return 9.0
        elif percentage >= 82: return 8.5
        elif percentage >= 75: return 8.0
        elif percentage >= 67: return 7.5
        elif percentage >= 60: return 7.0
        elif percentage >= 52: return 6.5
        elif percentage >= 45: return 6.0
        elif percentage >= 37: return 5.5
        elif percentage >= 30: return 5.0
        elif percentage >= 23: return 4.5
        elif percentage >= 16: return 4.0
        else: return 3.5
```

---

## 3️⃣ PRACTICE TEST LIST (Talaba uchun)

### A) View

**Fayl:** `mock/views.py`

```python
from django.contrib.auth.decorators import login_required
from django.shortcuts import render, get_object_or_404, redirect
from tests.models import ListeningTest, ReadingTest, WritingTest

@login_required
def practice_test_list(request):
    """Practice uchun mavjud testlar ro'yxati"""
    
    profile = request.user.student_profile
    
    # Get practice-enabled tests
    listening_tests = ListeningTest.objects.filter(
        library=profile.library,
        is_practice_enabled=True
    ).order_by('-created_at')
    
    reading_tests = ReadingTest.objects.filter(
        library=profile.library,
        is_practice_enabled=True
    ).order_by('-created_at')
    
    writing_tests = WritingTest.objects.filter(
        library=profile.library,
        is_practice_enabled=True
    ).order_by('-created_at')
    
    # Get recent attempts
    recent_attempts = PracticeAttempt.objects.filter(
        student_profile=profile
    )[:10]
    
    return render(request, 'mock/practice_list.html', {
        'listening_tests': listening_tests,
        'reading_tests': reading_tests,
        'writing_tests': writing_tests,
        'recent_attempts': recent_attempts,
    })
```

---

### B) Template

**Fayl:** `mock/templates/mock/practice_list.html`

```html
{% extends 'student_base.html' %}

{% block content %}
<div class="max-w-7xl mx-auto py-8 px-4">
    <div class="bg-gradient-to-r from-green-600 to-teal-600 rounded-lg shadow-lg p-8 mb-8 text-white">
        <h1 class="text-3xl font-bold mb-2">Practice Mode</h1>
        <p class="text-green-100">O'z vaqtingizda mashq qiling, darhol natijani ko'ring</p>
    </div>
    
    <!-- Recent Attempts -->
    {% if recent_attempts %}
    <div class="bg-white rounded-lg shadow p-6 mb-8">
        <h2 class="text-xl font-bold mb-4">Oxirgi Mashqlar</h2>
        
        <div class="space-y-3">
            {% for attempt in recent_attempts %}
            <div class="flex items-center justify-between border-b pb-3 last:border-0">
                <div>
                    <p class="font-semibold">{{ attempt.get_section_display }}</p>
                    <p class="text-sm text-gray-600">{{ attempt.started_at|date:"d M Y, H:i" }}</p>
                </div>
                
                <div class="text-right">
                    {% if attempt.score %}
                    <p class="text-2xl font-bold text-green-600">{{ attempt.score|floatformat:1 }}</p>
                    <p class="text-xs text-gray-500">{{ attempt.correct_count }}/{{ attempt.total_count }}</p>
                    {% else %}
                    <span class="text-sm text-gray-400">Tugallanmagan</span>
                    {% endif %}
                </div>
            </div>
            {% endfor %}
        </div>
    </div>
    {% endif %}
    
    <!-- Listening Tests -->
    <div class="mb-8">
        <h2 class="text-2xl font-bold mb-4">🎧 Listening Practice</h2>
        
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {% for test in listening_tests %}
            <div class="bg-white rounded-lg shadow hover:shadow-xl transition p-6">
                <h3 class="font-bold text-lg mb-2">{{ test.name }}</h3>
                <p class="text-sm text-gray-600 mb-4">{{ test.description|truncatewords:15 }}</p>
                
                <div class="flex items-center justify-between mb-4">
                    <div class="text-sm text-gray-500">
                        {% if test.practice_time_limit %}
                        ⏱️ {{ test.practice_time_limit }} min
                        {% else %}
                        ⏱️ Vaqt limit yo'q
                        {% endif %}
                    </div>
                    
                    <div class="text-sm text-gray-500">
                        {{ test.sections.count }} section
                    </div>
                </div>
                
                <a href="{% url 'practice_start_listening' test.id %}" 
                   class="block w-full bg-green-600 text-white text-center py-2 rounded-lg font-semibold hover:bg-green-700">
                    Boshlash
                </a>
            </div>
            {% empty %}
            <div class="col-span-3 text-center text-gray-500 py-8">
                Practice uchun Listening test yo'q
            </div>
            {% endfor %}
        </div>
    </div>
    
    <!-- Reading Tests -->
    <div class="mb-8">
        <h2 class="text-2xl font-bold mb-4">📖 Reading Practice</h2>
        
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {% for test in reading_tests %}
            <div class="bg-white rounded-lg shadow hover:shadow-xl transition p-6">
                <h3 class="font-bold text-lg mb-2">{{ test.name }}</h3>
                <p class="text-sm text-gray-600 mb-4">{{ test.description|truncatewords:15 }}</p>
                
                <div class="flex items-center justify-between mb-4">
                    <div class="text-sm text-gray-500">
                        {% if test.practice_time_limit %}
                        ⏱️ {{ test.practice_time_limit }} min
                        {% else %}
                        ⏱️ Vaqt limit yo'q
                        {% endif %}
                    </div>
                    
                    <div class="text-sm text-gray-500">
                        {{ test.passages.count }} passage
                    </div>
                </div>
                
                <a href="{% url 'practice_start_reading' test.id %}" 
                   class="block w-full bg-blue-600 text-white text-center py-2 rounded-lg font-semibold hover:bg-blue-700">
                    Boshlash
                </a>
            </div>
            {% empty %}
            <div class="col-span-3 text-center text-gray-500 py-8">
                Practice uchun Reading test yo'q
            </div>
            {% endfor %}
        </div>
    </div>
    
    <!-- Writing Tests -->
    <div class="mb-8">
        <h2 class="text-2xl font-bold mb-4">✍️ Writing Practice</h2>
        
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {% for test in writing_tests %}
            <div class="bg-white rounded-lg shadow hover:shadow-xl transition p-6">
                <h3 class="font-bold text-lg mb-2">{{ test.name }}</h3>
                <p class="text-sm text-gray-600 mb-4">{{ test.description|truncatewords:15 }}</p>
                
                <div class="flex items-center justify-between mb-4">
                    <div class="text-sm text-gray-500">
                        {% if test.practice_time_limit %}
                        ⏱️ {{ test.practice_time_limit }} min
                        {% else %}
                        ⏱️ Vaqt limit yo'q
                        {% endif %}
                    </div>
                    
                    <div class="text-sm text-gray-500">
                        Task 1 + Task 2
                    </div>
                </div>
                
                <a href="{% url 'practice_start_writing' test.id %}" 
                   class="block w-full bg-orange-600 text-white text-center py-2 rounded-lg font-semibold hover:bg-orange-700">
                    Boshlash
                </a>
            </div>
            {% empty %}
            <div class="col-span-3 text-center text-gray-500 py-8">
                Practice uchun Writing test yo'q
            </div>
            {% endfor %}
        </div>
    </div>
</div>
{% endblock %}
```

---

## 4️⃣ PRACTICE TEST INTERFACE

### A) Listening Practice View

**Fayl:** `mock/views.py`

```python
from django.utils import timezone

@login_required
def practice_start_listening(request, test_id):
    """Listening practice boshlash"""
    
    test = get_object_or_404(
        ListeningTest,
        id=test_id,
        library=request.user.student_profile.library,
        is_practice_enabled=True
    )
    
    # Create new attempt
    attempt = PracticeAttempt.objects.create(
        student_profile=request.user.student_profile,
        section='listening',
        listening_test=test,
        status='in_progress',
        total_count=sum(section.questions.count() for section in test.sections.all())
    )
    
    return redirect('practice_listening', attempt_id=attempt.id)


@login_required
def practice_listening(request, attempt_id):
    """Listening practice test interface"""
    
    attempt = get_object_or_404(
        PracticeAttempt,
        id=attempt_id,
        student_profile=request.user.student_profile,
        section='listening'
    )
    
    test = attempt.listening_test
    
    if request.method == 'POST':
        # Save answers
        answers = {}
        correct_count = 0
        
        for section in test.sections.all():
            for q in section.questions.all():
                user_answer = request.POST.get(f'q_{q.id}', '').strip()
                answers[str(q.id)] = user_answer
                
                # Check if correct
                if user_answer.lower() == q.correct_answer.lower():
                    correct_count += 1
        
        # Save attempt
        attempt.answers = answers
        attempt.correct_count = correct_count
        attempt.score = attempt.calculate_score()
        attempt.status = 'completed'
        attempt.completed_at = timezone.now()
        
        # Time taken
        time_diff = timezone.now() - attempt.started_at
        attempt.time_taken_seconds = int(time_diff.total_seconds())
        
        attempt.save()
        
        # Redirect to results
        return redirect('practice_result', attempt_id=attempt.id)
    
    # GET - show test
    return render(request, 'mock/practice_listening.html', {
        'attempt': attempt,
        'test': test,
        'time_limit': test.practice_time_limit,
    })
```

---

### B) Listening Practice Template

**Fayl:** `mock/templates/mock/practice_listening.html`

```html
{% extends 'student_base.html' %}

{% block content %}
<div class="max-w-4xl mx-auto py-8 px-4">
    <!-- Practice Mode Banner -->
    <div class="bg-green-50 border-l-4 border-green-500 text-green-800 p-4 mb-6">
        <p class="font-bold">✨ PRACTICE MODE</p>
        <p class="text-sm">Javob topshirgandan keyin darhol to'g'ri javoblarni ko'rasiz</p>
    </div>
    
    <!-- Timer (if time limit exists) -->
    {% if time_limit %}
    <div class="bg-white rounded-lg shadow p-4 mb-6 flex justify-between items-center">
        <h1 class="text-2xl font-bold">{{ test.name }}</h1>
        <div class="text-3xl font-mono text-orange-600 font-bold" id="timer">{{ time_limit }}:00</div>
    </div>
    {% else %}
    <div class="bg-white rounded-lg shadow p-4 mb-6">
        <h1 class="text-2xl font-bold">{{ test.name }}</h1>
        <p class="text-sm text-gray-600">Vaqt limit yo'q - o'z sur'atingizda ishlang</p>
    </div>
    {% endif %}
    
    <!-- Audio Player -->
    <div class="bg-white rounded-lg shadow p-6 mb-6">
        <audio id="audio-player" controls class="w-full">
            <source src="{{ test.audio_file.url }}" type="audio/mpeg">
        </audio>
        <p class="text-sm text-gray-600 mt-2">Audio istalgan vaqt qayta tinglash mumkin</p>
    </div>
    
    <!-- Questions -->
    <form id="practice-form" method="post">
        {% csrf_token %}
        
        {% for section in test.sections.all %}
        <div class="bg-white rounded-lg shadow p-6 mb-6">
            <h2 class="text-xl font-bold mb-4">{{ section.title }}</h2>
            
            {% if section.image %}
            <div class="mb-4">
                <img src="{{ section.image.url }}" alt="{{ section.title }}" class="max-w-full h-auto rounded border">
            </div>
            {% endif %}
            
            {% if section.instructions %}
            <div class="bg-blue-50 border border-blue-200 rounded p-4 mb-4">
                <p class="text-sm">{{ section.instructions }}</p>
            </div>
            {% endif %}
            
            {% for q in section.questions.all %}
            <div class="mb-4 pb-4 border-b last:border-0">
                <p class="font-semibold mb-2">{{ forloop.counter }}. {{ q.question_text }}</p>
                
                {% if q.image %}
                <div class="mb-3">
                    <img src="{{ q.image.url }}" alt="Question {{ forloop.counter }}" class="max-w-md h-auto rounded border">
                </div>
                {% endif %}
                
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
                {% elif q.question_type == 'true_false' %}
                    <label class="block mb-1">
                        <input type="radio" name="q_{{ q.id }}" value="True" class="mr-2">
                        True
                    </label>
                    <label class="block mb-1">
                        <input type="radio" name="q_{{ q.id }}" value="False" class="mr-2">
                        False
                    </label>
                {% endif %}
            </div>
            {% endfor %}
        </div>
        {% endfor %}
        
        <div class="text-center">
            <button type="submit" 
                    class="bg-green-600 text-white px-12 py-4 rounded-lg font-semibold text-lg hover:bg-green-700">
                Tugatish va Natijani Ko'rish
            </button>
        </div>
    </form>
</div>

<script>
{% if time_limit %}
// Timer
let seconds = {{ time_limit }} * 60;
const timerEl = document.getElementById('timer');

const interval = setInterval(() => {
    seconds--;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    timerEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    
    if (seconds <= 0) {
        clearInterval(interval);
        alert('Vaqt tugadi!');
        document.getElementById('practice-form').submit();
    }
}, 1000);
{% endif %}
</script>
{% endblock %}
```

---

## 5️⃣ PRACTICE RESULT PAGE (Instant Feedback)

### A) View

```python
@login_required
def practice_result(request, attempt_id):
    """Practice natijasi - instant feedback bilan"""
    
    attempt = get_object_or_404(
        PracticeAttempt,
        id=attempt_id,
        student_profile=request.user.student_profile
    )
    
    # Get test
    test = None
    if attempt.section == 'listening':
        test = attempt.listening_test
    elif attempt.section == 'reading':
        test = attempt.reading_test
    elif attempt.section == 'writing':
        test = attempt.writing_test
    
    # Build detailed results
    results = []
    
    if attempt.section == 'listening':
        for section in test.sections.all():
            section_results = []
            for q in section.questions.all():
                user_answer = attempt.answers.get(str(q.id), '')
                is_correct = user_answer.lower() == q.correct_answer.lower()
                
                section_results.append({
                    'question': q,
                    'user_answer': user_answer,
                    'correct_answer': q.correct_answer,
                    'is_correct': is_correct,
                })
            
            results.append({
                'section': section,
                'questions': section_results,
            })
    
    elif attempt.section == 'reading':
        for passage in test.passages.all():
            passage_results = []
            for q in passage.questions.all():
                user_answer = attempt.answers.get(str(q.id), '')
                is_correct = user_answer.lower() == q.correct_answer.lower()
                
                passage_results.append({
                    'question': q,
                    'user_answer': user_answer,
                    'correct_answer': q.correct_answer,
                    'is_correct': is_correct,
                })
            
            results.append({
                'passage': passage,
                'questions': passage_results,
            })
    
    return render(request, 'mock/practice_result.html', {
        'attempt': attempt,
        'test': test,
        'results': results,
    })
```

---

### B) Result Template

**Fayl:** `mock/templates/mock/practice_result.html`

```html
{% extends 'student_base.html' %}

{% block content %}
<div class="max-w-6xl mx-auto py-8 px-4">
    <!-- Result Header -->
    <div class="bg-gradient-to-r from-green-600 to-teal-600 rounded-lg shadow-lg p-8 mb-8 text-white">
        <div class="flex items-center justify-between">
            <div>
                <h1 class="text-3xl font-bold mb-2">Practice Natijasi</h1>
                <p class="text-green-100">{{ test.name }}</p>
            </div>
            
            <div class="text-center">
                <p class="text-sm text-green-100 mb-1">Band Score</p>
                <p class="text-6xl font-bold">{{ attempt.score|floatformat:1 }}</p>
            </div>
        </div>
        
        <div class="mt-6 grid grid-cols-3 gap-4">
            <div class="bg-white bg-opacity-20 rounded p-3 text-center">
                <p class="text-sm text-green-100">To'g'ri</p>
                <p class="text-2xl font-bold">{{ attempt.correct_count }}</p>
            </div>
            
            <div class="bg-white bg-opacity-20 rounded p-3 text-center">
                <p class="text-sm text-green-100">Noto'g'ri</p>
                <p class="text-2xl font-bold">{{ attempt.total_count|add:"-"|add:attempt.correct_count }}</p>
            </div>
            
            <div class="bg-white bg-opacity-20 rounded p-3 text-center">
                <p class="text-sm text-green-100">Vaqt</p>
                <p class="text-2xl font-bold">{{ attempt.time_taken_seconds|floatformat:0|divisibleby:60 }} min</p>
            </div>
        </div>
    </div>
    
    <!-- Detailed Results -->
    {% for result_group in results %}
    <div class="bg-white rounded-lg shadow p-6 mb-6">
        {% if result_group.section %}
        <h2 class="text-xl font-bold mb-4">{{ result_group.section.title }}</h2>
        {% elif result_group.passage %}
        <h2 class="text-xl font-bold mb-4">{{ result_group.passage.title }}</h2>
        {% endif %}
        
        <div class="space-y-4">
            {% for item in result_group.questions %}
            <div class="border-l-4 {% if item.is_correct %}border-green-500 bg-green-50{% else %}border-red-500 bg-red-50{% endif %} p-4">
                <div class="flex items-start gap-3">
                    <div class="flex-shrink-0">
                        {% if item.is_correct %}
                        <span class="inline-block w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-bold">✓</span>
                        {% else %}
                        <span class="inline-block w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center font-bold">✗</span>
                        {% endif %}
                    </div>
                    
                    <div class="flex-1">
                        <p class="font-semibold mb-2">{{ item.question.question_text }}</p>
                        
                        <div class="space-y-1 text-sm">
                            <p>
                                <span class="text-gray-600">Sizning javobingiz:</span>
                                <span class="{% if item.is_correct %}text-green-700 font-semibold{% else %}text-red-700{% endif %}">
                                    {{ item.user_answer|default:"<em>(javob berilmagan)</em>" }}
                                </span>
                            </p>
                            
                            {% if not item.is_correct %}
                            <p>
                                <span class="text-gray-600">To'g'ri javob:</span>
                                <span class="text-green-700 font-semibold">{{ item.correct_answer }}</span>
                            </p>
                            {% endif %}
                        </div>
                        
                        {% if item.question.explanation %}
                        <div class="mt-2 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
                            <p class="font-semibold text-blue-900 mb-1">Tushuntirish:</p>
                            <p class="text-blue-800">{{ item.question.explanation }}</p>
                        </div>
                        {% endif %}
                    </div>
                </div>
            </div>
            {% endfor %}
        </div>
    </div>
    {% endfor %}
    
    <!-- Actions -->
    <div class="flex gap-4 justify-center">
        <a href="{% url 'practice_test_list' %}" 
           class="bg-gray-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-gray-700">
            ← Practice Ro'yxatiga
        </a>
        
        <a href="{% url 'practice_start_' %}{{ attempt.section }} {{ test.id }}" 
           class="bg-green-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-green-700">
            🔄 Qayta Urinish
        </a>
    </div>
</div>
{% endblock %}
```

---

## 6️⃣ PRACTICE HISTORY

### A) View

```python
@login_required
def practice_history(request):
    """Talabaning barcha practice tarixi"""
    
    attempts = PracticeAttempt.objects.filter(
        student_profile=request.user.student_profile,
        status='completed'
    ).select_related('listening_test', 'reading_test', 'writing_test').order_by('-completed_at')
    
    # Statistics
    listening_attempts = attempts.filter(section='listening')
    reading_attempts = attempts.filter(section='reading')
    writing_attempts = attempts.filter(section='writing')
    
    avg_listening = listening_attempts.aggregate(Avg('score'))['score__avg']
    avg_reading = reading_attempts.aggregate(Avg('score'))['score__avg']
    
    return render(request, 'mock/practice_history.html', {
        'attempts': attempts,
        'listening_count': listening_attempts.count(),
        'reading_count': reading_attempts.count(),
        'writing_count': writing_attempts.count(),
        'avg_listening': avg_listening,
        'avg_reading': avg_reading,
    })
```

---

### B) Template

```html
{% extends 'student_base.html' %}

{% block content %}
<div class="max-w-6xl mx-auto py-8 px-4">
    <h1 class="text-3xl font-bold mb-8">Practice Tarixi</h1>
    
    <!-- Statistics -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div class="bg-white rounded-lg shadow p-4 text-center">
            <p class="text-sm text-gray-500 mb-1">Jami Urinishlar</p>
            <p class="text-3xl font-bold text-gray-900">{{ attempts.count }}</p>
        </div>
        
        <div class="bg-white rounded-lg shadow p-4 text-center">
            <p class="text-sm text-gray-500 mb-1">Listening</p>
            <p class="text-3xl font-bold text-green-600">{{ listening_count }}</p>
            {% if avg_listening %}
            <p class="text-xs text-gray-500">O'rtacha: {{ avg_listening|floatformat:1 }}</p>
            {% endif %}
        </div>
        
        <div class="bg-white rounded-lg shadow p-4 text-center">
            <p class="text-sm text-gray-500 mb-1">Reading</p>
            <p class="text-3xl font-bold text-blue-600">{{ reading_count }}</p>
            {% if avg_reading %}
            <p class="text-xs text-gray-500">O'rtacha: {{ avg_reading|floatformat:1 }}</p>
            {% endif %}
        </div>
        
        <div class="bg-white rounded-lg shadow p-4 text-center">
            <p class="text-sm text-gray-500 mb-1">Writing</p>
            <p class="text-3xl font-bold text-orange-600">{{ writing_count }}</p>
        </div>
    </div>
    
    <!-- Attempts List -->
    <div class="bg-white rounded-lg shadow overflow-hidden">
        <table class="w-full">
            <thead class="bg-gray-50">
                <tr>
                    <th class="px-6 py-3 text-left">Sana</th>
                    <th class="px-6 py-3 text-left">Section</th>
                    <th class="px-6 py-3 text-left">Test</th>
                    <th class="px-6 py-3 text-center">To'g'ri</th>
                    <th class="px-6 py-3 text-center">Band Score</th>
                    <th class="px-6 py-3 text-center">Vaqt</th>
                    <th class="px-6 py-3"></th>
                </tr>
            </thead>
            <tbody>
                {% for attempt in attempts %}
                <tr class="border-t hover:bg-gray-50">
                    <td class="px-6 py-4">{{ attempt.completed_at|date:"d M Y, H:i" }}</td>
                    <td class="px-6 py-4">
                        <span class="inline-block px-2 py-1 rounded text-xs font-semibold
                                     {% if attempt.section == 'listening' %}bg-green-100 text-green-800
                                     {% elif attempt.section == 'reading' %}bg-blue-100 text-blue-800
                                     {% else %}bg-orange-100 text-orange-800{% endif %}">
                            {{ attempt.get_section_display }}
                        </span>
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-600">
                        {% if attempt.listening_test %}{{ attempt.listening_test.name }}{% endif %}
                        {% if attempt.reading_test %}{{ attempt.reading_test.name }}{% endif %}
                        {% if attempt.writing_test %}{{ attempt.writing_test.name }}{% endif %}
                    </td>
                    <td class="px-6 py-4 text-center">
                        <span class="font-semibold">{{ attempt.correct_count }}/{{ attempt.total_count }}</span>
                    </td>
                    <td class="px-6 py-4 text-center">
                        {% if attempt.score %}
                        <span class="text-xl font-bold text-green-600">{{ attempt.score|floatformat:1 }}</span>
                        {% else %}
                        -
                        {% endif %}
                    </td>
                    <td class="px-6 py-4 text-center text-sm">
                        {{ attempt.time_taken_seconds|floatformat:0|divisibleby:60 }} min
                    </td>
                    <td class="px-6 py-4 text-right">
                        <a href="{% url 'practice_result' attempt.id %}" 
                           class="text-blue-600 hover:underline">
                            Ko'rish
                        </a>
                    </td>
                </tr>
                {% empty %}
                <tr>
                    <td colspan="7" class="px-6 py-12 text-center text-gray-500">
                        Hali practice qilmadingiz
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

## 7️⃣ READING VA WRITING PRACTICE

**Reading va Writing practice interfeyslari Listening bilan bir xil mantiqda qilinadi:**

1. **Reading Practice:**
   - `practice_start_reading(test_id)`
   - `practice_reading(attempt_id)`
   - Passage + Questions
   - Submit → Instant feedback

2. **Writing Practice:**
   - `practice_start_writing(test_id)`
   - `practice_writing(attempt_id)`
   - Task 1 + Task 2 textarea
   - **Feedback yo'q** (faqat yoziladi va saqlanadi)
   - Talaba o'z matnini ko'radi va word count'ni biladi

---

## 8️⃣ URL ROUTING

**Fayl:** `urls.py`

```python
urlpatterns = [
    # ... mavjud patterns
    
    # Practice Mode
    path('practice/', mock_views.practice_test_list, name='practice_test_list'),
    path('practice/history/', mock_views.practice_history, name='practice_history'),
    
    # Listening Practice
    path('practice/listening/<int:test_id>/start/', mock_views.practice_start_listening, name='practice_start_listening'),
    path('practice/listening/<int:attempt_id>/', mock_views.practice_listening, name='practice_listening'),
    
    # Reading Practice
    path('practice/reading/<int:test_id>/start/', mock_views.practice_start_reading, name='practice_start_reading'),
    path('practice/reading/<int:attempt_id>/', mock_views.practice_reading, name='practice_reading'),
    
    # Writing Practice
    path('practice/writing/<int:test_id>/start/', mock_views.practice_start_writing, name='practice_start_writing'),
    path('practice/writing/<int:attempt_id>/', mock_views.practice_writing, name='practice_writing'),
    
    # Results
    path('practice/result/<int:attempt_id>/', mock_views.practice_result, name='practice_result'),
]
```

---

## 9️⃣ NAVIGATION UPDATE

**Fayl:** `student_base.html`

```html
<nav class="bg-white shadow">
    <div class="max-w-7xl mx-auto px-4">
        <div class="flex justify-between items-center h-16">
            <div class="flex items-center gap-8">
                <h1 class="text-xl font-bold text-blue-600">ILDIZ Mock</h1>
                
                <a href="{% url 'student_dashboard' %}" 
                   class="text-gray-700 hover:text-blue-600">
                    Dashboard
                </a>
                
                <a href="{% url 'practice_test_list' %}" 
                   class="text-gray-700 hover:text-blue-600">
                    Practice
                </a>
                
                <a href="{% url 'practice_history' %}" 
                   class="text-gray-700 hover:text-blue-600">
                    Tarix
                </a>
            </div>
            
            <!-- User menu -->
        </div>
    </div>
</nav>
```

---

## 🧪 SINOV (TESTING)

### Test Ssenariysi:

1. **Admin: Practice enable**
   - Listening/Reading/Writing testlardan birini tanlang
   - `is_practice_enabled = True` qiling
   - `practice_time_limit = 30` (yoki bo'sh)
   - Save

2. **Student Login**
   - Student sifatida login
   - `/practice/` ga kiring

3. **Practice Test Start**
   - Listening test tanlang
   - "Boshlash" tugmasini bosing
   - Test interface ochilishi kerak

4. **Test Topshirish**
   - Barcha savollarga javob bering
   - "Tugatish" tugmasini bosing
   - Instant result sahifasi ochilishi kerak

5. **Instant Feedback**
   - Har savol uchun:
     - ✓ yoki ✗ belgisi
     - Sizning javobingiz
     - To'g'ri javob (agar noto'g'ri bo'lsa)
   - Band score ko'rsatilishi
   - To'g'ri/Noto'g'ri count

6. **Retry**
   - "Qayta Urinish" tugmasini bosing
   - Yangi attempt yaratilishi kerak
   - Eski javoblar ko'rinmasligi kerak

7. **Practice History**
   - `/practice/history/` ga kiring
   - Barcha practice attempts ro'yxati
   - Statistika: jami, o'rtacha ballar

---

## ✅ ACCEPTANCE CRITERIA

1. ✅ Admin test'ni practice uchun belgilaydi
2. ✅ Talaba practice testlar ro'yxatini ko'radi
3. ✅ Talaba o'zi boshlaydi (admin START yo'q)
4. ✅ Vaqt limit optional (bo'lsa timer, bo'lmasa yo'q)
5. ✅ Javob topshirgandan keyin darhol natija
6. ✅ Har savol uchun instant feedback (to'g'ri/noto'g'ri)
7. ✅ Band score avtomatik hisoblanadi
8. ✅ Qayta urinish cheksiz
9. ✅ Practice history saqlanadi
10. ✅ Writing faqat yoziladi (baholanmaydi)

---

## 🎯 YAKUNIY ARXITEKTURA

```
┌──────────────────────────────────────────────────────┐
│              ADMIN: PRACTICE ENABLE                  │
│  ┌────────────────────────────────────────────────┐  │
│  │ Test → is_practice_enabled = True              │  │
│  │ Optional: practice_time_limit                  │  │
│  └────────────────────────────────────────────────┘  │
│                        ↓                             │
├──────────────────────────────────────────────────────┤
│            STUDENT: PRACTICE LIST                    │
│  ┌────────────────────────────────────────────────┐  │
│  │ Listening Tests (enabled)                      │  │
│  │ Reading Tests (enabled)                        │  │
│  │ Writing Tests (enabled)                        │  │
│  │ [Boshlash] tugmalari                           │  │
│  └────────────────────────────────────────────────┘  │
│                        ↓                             │
├──────────────────────────────────────────────────────┤
│          PRACTICE TEST INTERFACE                     │
│  ┌────────────────────────────────────────────────┐  │
│  │ Audio/Passage/Task                             │  │
│  │ Questions                                      │  │
│  │ [Optional Timer]                               │  │
│  │ Submit → INSTANT FEEDBACK                      │  │
│  └────────────────────────────────────────────────┘  │
│                        ↓                             │
├──────────────────────────────────────────────────────┤
│            INSTANT RESULT PAGE                       │
│  ┌────────────────────────────────────────────────┐  │
│  │ Band Score (katta)                             │  │
│  │ Correct/Incorrect count                        │  │
│  │ Question-by-question feedback:                 │  │
│  │   ✓ To'g'ri (green)                            │  │
│  │   ✗ Noto'g'ri + to'g'ri javob (red)            │  │
│  │ [Qayta Urinish] [Orqaga] tugmalari             │  │
│  └────────────────────────────────────────────────┘  │
│                        ↓                             │
├──────────────────────────────────────────────────────┤
│             PRACTICE HISTORY                         │
│  ┌────────────────────────────────────────────────┐  │
│  │ All attempts list                              │  │
│  │ Statistics (avg scores, count)                 │  │
│  │ Filter by section                              │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

---

## 📦 MIGRATION VA DEPLOYMENT

### 1. Migration
```bash
python manage.py makemigrations tests mock
python manage.py migrate
```

### 2. Enable Practice Tests
```python
python manage.py shell

>>> from tests.models import ListeningTest
>>> test = ListeningTest.objects.first()
>>> test.is_practice_enabled = True
>>> test.practice_time_limit = 30
>>> test.save()
```

### 3. Create Practice Attempts
```bash
# Test student bilan /practice/ ga kiring
# Test boshlang va topshiring
# Natijani tekshiring
```

---

## 🚨 MUHIM ESLATMALAR

### 1. Practice vs Mock Farqi
- **Practice:** Instant feedback, cheksiz urinish, sertifikat yo'q
- **Mock:** Real exam simulation, ustoz baholaydi, sertifikat bor

### 2. Question Explanation
- `ListeningQuestion` va `ReadingQuestion` modellariga `explanation` maydon qo'shish mumkin (optional)
- Instant feedback'da ko'rsatiladi

### 3. Writing Practice
- Writing practice faqat yozish uchun
- Baholash yo'q (ustoz baholamaydi)
- Talaba o'z matnini ko'radi va word count'ni biladi
- Keyin o'zi taqqoslashi mumkin

### 4. Performance
- Juda ko'p practice attempts bo'lsa, pagination qo'shish
- History sahifasida filter: oxirgi 30 kun, section bo'yicha

---

## 🎯 OXIRGI ESLATMA

ETAP 6 tugagandan keyin:

✅ **TO'LIQ SELF-STUDY FUNKSIONAL**
- Talaba mustaqil mashq qiladi
- Instant feedback (darhol o'rganadi)
- Cheksiz urinish
- Progress tracking

✅ **COMPLETE IELTS MOCK PLATFORM**
- Mock Mode: real exam simulation
- Practice Mode: self-study
- Student Dashboard: progress + history
- Teacher Panel: grading
- Admin Panel: test management

✅ **PROFESSIONAL PRODUCT**
- Markazlarga sotsa bo'ladigan
- To'liq funksional
- User-friendly
- Production-ready

---

**ETAP 7 (oxirgi):** Co-branding + Analytics + Excel Export

Omad! 🚀
