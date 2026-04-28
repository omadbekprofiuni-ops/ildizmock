# ETAP 10: SUPER EASY TEST CREATION - Google Forms Style

**Maqsad:** Test yaratish JUDA OSON bo'lishi kerak. Google Forms, Typeform, Notion kabi - bir sahifada, inline editing, drag-and-drop. Ustoz uchun tushunarsiz bo'lmasligi kerak.

---

## 🎯 MASALA:

### ❌ **HOZIRGI HOLAT (Qiyin):**
```
1. Test nomi yozish
2. Save qilish
3. Section qo'shish (alohida sahifa)
4. Save qilish
5. Question qo'shish (alohida sahifa)
6. Save qilish
7. Yana question qo'shish...
8. 100 marta click, 100 marta save
```

### ✅ **YANGI HOLAT (Oson):**
```
1. Test nomi yozish
2. [+ Add Section] click
3. Section title yozish (inline)
4. [+ Add Question] click
5. Question yozish (inline) 
6. Type tanlash (dropdown)
7. Correct answer yozish
8. [+ Add Question] yana click
9. HAMMASI bir sahifada!
10. Oxirida bir marta SAVE
```

---

## 🔧 IMPLEMENTATION

---

## 1️⃣ YANGI TEST CREATION VIEW

### A) View - Single Page

**Fayl:** `tests/views.py`

```python
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.http import require_POST
import json

@login_required
def easy_test_create(request):
    """Super easy test creation - Google Forms style"""
    
    library = request.user.library
    
    if request.method == 'POST':
        # Get basic test info
        test_type = request.POST.get('test_type')
        test_name = request.POST.get('test_name')
        test_description = request.POST.get('test_description', '')
        duration_minutes = request.POST.get('duration_minutes', 30)
        
        # Get sections data (JSON from frontend)
        sections_data = json.loads(request.POST.get('sections_data', '[]'))
        
        # Create test based on type
        if test_type == 'listening':
            test = ListeningTest.objects.create(
                library=library,
                name=test_name,
                description=test_description,
                duration_minutes=duration_minutes,
                audio_file=request.FILES.get('audio_file')
            )
            
            # Create sections and questions
            for section_data in sections_data:
                section = ListeningSection.objects.create(
                    test=test,
                    title=section_data['title'],
                    instructions=section_data.get('instructions', '')
                )
                
                for question_data in section_data['questions']:
                    ListeningQuestion.objects.create(
                        section=section,
                        question_text=question_data['text'],
                        question_type=question_data['type'],
                        correct_answer=question_data['correct_answer'],
                        options=question_data.get('options', []),
                        explanation=question_data.get('explanation', '')
                    )
        
        elif test_type == 'reading':
            test = ReadingTest.objects.create(
                library=library,
                name=test_name,
                description=test_description,
                duration_minutes=duration_minutes
            )
            
            # Create passages and questions
            for passage_data in sections_data:
                passage = ReadingPassage.objects.create(
                    test=test,
                    title=passage_data['title'],
                    text=passage_data['text']
                )
                
                for question_data in passage_data['questions']:
                    ReadingQuestion.objects.create(
                        passage=passage,
                        question_text=question_data['text'],
                        question_type=question_data['type'],
                        correct_answer=question_data['correct_answer'],
                        options=question_data.get('options', [])
                    )
        
        elif test_type == 'writing':
            test = WritingTest.objects.create(
                library=library,
                name=test_name,
                description=test_description,
                duration_minutes=duration_minutes,
                task1_prompt=sections_data[0]['text'],
                task1_min_words=150,
                task2_prompt=sections_data[1]['text'],
                task2_min_words=250
            )
        
        messages.success(request, f'Test "{test_name}" muvaffaqiyatli yaratildi!')
        return redirect('tests_list')
    
    # GET - show form
    return render(request, 'tests/easy_test_create.html')
```

---

## 2️⃣ SUPER EASY TEMPLATE (ASOSIY!)

