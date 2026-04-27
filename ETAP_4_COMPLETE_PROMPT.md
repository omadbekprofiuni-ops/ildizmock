# ETAP 4: WRITING/SPEAKING BAHOLASH TIZIMI

**Maqsad:** Ustoz (teacher) talabalarning Writing Task 1/2 matnlarini o'qiydi va 4 ta criteria bo'yicha baholaydi. Speaking testini yuzma-yuz o'tkazgandan keyin balini kiritadi. Overall band score avtomatik hisoblanadi.

---

## 📋 IELTS WRITING BAHOLASH TIZIMI

### Writing Band Descriptors (4 ta criteria):

1. **Task Achievement (Task 1)** / **Task Response (Task 2)**
   - 0-9 ball
   - Talaba topshiriqni qanchalik to'liq bajargan

2. **Coherence and Cohesion**
   - 0-9 ball
   - Matnning tuzilishi, bog'lovchilar, mantiqiy oqim

3. **Lexical Resource**
   - 0-9 ball
   - So'z boyligi, sinonimlar, kollokatsiyalar

4. **Grammatical Range and Accuracy**
   - 0-9 ball
   - Grammatik tuzilmalar xilma-xilligi va to'g'riligi

**Writing Band Score** = (4 ta criteria ning o'rtachasi)

---

## 📋 IELTS SPEAKING BAHOLASH TIZIMI

### Speaking Band Descriptors (4 ta criteria):

1. **Fluency and Coherence**
2. **Lexical Resource**
3. **Grammatical Range and Accuracy**
4. **Pronunciation**

**Lekin:** Platformada Speaking yuzma-yuz o'tkaziladi, shuning uchun faqat **yakuniy Speaking band score** kiritiladi.

---

## 🔧 QILINISHI KERAK ISHLAR

---

## 1️⃣ MODEL YANGILANISHI

### A) MockParticipant modelga yangi maydonlar qo'shish

**Fayl:** `mock/models.py`

```python
class MockParticipant(TimeStampedModel):
    """Sessiyaga qo'shilgan talaba"""
    session = models.ForeignKey(MockSession, on_delete=models.CASCADE, related_name='participants')
    full_name = models.CharField(max_length=200)
    browser_session_id = models.CharField(max_length=100, unique=True)
    joined_at = models.DateTimeField(auto_now_add=True)
    
    # Javoblar (ETAP 3 dan)
    listening_answers = models.JSONField(default=dict)
    reading_answers = models.JSONField(default=dict)
    writing_task1_text = models.TextField(blank=True)
    writing_task2_text = models.TextField(blank=True)
    
    # Auto-graded scores (ETAP 3 dan)
    listening_score = models.FloatField(null=True, blank=True)
    reading_score = models.FloatField(null=True, blank=True)
    
    # ===== YANGI: WRITING CRITERIA SCORES =====
    # Task 1
    writing_task1_task_achievement = models.FloatField(
        null=True, blank=True,
        help_text='Task Achievement (0-9)'
    )
    writing_task1_coherence = models.FloatField(
        null=True, blank=True,
        help_text='Coherence and Cohesion (0-9)'
    )
    writing_task1_lexical = models.FloatField(
        null=True, blank=True,
        help_text='Lexical Resource (0-9)'
    )
    writing_task1_grammar = models.FloatField(
        null=True, blank=True,
        help_text='Grammatical Range and Accuracy (0-9)'
    )
    
    # Task 2
    writing_task2_task_response = models.FloatField(
        null=True, blank=True,
        help_text='Task Response (0-9)'
    )
    writing_task2_coherence = models.FloatField(
        null=True, blank=True,
        help_text='Coherence and Cohesion (0-9)'
    )
    writing_task2_lexical = models.FloatField(
        null=True, blank=True,
        help_text='Lexical Resource (0-9)'
    )
    writing_task2_grammar = models.FloatField(
        null=True, blank=True,
        help_text='Grammatical Range and Accuracy (0-9)'
    )
    
    # Writing Overall (calculated)
    writing_score = models.FloatField(null=True, blank=True, help_text='Writing Band Score (average)')
    
    # Writing Feedback
    writing_feedback = models.TextField(blank=True, help_text='Ustoz izoh (optional)')
    
    # Writing baholash statusi
    WRITING_STATUS_CHOICES = [
        ('pending', 'Kutilmoqda'),
        ('grading', 'Baholanyapti'),
        ('graded', 'Baholangan'),
    ]
    writing_status = models.CharField(max_length=20, choices=WRITING_STATUS_CHOICES, default='pending')
    writing_graded_by = models.ForeignKey(
        'auth.User',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='writing_gradings'
    )
    writing_graded_at = models.DateTimeField(null=True, blank=True)
    
    # ===== YANGI: SPEAKING SCORE =====
    speaking_score = models.FloatField(null=True, blank=True, help_text='Speaking Band Score (0-9)')
    speaking_feedback = models.TextField(blank=True, help_text='Ustoz izoh (optional)')
    
    SPEAKING_STATUS_CHOICES = [
        ('pending', 'Kutilmoqda'),
        ('graded', 'Baholangan'),
    ]
    speaking_status = models.CharField(max_length=20, choices=SPEAKING_STATUS_CHOICES, default='pending')
    speaking_graded_by = models.ForeignKey(
        'auth.User',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='speaking_gradings'
    )
    speaking_graded_at = models.DateTimeField(null=True, blank=True)
    
    # ===== OVERALL BAND SCORE =====
    overall_band_score = models.FloatField(null=True, blank=True, help_text='(L+R+W+S)/4')
    
    class Meta:
        db_table = 'mock_participants'
        unique_together = [['session', 'full_name']]
    
    def calculate_writing_score(self):
        """Writing band score hisoblash"""
        task1_scores = [
            self.writing_task1_task_achievement,
            self.writing_task1_coherence,
            self.writing_task1_lexical,
            self.writing_task1_grammar,
        ]
        
        task2_scores = [
            self.writing_task2_task_response,
            self.writing_task2_coherence,
            self.writing_task2_lexical,
            self.writing_task2_grammar,
        ]
        
        # Task 1 average
        task1_valid = [s for s in task1_scores if s is not None]
        task1_avg = sum(task1_valid) / len(task1_valid) if task1_valid else None
        
        # Task 2 average
        task2_valid = [s for s in task2_scores if s is not None]
        task2_avg = sum(task2_valid) / len(task2_valid) if task2_valid else None
        
        # Writing score: Task 1 (33%) + Task 2 (67%)
        if task1_avg is not None and task2_avg is not None:
            self.writing_score = round((task1_avg * 0.33 + task2_avg * 0.67), 1)
        else:
            self.writing_score = None
        
        return self.writing_score
    
    def calculate_overall_band_score(self):
        """Overall band score hisoblash: (L+R+W+S)/4"""
        scores = [
            self.listening_score,
            self.reading_score,
            self.writing_score,
            self.speaking_score,
        ]
        
        valid_scores = [s for s in scores if s is not None]
        
        if len(valid_scores) == 4:
            average = sum(valid_scores) / 4
            # IELTS rounding rule: 0.25 yoki undan yuqori bo'lsa yuqoriga
            self.overall_band_score = round(average * 2) / 2  # 0.5 step
        else:
            self.overall_band_score = None
        
        return self.overall_band_score
    
    def __str__(self):
        return f"{self.full_name} - {self.session.name}"
```

---

### B) Migration

```bash
python manage.py makemigrations mock
python manage.py migrate mock
```

---

## 2️⃣ WRITING BAHOLASH PANELI

### A) View - Baholash uchun kutayotgan talabalar ro'yxati

**Fayl:** `mock/views.py`

```python
from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.utils import timezone
from .models import MockParticipant

@login_required
def writing_grading_queue(request):
    """Ustoz uchun - baholash kutayotgan Writing'lar"""
    
    # Faqat o'z kutubxonasining talabalarini ko'rsatish
    participants = MockParticipant.objects.filter(
        session__library=request.user.library,
        writing_status='pending',
        writing_task1_text__isnull=False,  # Kamida Task 1 topshirgan
    ).select_related('session').order_by('session__date', 'full_name')
    
    return render(request, 'mock/writing_grading_queue.html', {
        'participants': participants,
    })


@login_required
def writing_grade_detail(request, participant_id):
    """Bitta talabaning Writing'ini baholash"""
    
    participant = get_object_or_404(
        MockParticipant,
        id=participant_id,
        session__library=request.user.library
    )
    
    if request.method == 'POST':
        # Task 1 scores
        participant.writing_task1_task_achievement = float(request.POST.get('task1_task_achievement', 0))
        participant.writing_task1_coherence = float(request.POST.get('task1_coherence', 0))
        participant.writing_task1_lexical = float(request.POST.get('task1_lexical', 0))
        participant.writing_task1_grammar = float(request.POST.get('task1_grammar', 0))
        
        # Task 2 scores
        participant.writing_task2_task_response = float(request.POST.get('task2_task_response', 0))
        participant.writing_task2_coherence = float(request.POST.get('task2_coherence', 0))
        participant.writing_task2_lexical = float(request.POST.get('task2_lexical', 0))
        participant.writing_task2_grammar = float(request.POST.get('task2_grammar', 0))
        
        # Feedback
        participant.writing_feedback = request.POST.get('feedback', '')
        
        # Calculate writing score
        participant.calculate_writing_score()
        
        # Update status
        participant.writing_status = 'graded'
        participant.writing_graded_by = request.user
        participant.writing_graded_at = timezone.now()
        
        # Calculate overall if all sections graded
        participant.calculate_overall_band_score()
        
        participant.save()
        
        messages.success(request, f'{participant.full_name} ning Writing'i baholandi!')
        
        # Redirect to next participant or queue
        next_participant = MockParticipant.objects.filter(
            session__library=request.user.library,
            writing_status='pending',
            id__gt=participant.id
        ).first()
        
        if next_participant:
            return redirect('writing_grade_detail', participant_id=next_participant.id)
        else:
            return redirect('writing_grading_queue')
    
    # GET - form ko'rsatish
    return render(request, 'mock/writing_grade_detail.html', {
        'participant': participant,
        'session': participant.session,
    })
```

---

### B) Template - Baholash kutayotgan ro'yxat

**Fayl:** `mock/templates/mock/writing_grading_queue.html`

```html
{% extends 'base.html' %}

{% block content %}
<div class="max-w-6xl mx-auto py-8">
    <h1 class="text-3xl font-bold mb-6">Writing Baholash Navbati</h1>
    
    {% if participants %}
    <div class="bg-white rounded-lg shadow overflow-hidden">
        <table class="w-full">
            <thead class="bg-gray-50">
                <tr>
                    <th class="px-6 py-3 text-left">Talaba</th>
                    <th class="px-6 py-3 text-left">Sessiya</th>
                    <th class="px-6 py-3 text-center">Sana</th>
                    <th class="px-6 py-3 text-center">L</th>
                    <th class="px-6 py-3 text-center">R</th>
                    <th class="px-6 py-3 text-center">S</th>
                    <th class="px-6 py-3"></th>
                </tr>
            </thead>
            <tbody>
                {% for p in participants %}
                <tr class="border-t hover:bg-gray-50">
                    <td class="px-6 py-4 font-semibold">{{ p.full_name }}</td>
                    <td class="px-6 py-4 text-sm text-gray-600">{{ p.session.name }}</td>
                    <td class="px-6 py-4 text-center text-sm">{{ p.session.date|date:"d M" }}</td>
                    <td class="px-6 py-4 text-center">
                        <span class="text-sm">{{ p.listening_score|default:'-' }}</span>
                    </td>
                    <td class="px-6 py-4 text-center">
                        <span class="text-sm">{{ p.reading_score|default:'-' }}</span>
                    </td>
                    <td class="px-6 py-4 text-center">
                        <span class="text-sm">{{ p.speaking_score|default:'-' }}</span>
                    </td>
                    <td class="px-6 py-4 text-right">
                        <a href="{% url 'writing_grade_detail' p.id %}" 
                           class="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                            Baholash
                        </a>
                    </td>
                </tr>
                {% endfor %}
            </tbody>
        </table>
    </div>
    {% else %}
    <div class="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
        <p class="text-gray-600 text-lg">✓ Baholash uchun Writing yo'q</p>
        <p class="text-gray-500 text-sm mt-2">Barcha Writing'lar baholangan yoki hali topshirilmagan</p>
    </div>
    {% endif %}
</div>
{% endblock %}
```

---

### C) Template - Writing baholash sahifasi

**Fayl:** `mock/templates/mock/writing_grade_detail.html`

```html
{% extends 'base.html' %}

{% block content %}
<div class="max-w-6xl mx-auto py-8">
    <!-- Header -->
    <div class="bg-white rounded-lg shadow p-6 mb-6">
        <h1 class="text-2xl font-bold mb-2">{{ participant.full_name }}</h1>
        <p class="text-gray-600">{{ session.name }} | {{ session.date }}</p>
        
        <div class="mt-4 flex gap-6">
            <div>
                <span class="text-sm text-gray-500">Listening:</span>
                <span class="font-semibold ml-2">{{ participant.listening_score|default:'-' }}</span>
            </div>
            <div>
                <span class="text-sm text-gray-500">Reading:</span>
                <span class="font-semibold ml-2">{{ participant.reading_score|default:'-' }}</span>
            </div>
            <div>
                <span class="text-sm text-gray-500">Speaking:</span>
                <span class="font-semibold ml-2">{{ participant.speaking_score|default:'-' }}</span>
            </div>
        </div>
    </div>
    
    <form method="post" class="space-y-6">
        {% csrf_token %}
        
        <!-- Task 1 -->
        <div class="bg-white rounded-lg shadow p-6">
            <h2 class="text-xl font-bold mb-4">Writing Task 1</h2>
            
            <!-- Task 1 Description -->
            <div class="bg-gray-50 border border-gray-200 rounded p-4 mb-4">
                <p class="text-sm font-semibold text-gray-700 mb-2">Topshiriq:</p>
                <p class="text-sm">{{ session.writing_test.task1_description }}</p>
                
                {% if session.writing_test.task1_image %}
                <div class="mt-3">
                    <img src="{{ session.writing_test.task1_image.url }}" 
                         alt="Task 1" 
                         class="max-w-md rounded border">
                </div>
                {% endif %}
            </div>
            
            <!-- Student's Answer -->
            <div class="bg-blue-50 border border-blue-200 rounded p-4 mb-6">
                <p class="text-sm font-semibold text-blue-900 mb-2">Talaba javobi:</p>
                <div class="bg-white rounded p-4 text-sm whitespace-pre-wrap">{{ participant.writing_task1_text|default:"Topshirilmagan" }}</div>
                <p class="text-xs text-gray-600 mt-2">So'zlar soni: {{ participant.writing_task1_text|wordcount|default:0 }}</p>
            </div>
            
            <!-- Grading Criteria -->
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium mb-2">Task Achievement (0-9)</label>
                    <input type="number" name="task1_task_achievement" 
                           min="0" max="9" step="0.5" required
                           value="{{ participant.writing_task1_task_achievement|default:'' }}"
                           class="w-full border px-3 py-2 rounded">
                </div>
                
                <div>
                    <label class="block text-sm font-medium mb-2">Coherence & Cohesion (0-9)</label>
                    <input type="number" name="task1_coherence" 
                           min="0" max="9" step="0.5" required
                           value="{{ participant.writing_task1_coherence|default:'' }}"
                           class="w-full border px-3 py-2 rounded">
                </div>
                
                <div>
                    <label class="block text-sm font-medium mb-2">Lexical Resource (0-9)</label>
                    <input type="number" name="task1_lexical" 
                           min="0" max="9" step="0.5" required
                           value="{{ participant.writing_task1_lexical|default:'' }}"
                           class="w-full border px-3 py-2 rounded">
                </div>
                
                <div>
                    <label class="block text-sm font-medium mb-2">Grammar (0-9)</label>
                    <input type="number" name="task1_grammar" 
                           min="0" max="9" step="0.5" required
                           value="{{ participant.writing_task1_grammar|default:'' }}"
                           class="w-full border px-3 py-2 rounded">
                </div>
            </div>
        </div>
        
        <!-- Task 2 -->
        <div class="bg-white rounded-lg shadow p-6">
            <h2 class="text-xl font-bold mb-4">Writing Task 2</h2>
            
            <!-- Task 2 Description -->
            <div class="bg-gray-50 border border-gray-200 rounded p-4 mb-4">
                <p class="text-sm font-semibold text-gray-700 mb-2">Topshiriq:</p>
                <p class="text-sm">{{ session.writing_test.task2_description }}</p>
            </div>
            
            <!-- Student's Answer -->
            <div class="bg-blue-50 border border-blue-200 rounded p-4 mb-6">
                <p class="text-sm font-semibold text-blue-900 mb-2">Talaba javobi:</p>
                <div class="bg-white rounded p-4 text-sm whitespace-pre-wrap">{{ participant.writing_task2_text|default:"Topshirilmagan" }}</div>
                <p class="text-xs text-gray-600 mt-2">So'zlar soni: {{ participant.writing_task2_text|wordcount|default:0 }}</p>
            </div>
            
            <!-- Grading Criteria -->
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium mb-2">Task Response (0-9)</label>
                    <input type="number" name="task2_task_response" 
                           min="0" max="9" step="0.5" required
                           value="{{ participant.writing_task2_task_response|default:'' }}"
                           class="w-full border px-3 py-2 rounded">
                </div>
                
                <div>
                    <label class="block text-sm font-medium mb-2">Coherence & Cohesion (0-9)</label>
                    <input type="number" name="task2_coherence" 
                           min="0" max="9" step="0.5" required
                           value="{{ participant.writing_task2_coherence|default:'' }}"
                           class="w-full border px-3 py-2 rounded">
                </div>
                
                <div>
                    <label class="block text-sm font-medium mb-2">Lexical Resource (0-9)</label>
                    <input type="number" name="task2_lexical" 
                           min="0" max="9" step="0.5" required
                           value="{{ participant.writing_task2_lexical|default:'' }}"
                           class="w-full border px-3 py-2 rounded">
                </div>
                
                <div>
                    <label class="block text-sm font-medium mb-2">Grammar (0-9)</label>
                    <input type="number" name="task2_grammar" 
                           min="0" max="9" step="0.5" required
                           value="{{ participant.writing_task2_grammar|default:'' }}"
                           class="w-full border px-3 py-2 rounded">
                </div>
            </div>
        </div>
        
        <!-- Feedback (optional) -->
        <div class="bg-white rounded-lg shadow p-6">
            <label class="block text-sm font-medium mb-2">Feedback (optional)</label>
            <textarea name="feedback" rows="4" 
                      class="w-full border px-3 py-2 rounded"
                      placeholder="Talaba uchun izoh yoki tavsiya...">{{ participant.writing_feedback }}</textarea>
        </div>
        
        <!-- Submit -->
        <div class="flex justify-between items-center">
            <a href="{% url 'writing_grading_queue' %}" 
               class="text-gray-600 hover:text-gray-900">
                ← Orqaga
            </a>
            
            <button type="submit" 
                    class="bg-green-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-green-700">
                Baholashni saqlash
            </button>
        </div>
    </form>
</div>

<script>
// Auto-focus first empty score input
document.addEventListener('DOMContentLoaded', () => {
    const inputs = document.querySelectorAll('input[type="number"]');
    for (let input of inputs) {
        if (!input.value) {
            input.focus();
            break;
        }
    }
});
</script>
{% endblock %}
```

---

## 3️⃣ SPEAKING BAHOLASH PANELI

### A) View

**Fayl:** `mock/views.py`

```python
@login_required
def speaking_grading_queue(request):
    """Ustoz uchun - Speaking baholash navbati"""
    
    participants = MockParticipant.objects.filter(
        session__library=request.user.library,
        speaking_status='pending',
    ).select_related('session').order_by('session__date', 'full_name')
    
    return render(request, 'mock/speaking_grading_queue.html', {
        'participants': participants,
    })


@login_required
def speaking_grade_detail(request, participant_id):
    """Speaking ball kiritish"""
    
    participant = get_object_or_404(
        MockParticipant,
        id=participant_id,
        session__library=request.user.library
    )
    
    if request.method == 'POST':
        participant.speaking_score = float(request.POST.get('speaking_score'))
        participant.speaking_feedback = request.POST.get('feedback', '')
        participant.speaking_status = 'graded'
        participant.speaking_graded_by = request.user
        participant.speaking_graded_at = timezone.now()
        
        # Calculate overall
        participant.calculate_overall_band_score()
        
        participant.save()
        
        messages.success(request, f'{participant.full_name} ning Speaking'i baholandi!')
        
        # Next participant
        next_participant = MockParticipant.objects.filter(
            session__library=request.user.library,
            speaking_status='pending',
            id__gt=participant.id
        ).first()
        
        if next_participant:
            return redirect('speaking_grade_detail', participant_id=next_participant.id)
        else:
            return redirect('speaking_grading_queue')
    
    return render(request, 'mock/speaking_grade_detail.html', {
        'participant': participant,
        'session': participant.session,
    })
```

---

### B) Template

**Fayl:** `mock/templates/mock/speaking_grade_detail.html`

```html
{% extends 'base.html' %}

{% block content %}
<div class="max-w-3xl mx-auto py-8">
    <div class="bg-white rounded-lg shadow p-6 mb-6">
        <h1 class="text-2xl font-bold mb-2">{{ participant.full_name }}</h1>
        <p class="text-gray-600">{{ session.name }} | {{ session.date }}</p>
        
        <div class="mt-4 grid grid-cols-3 gap-4">
            <div class="text-center p-3 bg-gray-50 rounded">
                <p class="text-xs text-gray-500">Listening</p>
                <p class="text-2xl font-bold">{{ participant.listening_score|default:'-' }}</p>
            </div>
            <div class="text-center p-3 bg-gray-50 rounded">
                <p class="text-xs text-gray-500">Reading</p>
                <p class="text-2xl font-bold">{{ participant.reading_score|default:'-' }}</p>
            </div>
            <div class="text-center p-3 bg-gray-50 rounded">
                <p class="text-xs text-gray-500">Writing</p>
                <p class="text-2xl font-bold">{{ participant.writing_score|default:'-' }}</p>
            </div>
        </div>
    </div>
    
    <form method="post" class="bg-white rounded-lg shadow p-6 space-y-6">
        {% csrf_token %}
        
        <div>
            <label class="block text-sm font-medium mb-2">Speaking Band Score (0-9)</label>
            <input type="number" name="speaking_score" 
                   min="0" max="9" step="0.5" required
                   value="{{ participant.speaking_score|default:'' }}"
                   class="w-full border-2 px-4 py-3 rounded-lg text-2xl font-bold text-center focus:border-blue-500"
                   autofocus>
            
            <p class="text-xs text-gray-500 mt-2 text-center">
                4 ta criteria o'rtachasi: Fluency, Lexical, Grammar, Pronunciation
            </p>
        </div>
        
        <div>
            <label class="block text-sm font-medium mb-2">Feedback (optional)</label>
            <textarea name="feedback" rows="4" 
                      class="w-full border px-3 py-2 rounded"
                      placeholder="Talaba uchun izoh...">{{ participant.speaking_feedback }}</textarea>
        </div>
        
        <div class="flex justify-between items-center pt-4">
            <a href="{% url 'speaking_grading_queue' %}" 
               class="text-gray-600 hover:text-gray-900">
                ← Orqaga
            </a>
            
            <button type="submit" 
                    class="bg-green-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-green-700">
                Baholashni saqlash
            </button>
        </div>
    </form>
</div>
{% endblock %}
```

---

## 4️⃣ USTOZ DASHBOARD

### A) View

```python
@login_required
def teacher_dashboard(request):
    """Ustoz asosiy sahifasi"""
    
    # Statistics
    writing_pending = MockParticipant.objects.filter(
        session__library=request.user.library,
        writing_status='pending',
        writing_task1_text__isnull=False,
    ).count()
    
    speaking_pending = MockParticipant.objects.filter(
        session__library=request.user.library,
        speaking_status='pending',
    ).count()
    
    # Recent gradings (last 7 days)
    from datetime import timedelta
    from django.utils import timezone
    
    recent_writings = MockParticipant.objects.filter(
        session__library=request.user.library,
        writing_graded_by=request.user,
        writing_graded_at__gte=timezone.now() - timedelta(days=7)
    ).count()
    
    recent_speakings = MockParticipant.objects.filter(
        session__library=request.user.library,
        speaking_graded_by=request.user,
        speaking_graded_at__gte=timezone.now() - timedelta(days=7)
    ).count()
    
    return render(request, 'mock/teacher_dashboard.html', {
        'writing_pending': writing_pending,
        'speaking_pending': speaking_pending,
        'recent_writings': recent_writings,
        'recent_speakings': recent_speakings,
    })
```

---

### B) Template

```html
{% extends 'base.html' %}

{% block content %}
<div class="max-w-6xl mx-auto py-8">
    <h1 class="text-3xl font-bold mb-8">Ustoz Paneli</h1>
    
    <!-- Quick Stats -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div class="bg-white rounded-lg shadow p-6">
            <p class="text-sm text-gray-500 mb-1">Writing kutilmoqda</p>
            <p class="text-4xl font-bold text-orange-600">{{ writing_pending }}</p>
        </div>
        
        <div class="bg-white rounded-lg shadow p-6">
            <p class="text-sm text-gray-500 mb-1">Speaking kutilmoqda</p>
            <p class="text-4xl font-bold text-blue-600">{{ speaking_pending }}</p>
        </div>
        
        <div class="bg-white rounded-lg shadow p-6">
            <p class="text-sm text-gray-500 mb-1">Writing (7 kun)</p>
            <p class="text-4xl font-bold text-green-600">{{ recent_writings }}</p>
        </div>
        
        <div class="bg-white rounded-lg shadow p-6">
            <p class="text-sm text-gray-500 mb-1">Speaking (7 kun)</p>
            <p class="text-4xl font-bold text-green-600">{{ recent_speakings }}</p>
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
{% endblock %}
```

---

## 5️⃣ NATIJALAR SAHIFASINI YANGILASH

**Fayl:** `mock/views.py` - `mock_results_view` ni yangilash

```python
@login_required
def mock_results_view(request, session_id):
    """Admin/Ustoz natijalarni ko'rish"""
    session = get_object_or_404(MockSession, id=session_id, library=request.user.library)
    participants = session.participants.all().order_by('-overall_band_score', 'full_name')
    
    return render(request, 'mock/results.html', {
        'session': session,
        'participants': participants,
    })
```

**Template yangilanishi:**

```html
<!-- ETAP 3 template'ini yangilash -->
<tbody>
    {% for p in participants %}
    <tr class="border-t">
        <td class="px-6 py-4 font-semibold">{{ p.full_name }}</td>
        <td class="px-6 py-4 text-center">
            <span class="{% if p.listening_score >= 7 %}text-green-600{% elif p.listening_score >= 5 %}text-yellow-600{% else %}text-red-600{% endif %}">
                {{ p.listening_score|floatformat:1|default:'-' }}
            </span>
        </td>
        <td class="px-6 py-4 text-center">
            <span class="{% if p.reading_score >= 7 %}text-green-600{% elif p.reading_score >= 5 %}text-yellow-600{% else %}text-red-600{% endif %}">
                {{ p.reading_score|floatformat:1|default:'-' }}
            </span>
        </td>
        <td class="px-6 py-4 text-center">
            {% if p.writing_score %}
                <span class="{% if p.writing_score >= 7 %}text-green-600{% elif p.writing_score >= 5 %}text-yellow-600{% else %}text-red-600{% endif %}">
                    {{ p.writing_score|floatformat:1 }}
                </span>
            {% elif p.writing_status == 'pending' %}
                <span class="text-xs text-gray-500">Kutilmoqda</span>
            {% else %}
                -
            {% endif %}
        </td>
        <td class="px-6 py-4 text-center">
            {% if p.speaking_score %}
                <span class="{% if p.speaking_score >= 7 %}text-green-600{% elif p.speaking_score >= 5 %}text-yellow-600{% else %}text-red-600{% endif %}">
                    {{ p.speaking_score|floatformat:1 }}
                </span>
            {% elif p.speaking_status == 'pending' %}
                <span class="text-xs text-gray-500">Kutilmoqda</span>
            {% else %}
                -
            {% endif %}
        </td>
        <td class="px-6 py-4 text-center">
            {% if p.overall_band_score %}
                <span class="text-xl font-bold {% if p.overall_band_score >= 7 %}text-green-600{% elif p.overall_band_score >= 5 %}text-yellow-600{% else %}text-red-600{% endif %}">
                    {{ p.overall_band_score|floatformat:1 }}
                </span>
            {% else %}
                -
            {% endif %}
        </td>
        <td class="px-6 py-4">
            <a href="{% url 'mock_participant_detail' p.id %}" 
               class="text-blue-600 hover:underline">
                Batafsil
            </a>
        </td>
    </tr>
    {% endfor %}
</tbody>
```

---

## 6️⃣ URL ROUTING

**Fayl:** `urls.py`

```python
from mock import views as mock_views

urlpatterns = [
    # ... mavjud patterns
    
    # Teacher Dashboard
    path('teacher/dashboard/', mock_views.teacher_dashboard, name='teacher_dashboard'),
    
    # Writing Grading
    path('grading/writing/', mock_views.writing_grading_queue, name='writing_grading_queue'),
    path('grading/writing/<int:participant_id>/', mock_views.writing_grade_detail, name='writing_grade_detail'),
    
    # Speaking Grading
    path('grading/speaking/', mock_views.speaking_grading_queue, name='speaking_grading_queue'),
    path('grading/speaking/<int:participant_id>/', mock_views.speaking_grade_detail, name='speaking_grade_detail'),
]
```

---

## 7️⃣ NAVIGATION MENU

Sidebar'ga ustoz uchun link qo'shish:

```html
<!-- base.html yoki sidebar template -->
{% if request.user.role == 'teacher' or request.user.is_staff %}
<nav class="space-y-2">
    <a href="{% url 'teacher_dashboard' %}" 
       class="block px-4 py-2 rounded hover:bg-gray-100">
        👨‍🏫 Ustoz Paneli
    </a>
    
    <a href="{% url 'writing_grading_queue' %}" 
       class="block px-4 py-2 rounded hover:bg-gray-100">
        📝 Writing Baholash
        {% if writing_pending_count %}
        <span class="bg-orange-500 text-white text-xs px-2 py-1 rounded-full ml-2">
            {{ writing_pending_count }}
        </span>
        {% endif %}
    </a>
    
    <a href="{% url 'speaking_grading_queue' %}" 
       class="block px-4 py-2 rounded hover:bg-gray-100">
        🎤 Speaking Baholash
        {% if speaking_pending_count %}
        <span class="bg-blue-500 text-white text-xs px-2 py-1 rounded-full ml-2">
            {{ speaking_pending_count }}
        </span>
        {% endif %}
    </a>
</nav>
{% endif %}
```

---

## 🧪 SINOV (TESTING)

### Test Ssenariysi:

1. **Mock test yaratish va tugatish**
   - ETAP 3 ni ishlatib mock test o'tkazing
   - Talabalar Writing Task 1 va Task 2 ni topshirsinlar
   - Test tugasin (status='finished')

2. **Ustoz login qilish**
   - Ustoz sifatida login
   - `/teacher/dashboard/` ga kiring
   - Writing pending count ko'rsatilishi kerak

3. **Writing baholash**
   - "Writing Baholash" tugmasini bosing
   - Birinchi talabani tanlang
   - Task 1 uchun 4 ta criteria ball bering (masalan: 6.5, 6.0, 6.0, 6.5)
   - Task 2 uchun 4 ta criteria ball bering (masalan: 7.0, 6.5, 7.0, 6.5)
   - Feedback yozing (optional)
   - "Saqlash" bosing
   - Avtomatik keyingi talabaga o'tishi kerak

4. **Writing score hisoblash**
   - Database'ga kiring yoki admin panelda tekshiring
   - `writing_score` avtomatik hisoblanganini tekshiring
   - Formula: (Task1_avg * 0.33) + (Task2_avg * 0.67)

5. **Speaking baholash**
   - `/grading/speaking/` ga kiring
   - Talaba tanlang
   - Speaking band score kiriting (masalan: 6.5)
   - Saqlang

6. **Overall band score**
   - Natijalar sahifasiga kiring
   - Overall band score ko'rsatilganini tekshiring
   - Formula: (L + R + W + S) / 4, 0.5 step rounding

7. **Status tekshirish**
   - Writing status `graded` ga o'zgarganini tekshiring
   - Speaking status `graded` ga o'zgarganini tekshiring
   - Graded_by va graded_at to'g'ri yozilganini tekshiring

---

## ✅ ACCEPTANCE CRITERIA

1. ✅ Ustoz Writing'lar ro'yxatini ko'radi (pending status bilan)
2. ✅ Har talabaning Writing matnini o'qiydi
3. ✅ 8 ta criteria bo'yicha baholaydi (Task 1: 4, Task 2: 4)
4. ✅ Writing band score avtomatik hisoblanadi
5. ✅ Speaking ball kiritadi (yuzma-yuz test qilgandan keyin)
6. ✅ Overall band score avtomatik hisoblanadi: (L+R+W+S)/4
7. ✅ Natijalar jadvalida barcha balllar ko'rsatiladi
8. ✅ Baholangan talabalar navbatdan chiqadi
9. ✅ Ustoz dashboard statistika ko'rsatadi

---

## 🎯 YAKUNIY ARXITEKTURA

```
┌─────────────────────────────────────────────────────────┐
│                    USTOZ PANELI                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Dashboard: Pending counts, Recent gradings      │   │
│  │                                                  │   │
│  │ Writing Queue → Grade Detail (8 criteria)       │   │
│  │ Speaking Queue → Grade Detail (1 score)         │   │
│  │                                                  │   │
│  │ Auto-calculate:                                 │   │
│  │  - Writing = (T1*0.33 + T2*0.67)               │   │
│  │  - Overall = (L+R+W+S)/4, round 0.5           │   │
│  └──────────────────────────────────────────────────┘   │
│                          ↓                              │
├─────────────────────────────────────────────────────────┤
│              NATIJALAR (ADMIN/USTOZ)                    │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Talaba | L | R | W | S | Overall | Batafsil     │   │
│  │ ────────────────────────────────────────────────│   │
│  │ Aziz   |7.0|6.5|6.5|6.5|  6.5    | →           │   │
│  │ Dilnoza|6.0|5.5|  - | -  |   -     | →           │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## 📦 MIGRATION VA DEPLOYMENT

### 1. Migration
```bash
python manage.py makemigrations mock
python manage.py migrate mock
```

### 2. Test ma'lumotlar
```python
# Django shell
python manage.py shell

>>> from mock.models import MockParticipant
>>> p = MockParticipant.objects.first()
>>> p.writing_task1_text = "Sample Task 1 text..."
>>> p.writing_task2_text = "Sample Task 2 text..."
>>> p.save()
```

### 3. Permissions (agar kerak bo'lsa)
```python
# User model'ga `role` maydon qo'shish
# yoki Django groups: 'Teacher', 'Admin'
```

---

## 🚨 MUHIM ESLATMALAR

### 1. Writing Score Hisoblash
- Task 1: 33% (150+ words)
- Task 2: 67% (250+ words)
- Har criteria 0.5 step (0, 0.5, 1.0, 1.5, ..., 9.0)

### 2. Overall Band Score Rounding
- IELTS official rule: 0.25 → down, 0.75 → up
- Python: `round(average * 2) / 2`
- Masalan: 6.625 → 6.5, 6.875 → 7.0

### 3. Word Count
- Django template filter: `{{ text|wordcount }}`
- Minimum: Task 1 = 150, Task 2 = 250
- Warning ko'rsatish (optional)

### 4. Grading Time Tracking
- `writing_graded_at` va `speaking_graded_at` vaqtni yozadi
- Ustoz statistika uchun foydali

---

## 🎯 OXIRGI ESLATMA

ETAP 4 tugagandan keyin:

✅ **To'liq mock test tizimi**
- Listening/Reading: avtomatik
- Writing: ustoz 8 criteria
- Speaking: ustoz 1 score
- Overall: avtomatik

✅ **Professional natijalar**
- IELTS band score tizimi
- To'g'ri hisoblash formulasi
- Status tracking

✅ **Ustoz uchun qulay**
- Queue system (navbat)
- Quick grading interface
- Dashboard statistika

---

**ETAP 5 (keyingi):** Talaba profili + Sertifikat + Progress tracking

Omad! 🚀