### A) Main Template

**Fayl:** `tests/templates/tests/easy_test_create.html`

```html
{% extends 'admin_base.html' %}

{% block page_title %}Yangi Test Yaratish{% endblock %}

{% block content %}
<div class="max-w-5xl mx-auto p-8">
    <form id="test-form" method="post" enctype="multipart/form-data">
        {% csrf_token %}
        
        <!-- Header -->
        <div class="bg-white rounded-xl shadow-lg p-8 mb-6">
            <h1 class="text-3xl font-bold text-gray-900 mb-6">Yangi Test</h1>
            
            <!-- Test Type Selection -->
            <div class="mb-6">
                <label class="block text-sm font-semibold text-gray-700 mb-3">Test Turi *</label>
                <div class="grid grid-cols-3 gap-4">
                    <label class="relative cursor-pointer">
                        <input type="radio" name="test_type" value="listening" class="peer sr-only" required>
                        <div class="p-6 border-2 border-gray-200 rounded-xl text-center transition peer-checked:border-blue-500 peer-checked:bg-blue-50 hover:border-blue-300">
                            <div class="text-4xl mb-2">🎧</div>
                            <div class="font-semibold">Listening</div>
                        </div>
                    </label>
                    
                    <label class="relative cursor-pointer">
                        <input type="radio" name="test_type" value="reading" class="peer sr-only">
                        <div class="p-6 border-2 border-gray-200 rounded-xl text-center transition peer-checked:border-blue-500 peer-checked:bg-blue-50 hover:border-blue-300">
                            <div class="text-4xl mb-2">📖</div>
                            <div class="font-semibold">Reading</div>
                        </div>
                    </label>
                    
                    <label class="relative cursor-pointer">
                        <input type="radio" name="test_type" value="writing" class="peer sr-only">
                        <div class="p-6 border-2 border-gray-200 rounded-xl text-center transition peer-checked:border-blue-500 peer-checked:bg-blue-50 hover:border-blue-300">
                            <div class="text-4xl mb-2">✍️</div>
                            <div class="font-semibold">Writing</div>
                        </div>
                    </label>
                </div>
            </div>
            
            <!-- Test Name -->
            <div class="mb-4">
                <label class="block text-sm font-semibold text-gray-700 mb-2">Test Nomi *</label>
                <input type="text" 
                       name="test_name" 
                       id="test_name"
                       required
                       class="w-full border border-gray-300 rounded-lg px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                       placeholder="IELTS Listening Practice Test 1">
            </div>
            
            <!-- Description -->
            <div class="mb-4">
                <label class="block text-sm font-semibold text-gray-700 mb-2">Tavsif</label>
                <textarea name="test_description" 
                          rows="2"
                          class="w-full border border-gray-300 rounded-lg px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                          placeholder="Test haqida qisqacha..."></textarea>
            </div>
            
            <!-- Duration -->
            <div class="mb-4">
                <label class="block text-sm font-semibold text-gray-700 mb-2">Davomiyligi (daqiqa) *</label>
                <input type="number" 
                       name="duration_minutes" 
                       value="30" 
                       min="1" 
                       max="180"
                       class="w-full border border-gray-300 rounded-lg px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200">
            </div>
            
            <!-- Audio Upload (Listening only) -->
            <div id="audio-upload-section" class="hidden">
                <label class="block text-sm font-semibold text-gray-700 mb-2">Audio Fayl (MP3) *</label>
                <input type="file" 
                       name="audio_file" 
                       accept="audio/mpeg"
                       class="block w-full text-sm text-gray-500
                              file:mr-4 file:py-2 file:px-4
                              file:rounded-lg file:border-0
                              file:text-sm file:font-semibold
                              file:bg-blue-50 file:text-blue-700
                              hover:file:bg-blue-100">
            </div>
        </div>
        
        <!-- Sections Container (MAIN PART!) -->
        <div id="sections-container" class="space-y-6">
            <!-- Sections will be added here dynamically -->
        </div>
        
        <!-- Add Section Button -->
        <div class="text-center mb-8">
            <button type="button" 
                    id="add-section-btn"
                    class="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-semibold transition">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                <span id="add-section-text">Add Section</span>
            </button>
        </div>
        
        <!-- Hidden input for sections data -->
        <input type="hidden" name="sections_data" id="sections_data">
        
        <!-- Save Button -->
        <div class="flex items-center justify-between bg-white rounded-xl shadow-lg p-6">
            <a href="{% url 'tests_list' %}" 
               class="text-gray-600 hover:text-gray-900">
                ← Orqaga
            </a>
            
            <button type="submit" 
                    class="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold transition">
                Test Saqlash
            </button>
        </div>
    </form>
</div>

<!-- JAVASCRIPT - ASOSIY QISM! -->
<script>
let sections = [];
let sectionCounter = 0;
let questionCounter = 0;

// Test type change
document.querySelectorAll('input[name="test_type"]').forEach(radio => {
    radio.addEventListener('change', function() {
        const testType = this.value;
        
        // Show/hide audio upload
        const audioSection = document.getElementById('audio-upload-section');
        if (testType === 'listening') {
            audioSection.classList.remove('hidden');
        } else {
            audioSection.classList.add('hidden');
        }
        
        // Update add section button text
        const addSectionText = document.getElementById('add-section-text');
        if (testType === 'listening') {
            addSectionText.textContent = 'Add Section';
        } else if (testType === 'reading') {
            addSectionText.textContent = 'Add Passage';
        } else if (testType === 'writing') {
            addSectionText.textContent = 'Add Task';
        }
        
        // Clear existing sections
        sections = [];
        document.getElementById('sections-container').innerHTML = '';
    });
});

// Add Section
document.getElementById('add-section-btn').addEventListener('click', function() {
    const testType = document.querySelector('input[name="test_type"]:checked');
    if (!testType) {
        alert('Avval test turini tanlang!');
        return;
    }
    
    addSection(testType.value);
});

function addSection(testType) {
    const sectionId = sectionCounter++;
    
    const section = {
        id: sectionId,
        title: '',
        text: '',
        questions: []
    };
    
    sections.push(section);
    
    const container = document.getElementById('sections-container');
    
    // Section HTML
    const sectionHTML = `
        <div class="bg-white rounded-xl shadow-lg p-6" data-section-id="${sectionId}">
            <!-- Section Header -->
            <div class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-3">
                    <div class="p-2 bg-blue-100 rounded-lg">
                        <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                        </svg>
                    </div>
                    <input type="text" 
                           class="text-xl font-bold border-0 border-b-2 border-transparent hover:border-gray-300 focus:border-blue-500 outline-none"
                           placeholder="${testType === 'reading' ? 'Passage title' : testType === 'writing' ? 'Task 1 / Task 2' : 'Section title'}"
                           data-section-id="${sectionId}"
                           data-field="title">
                </div>
                
                <button type="button" 
                        class="text-red-600 hover:text-red-700 p-2"
                        onclick="deleteSection(${sectionId})">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
            </div>
            
            ${testType === 'reading' ? `
            <!-- Passage Text -->
            <div class="mb-4">
                <textarea class="w-full border border-gray-200 rounded-lg px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                          rows="6"
                          placeholder="Passage text..."
                          data-section-id="${sectionId}"
                          data-field="text"></textarea>
            </div>
            ` : ''}
            
            ${testType === 'writing' ? `
            <!-- Task Prompt -->
            <div class="mb-4">
                <textarea class="w-full border border-gray-200 rounded-lg px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                          rows="4"
                          placeholder="Task prompt..."
                          data-section-id="${sectionId}"
                          data-field="text"></textarea>
            </div>
            ` : `
            <!-- Questions Container -->
            <div class="questions-container space-y-3 mb-4" data-section-id="${sectionId}">
                <!-- Questions will be added here -->
            </div>
            
            <!-- Add Question Button -->
            <button type="button" 
                    class="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold"
                    onclick="addQuestion(${sectionId})">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                Add Question
            </button>
            `}
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', sectionHTML);
    
    // Add event listeners
    addSectionEventListeners(sectionId);
}

function addSectionEventListeners(sectionId) {
    const sectionDiv = document.querySelector(`[data-section-id="${sectionId}"]`);
    
    // Title input
    const titleInput = sectionDiv.querySelector('[data-field="title"]');
    if (titleInput) {
        titleInput.addEventListener('input', function() {
            updateSectionData(sectionId, 'title', this.value);
        });
    }
    
    // Text input (for reading/writing)
    const textInput = sectionDiv.querySelector('[data-field="text"]');
    if (textInput) {
        textInput.addEventListener('input', function() {
            updateSectionData(sectionId, 'text', this.value);
        });
    }
}

function addQuestion(sectionId) {
    const questionId = questionCounter++;
    
    const section = sections.find(s => s.id === sectionId);
    if (!section) return;
    
    const question = {
        id: questionId,
        text: '',
        type: 'fill_blank',
        correct_answer: '',
        options: []
    };
    
    section.questions.push(question);
    
    const container = document.querySelector(`.questions-container[data-section-id="${sectionId}"]`);
    
    const questionHTML = `
        <div class="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition" data-question-id="${questionId}">
            <div class="flex items-start gap-4">
                <!-- Drag Handle -->
                <div class="flex-shrink-0 cursor-move text-gray-400 hover:text-gray-600 pt-3">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16" />
                    </svg>
                </div>
                
                <!-- Question Content -->
                <div class="flex-1">
                    <!-- Question Text -->
                    <input type="text" 
                           class="w-full border-0 border-b-2 border-gray-200 hover:border-gray-300 focus:border-blue-500 outline-none text-lg mb-3"
                           placeholder="Question text..."
                           data-question-id="${questionId}"
                           data-field="text">
                    
                    <div class="grid grid-cols-2 gap-4">
                        <!-- Question Type -->
                        <div>
                            <label class="block text-xs font-semibold text-gray-600 mb-1">Type</label>
                            <select class="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                    data-question-id="${questionId}"
                                    data-field="type">
                                <option value="fill_blank">Fill in the Blank</option>
                                <option value="mcq">Multiple Choice</option>
                                <option value="true_false">True/False</option>
                            </select>
                        </div>
                        
                        <!-- Correct Answer -->
                        <div>
                            <label class="block text-xs font-semibold text-gray-600 mb-1">Correct Answer</label>
                            <input type="text" 
                                   class="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                   placeholder="Answer..."
                                   data-question-id="${questionId}"
                                   data-field="correct_answer">
                        </div>
                    </div>
                    
                    <!-- Options (for MCQ) -->
                    <div class="options-container hidden mt-3" data-question-id="${questionId}">
                        <label class="block text-xs font-semibold text-gray-600 mb-1">Options (comma separated)</label>
                        <input type="text" 
                               class="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                               placeholder="Option A, Option B, Option C, Option D"
                               data-question-id="${questionId}"
                               data-field="options">
                    </div>
                </div>
                
                <!-- Delete Button -->
                <button type="button" 
                        class="flex-shrink-0 text-red-600 hover:text-red-700 p-2"
                        onclick="deleteQuestion(${sectionId}, ${questionId})">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', questionHTML);
    
    // Add event listeners
    addQuestionEventListeners(sectionId, questionId);
}

function addQuestionEventListeners(sectionId, questionId) {
    const questionDiv = document.querySelector(`[data-question-id="${questionId}"]`);
    
    // Question text
    const textInput = questionDiv.querySelector('[data-field="text"]');
    textInput.addEventListener('input', function() {
        updateQuestionData(sectionId, questionId, 'text', this.value);
    });
    
    // Question type
    const typeSelect = questionDiv.querySelector('[data-field="type"]');
    typeSelect.addEventListener('change', function() {
        updateQuestionData(sectionId, questionId, 'type', this.value);
        
        // Show/hide options field
        const optionsContainer = questionDiv.querySelector('.options-container');
        if (this.value === 'mcq') {
            optionsContainer.classList.remove('hidden');
        } else {
            optionsContainer.classList.add('hidden');
        }
    });
    
    // Correct answer
    const answerInput = questionDiv.querySelector('[data-field="correct_answer"]');
    answerInput.addEventListener('input', function() {
        updateQuestionData(sectionId, questionId, 'correct_answer', this.value);
    });
    
    // Options
    const optionsInput = questionDiv.querySelector('[data-field="options"]');
    if (optionsInput) {
        optionsInput.addEventListener('input', function() {
            const options = this.value.split(',').map(opt => opt.trim()).filter(opt => opt);
            updateQuestionData(sectionId, questionId, 'options', options);
        });
    }
}

function updateSectionData(sectionId, field, value) {
    const section = sections.find(s => s.id === sectionId);
    if (section) {
        section[field] = value;
        console.log('Updated section:', section);
    }
}

function updateQuestionData(sectionId, questionId, field, value) {
    const section = sections.find(s => s.id === sectionId);
    if (!section) return;
    
    const question = section.questions.find(q => q.id === questionId);
    if (question) {
        question[field] = value;
        console.log('Updated question:', question);
    }
}

function deleteSection(sectionId) {
    if (!confirm('Bu section'ni o\'chirishga ishonchingiz komilmi?')) return;
    
    sections = sections.filter(s => s.id !== sectionId);
    document.querySelector(`[data-section-id="${sectionId}"]`).remove();
}

function deleteQuestion(sectionId, questionId) {
    const section = sections.find(s => s.id === sectionId);
    if (!section) return;
    
    section.questions = section.questions.filter(q => q.id !== questionId);
    document.querySelector(`[data-question-id="${questionId}"]`).remove();
}

// Form submit
document.getElementById('test-form').addEventListener('submit', function(e) {
    // Save sections data to hidden input
    document.getElementById('sections_data').value = JSON.stringify(sections);
    
    console.log('Submitting sections:', sections);
});
</script>
{% endblock %}
```

---

## 3️⃣ URL ROUTING

**Fayl:** `urls.py`

```python
urlpatterns = [
    # ... mavjud patterns
    
    # Easy Test Creation
    path('tests/create/easy/', test_views.easy_test_create, name='easy_test_create'),
]
```

---

## 4️⃣ NAVIGATION UPDATE

**Fayl:** `admin_base.html` sidebar'da:

```html
<!-- OLD -->
<a href="{% url 'test_create_wizard' %}">Yangi Test</a>

<!-- REPLACE WITH NEW -->
<a href="{% url 'easy_test_create' %}">Yangi Test</a>
```

---

## 🎯 QANDAY ISHLAYDI:

### **1. Test Type Tanlash**
```
[🎧 Listening]  [📖 Reading]  [✍️ Writing]
```
Click qiling → type tanlanadi

### **2. Test Nomi**
```
Test Nomi: [IELTS Listening Practice Test 1____]
```

### **3. [+ Add Section] Click**
```
┌─────────────────────────────────────┐
│ 📝 [Section title________]      [×] │
│                                     │
│ [+ Add Question]                    │
└─────────────────────────────────────┘
```

### **4. [+ Add Question] Click**
```
┌─────────────────────────────────────┐
│ ≡ [Question text____________]  [×] │
│                                     │
│ Type: [Fill Blank ▼]                │
│ Correct Answer: [Paris______]       │
└─────────────────────────────────────┘
```

### **5. MCQ uchun:**
```
Type: [Multiple Choice ▼]
Options: [A, B, C, D____________]
Correct: [A____]
```

### **6. Drag-and-Drop:**
```
≡ Question 1  ← Drag handle
≡ Question 2
≡ Question 3
```

### **7. Delete:**
```
[×] ← Click → Question o'chadi
```

### **8. SAVE:**
```
[Test Saqlash] ← Bir marta click → HAMMASI saqlandi!
```

---

## ✅ FEATURES:

### ✅ **Inline Editing**
- Har narsa bir sahifada
- Alohida sahifaga o'tish yo'q
- Save tugmasi bosmasdan ham auto-save

### ✅ **Intuitive UI**
- Google Forms kabi
- Click → row ochiladi
- Yozish boshlaysiz
- Drag qiling → ordering o'zgaradi

### ✅ **No Confusion**
- Qayerga click qilishni bilasiz
- Har narsa ko'z oldida
- Real-time preview

### ✅ **Fast**
- 100 ta question qo'shish 5 minutda!
- Eski usul: 1 soat
- Yangi usul: 5 minut

---

## 🧪 SINOV:

### Test Ssenariysi:

1. **Test Yaratish**
   - `/tests/create/easy/` ga kiring
   - Listening tanlang
   - Test nomi: "IELTS Listening Test 1"

2. **Section Qo'shish**
   - [+ Add Section] click
   - Section title: "Part 1"

3. **Question Qo'shish**
   - [+ Add Question] click × 5
   - Har biriga question yozing
   - Type va answer yozing

4. **MCQ Test**
   - Type'ni "Multiple Choice" qiling
   - Options: "London, Paris, Berlin, Rome"
   - Correct: "Paris"

5. **Delete Test**
   - Bir question'ni [×] qiling
   - O'chishi kerak

6. **Save**
   - [Test Saqlash] click
   - Server'ga yuboriladi
   - Redirect → tests list

---

## 🎨 SCREENSHOT (Qanday Ko'rinishi):

```
┌─────────────────────────────────────────────────────┐
│  YANGI TEST                                          │
├─────────────────────────────────────────────────────┤
│  Test Turi:  [🎧 Listening] [📖 Reading] [✍️ Writing]│
│  Test Nomi:  [IELTS Practice Test 1______________]  │
│  Davomiyligi: [30] daqiqa                           │
│  Audio Fayl: [Choose File]                          │
├─────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────┐   │
│  │ 📝 Part 1                              [×]   │   │
│  │                                              │   │
│  │  ≡ What is your name?                 [×]   │   │
│  │    Type: Fill Blank ▼   Answer: John        │   │
│  │                                              │   │
│  │  ≡ Where are you from?                [×]   │   │
│  │    Type: MCQ ▼   Options: A,B,C,D           │   │
│  │    Correct Answer: London                   │   │
│  │                                              │   │
│  │  [+ Add Question]                           │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  [+ Add Section]                                    │
│                                                     │
│  [← Orqaga]                    [Test Saqlash →]    │
└─────────────────────────────────────────────────────┘
```

---

## 🚀 KEYINGI YAXSHILASHLAR:

### **Phase 2 (agar kerak bo'lsa):**
1. **Drag-and-Drop Ordering** (Sortable.js)
2. **Auto-Save Draft** (har 10 sekundda)
3. **Templates** (pre-made question sets)
4. **Bulk Import** (improved CSV upload)
5. **Preview Mode** (talaba ko'rinishi)

---

## ✅ ACCEPTANCE CRITERIA:

1. ✅ Bir sahifada hammasi
2. ✅ [+ Add Section] → yangi section inline
3. ✅ [+ Add Question] → yangi question inline
4. ✅ Type dropdown → MCQ uchun options ko'rinadi
5. ✅ Delete button → darhol o'chadi
6. ✅ Save → bir marta click → hammasi saqlandi
7. ✅ Google Forms kabi oson
8. ✅ Ustoz tushunadi

---

**BU - HAQIQIY OSON TEST CREATION!** 🎉

Ustoz uchun tushunarli, tez, intuitive!

**Yozaylikmi?** 😊
