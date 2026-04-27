# ETAP 2.5: TEST BAZA TO'G'RILASH VA TAKOMILLASHTIRISH

**Maqsad:** ETAP 2 da yaratilgan test baza tizimini to'g'rilash va yangi funksiyalar qo'shish. MP3 upload ishlashi, rasm qo'shish, test preview va clone funksiyalari.

---

## 📋 MUAMMOLAR VA YECHIMLAR

### ❌ MUAMMO 1: MP3 fayl yuklanmayapti

**Sabab:**
- Django `MEDIA_ROOT` va `MEDIA_URL` to'g'ri sozlanmagan
- Development serverda media fayllar serve qilinmayapti
- FileField validatsiya yo'q (50MB+ fayllar server'ni to'ldirishi mumkin)

**Yechim:**
- `settings.py` da `MEDIA_ROOT` va `MEDIA_URL` sozlash
- Development URL pattern qo'shish
- `mutagen` library bilan audio metadata tekshirish
- File size limit (50MB)

---

### ❌ MUAMMO 2: Listening test'da rasm qo'shish yo'q

**Sabab:**
- `ListeningSection` va `ListeningQuestion` modellarda `image` maydon yo'q
- Admin formada rasm upload funksiyasi yo'q

**Yechim:**
- Model'larga `ImageField` qo'shish
- Admin formada rasm preview
- Optional maydon (ba'zi savollar rasmli, ba'zilari yo'q)

---

### ❌ MUAMMO 3: Test yaratgandan keyin ko'rish imkoniyati yo'q

**Sabab:**
- Admin test yaratadi, lekin talaba ko'radigan ko'rinishda ko'ra olmaydi
- Xato bor-yo'qligini bilmaydi

**Yechim:**
- "Preview" tugmasi admin sahifasida
- Talaba interfeysidagi kabi render qilish
- Readonly mode (javob topshirish yo'q)

---

### ❌ MUAMMO 4: Test nusxa ko'chirish yo'q

**Sabab:**
- Har safar yangi test yaratish vaqt talab qiladi
- Bir xil strukturali testlar uchun clone funksiyasi kerak

**Yechim:**
- "Clone" tugmasi test list sahifasida
- Barcha section va savollarni nusxa ko'chirish
- Nomi "Copy of [original name]" bo'ladi

---

## 🔧 QILINISHI KERAK ISHLAR

---

## 1️⃣ MP3 UPLOAD TO'G'RILASH

### A) Django Settings sozlash

**Fayl:** `settings.py`

```python
import os

# Media Files
MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

# File Upload Settings
FILE_UPLOAD_MAX_MEMORY_SIZE = 52428800  # 50MB in bytes
DATA_UPLOAD_MAX_MEMORY_SIZE = 52428800  # 50MB
```

---

### B) URL pattern qo'shish (Development uchun)

**Fayl:** `urls.py` (asosiy)

```python
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    # ... mavjud patterns
]

# Development serverda media fayllarni serve qilish
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
```

---

### C) Audio validator yaratish

**Yangi fayl yaratish:** `tests/validators.py`

```python
from django.core.exceptions import ValidationError
import os
from mutagen.mp3 import MP3
from mutagen.wave import WAVE

def validate_audio_file(file):
    """Audio faylni tekshirish"""
    
    # File extension check
    ext = os.path.splitext(file.name)[1].lower()
    valid_extensions = ['.mp3', '.wav']
    
    if ext not in valid_extensions:
        raise ValidationError(f'Faqat MP3 yoki WAV formatdagi fayllar qabul qilinadi. Sizning fayl: {ext}')
    
    # File size check (50MB)
    if file.size > 50 * 1024 * 1024:
        raise ValidationError(f'Fayl hajmi 50MB dan oshmasligi kerak. Sizning fayl: {file.size / (1024*1024):.1f}MB')
    
    # Audio metadata check using mutagen
    try:
        file.seek(0)  # Reset file pointer
        
        if ext == '.mp3':
            audio = MP3(file)
            duration = audio.info.length
        elif ext == '.wav':
            audio = WAVE(file)
            duration = audio.info.length
        
        # Duration check (max 60 minutes)
        if duration > 3600:  # 60 minutes
            raise ValidationError(f'Audio uzunligi 60 daqiqadan oshmasligi kerak. Sizning audio: {duration/60:.1f} daqiqa')
        
        # Duration check (min 5 seconds)
        if duration < 5:
            raise ValidationError('Audio kamida 5 soniya bo\'lishi kerak')
            
    except Exception as e:
        raise ValidationError(f'Audio faylni o\'qishda xato: {str(e)}')
    
    finally:
        file.seek(0)  # Reset again for saving
    
    return file
```

---

### D) ListeningTest modelni yangilash

**Fayl:** `tests/models.py`

```python
from django.db import models
from .validators import validate_audio_file

class ListeningTest(models.Model):
    library = models.ForeignKey('Library', on_delete=models.CASCADE)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    
    # Audio fayl - validator bilan
    audio_file = models.FileField(
        upload_to='listening_audios/%Y/%m/',
        validators=[validate_audio_file],
        help_text='MP3 yoki WAV format, maksimal 50MB, maksimal 60 daqiqa'
    )
    
    duration_minutes = models.IntegerField(default=30, help_text='Test davomiyligi (daqiqada)')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'listening_tests'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.name} ({self.library.name})"
```

---

### E) Requirements.txt ga qo'shish

```
mutagen>=1.47.0
```

Terminal'da install:
```bash
pip install mutagen
```

---

## 2️⃣ RASM QO'SHISH FUNKSIYASI

### A) Model'larga ImageField qo'shish

**Fayl:** `tests/models.py`

```python
class ListeningSection(models.Model):
    test = models.ForeignKey(ListeningTest, on_delete=models.CASCADE, related_name='sections')
    title = models.CharField(max_length=200)
    order = models.IntegerField(default=1)
    
    # YANGI: Section uchun rasm (optional)
    image = models.ImageField(
        upload_to='listening_images/%Y/%m/',
        blank=True,
        null=True,
        help_text='Section uchun rasm (optional)'
    )
    
    instructions = models.TextField(blank=True, help_text='Talabalar uchun ko\'rsatma')
    
    class Meta:
        db_table = 'listening_sections'
        ordering = ['order']


class ListeningQuestion(models.Model):
    QUESTION_TYPES = [
        ('mcq', 'Multiple Choice'),
        ('fill_blank', 'Fill in the Blank'),
        ('matching', 'Matching'),
        ('true_false', 'True/False'),
    ]
    
    section = models.ForeignKey(ListeningSection, on_delete=models.CASCADE, related_name='questions')
    question_text = models.TextField()
    question_type = models.CharField(max_length=20, choices=QUESTION_TYPES)
    order = models.IntegerField(default=1)
    
    # YANGI: Savol uchun rasm (optional)
    image = models.ImageField(
        upload_to='listening_images/%Y/%m/',
        blank=True,
        null=True,
        help_text='Savol uchun rasm (masalan, map, diagram)'
    )
    
    # Options (JSON format for MCQ, Matching)
    options = models.JSONField(default=list, blank=True)
    
    # Correct answer
    correct_answer = models.CharField(max_length=500)
    
    class Meta:
        db_table = 'listening_questions'
        ordering = ['order']
```

---

### B) Reading model'larga ham rasm qo'shish

```python
class ReadingPassage(models.Model):
    test = models.ForeignKey(ReadingTest, on_delete=models.CASCADE, related_name='passages')
    title = models.CharField(max_length=200)
    text = models.TextField()
    order = models.IntegerField(default=1)
    
    # YANGI: Passage uchun rasm (optional)
    image = models.ImageField(
        upload_to='reading_images/%Y/%m/',
        blank=True,
        null=True,
        help_text='Passage uchun diagram yoki rasm'
    )
    
    class Meta:
        db_table = 'reading_passages'
        ordering = ['order']


class ReadingQuestion(models.Model):
    passage = models.ForeignKey(ReadingPassage, on_delete=models.CASCADE, related_name='questions')
    question_text = models.TextField()
    question_type = models.CharField(max_length=20, choices=QUESTION_TYPES)
    order = models.IntegerField(default=1)
    
    # YANGI: Savol uchun rasm
    image = models.ImageField(
        upload_to='reading_images/%Y/%m/',
        blank=True,
        null=True,
        help_text='Savol uchun rasm (diagram, chart, map)'
    )
    
    options = models.JSONField(default=list, blank=True)
    correct_answer = models.CharField(max_length=500)
    
    class Meta:
        db_table = 'reading_questions'
        ordering = ['order']
```

---

### C) Migration qilish

```bash
python manage.py makemigrations tests
python manage.py migrate tests
```

---

### D) Admin'da rasm ko'rsatish

**Fayl:** `tests/admin.py`

```python
from django.contrib import admin
from django.utils.html import format_html
from .models import ListeningTest, ListeningSection, ListeningQuestion

class ListeningQuestionInline(admin.TabularInline):
    model = ListeningQuestion
    extra = 1
    fields = ['order', 'question_text', 'question_type', 'image', 'image_preview', 'correct_answer']
    readonly_fields = ['image_preview']
    
    def image_preview(self, obj):
        if obj.image:
            return format_html('<img src="{}" style="max-height: 100px;"/>', obj.image.url)
        return '-'
    image_preview.short_description = 'Preview'


class ListeningSectionInline(admin.StackedInline):
    model = ListeningSection
    extra = 0
    fields = ['title', 'order', 'image', 'image_preview', 'instructions']
    readonly_fields = ['image_preview']
    
    def image_preview(self, obj):
        if obj.image:
            return format_html('<img src="{}" style="max-height: 150px;"/>', obj.image.url)
        return '-'
    image_preview.short_description = 'Preview'


@admin.register(ListeningTest)
class ListeningTestAdmin(admin.ModelAdmin):
    list_display = ['name', 'library', 'duration_minutes', 'audio_preview', 'created_at']
    list_filter = ['library', 'created_at']
    search_fields = ['name', 'description']
    inlines = [ListeningSectionInline]
    
    def audio_preview(self, obj):
        if obj.audio_file:
            return format_html(
                '<audio controls style="width: 200px;"><source src="{}" type="audio/mpeg"></audio>',
                obj.audio_file.url
            )
        return '-'
    audio_preview.short_description = 'Audio'
```

---

## 3️⃣ TEST PREVIEW FUNKSIYASI

### A) View yaratish

**Fayl:** `tests/views.py`

```python
from django.shortcuts import render, get_object_or_404
from django.contrib.auth.decorators import login_required
from .models import ListeningTest, ReadingTest, WritingTest

@login_required
def listening_test_preview(request, test_id):
    """Admin uchun Listening test preview"""
    test = get_object_or_404(ListeningTest, id=test_id, library=request.user.library)
    
    return render(request, 'tests/preview_listening.html', {
        'test': test,
        'preview_mode': True,
    })


@login_required
def reading_test_preview(request, test_id):
    """Admin uchun Reading test preview"""
    test = get_object_or_404(ReadingTest, id=test_id, library=request.user.library)
    
    return render(request, 'tests/preview_reading.html', {
        'test': test,
        'preview_mode': True,
    })


@login_required
def writing_test_preview(request, test_id):
    """Admin uchun Writing test preview"""
    test = get_object_or_404(WritingTest, id=test_id, library=request.user.library)
    
    return render(request, 'tests/preview_writing.html', {
        'test': test,
        'preview_mode': True,
    })
```

---

### B) URL pattern

**Fayl:** `urls.py`

```python
from tests import views as test_views

urlpatterns = [
    # ... mavjud patterns
    
    # Preview URLs
    path('tests/listening/<int:test_id>/preview/', test_views.listening_test_preview, name='listening_test_preview'),
    path('tests/reading/<int:test_id>/preview/', test_views.reading_test_preview, name='reading_test_preview'),
    path('tests/writing/<int:test_id>/preview/', test_views.writing_test_preview, name='writing_test_preview'),
]
```

---

### C) Template yaratish

**Fayl:** `tests/templates/tests/preview_listening.html`

```html
{% extends 'base.html' %}

{% block content %}
<div class="max-w-4xl mx-auto py-8 px-4">
    <!-- Preview Banner -->
    <div class="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-6">
        <p class="font-bold">📋 PREVIEW MODE</p>
        <p class="text-sm">Bu talabalar ko'radigan ko'rinish. Javob topshirish o'chirilgan.</p>
    </div>
    
    <!-- Test Info -->
    <div class="bg-white rounded-lg shadow p-6 mb-6">
        <h1 class="text-3xl font-bold mb-2">{{ test.name }}</h1>
        <p class="text-gray-600 mb-4">{{ test.description }}</p>
        <p class="text-sm text-gray-500">Davomiyligi: {{ test.duration_minutes }} daqiqa</p>
    </div>
    
    <!-- Audio Player -->
    {% if test.audio_file %}
    <div class="bg-white rounded-lg shadow p-6 mb-6">
        <h2 class="text-xl font-semibold mb-4">Audio</h2>
        <audio controls class="w-full">
            <source src="{{ test.audio_file.url }}" type="audio/mpeg">
            Brauzeringiz audio'ni qo'llab-quvvatlamaydi.
        </audio>
    </div>
    {% endif %}
    
    <!-- Sections -->
    {% for section in test.sections.all %}
    <div class="bg-white rounded-lg shadow p-6 mb-6">
        <h2 class="text-2xl font-bold mb-4">{{ section.title }}</h2>
        
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
        
        <!-- Questions -->
        {% for q in section.questions.all %}
        <div class="mb-6 pb-4 border-b last:border-0">
            <p class="font-semibold mb-2">{{ forloop.counter }}. {{ q.question_text }}</p>
            
            {% if q.image %}
            <div class="mb-3">
                <img src="{{ q.image.url }}" alt="Question {{ forloop.counter }}" class="max-w-md h-auto rounded border">
            </div>
            {% endif %}
            
            {% if q.question_type == 'mcq' %}
                {% for opt in q.options %}
                <label class="block mb-1 text-gray-700">
                    <input type="radio" disabled class="mr-2">
                    {{ opt }}
                </label>
                {% endfor %}
            {% elif q.question_type == 'fill_blank' %}
                <input type="text" disabled 
                       class="border px-3 py-2 rounded w-full max-w-sm bg-gray-50"
                       placeholder="Javob kiritish o'chirilgan (preview mode)">
            {% elif q.question_type == 'true_false' %}
                <label class="block mb-1">
                    <input type="radio" disabled class="mr-2">
                    True
                </label>
                <label class="block mb-1">
                    <input type="radio" disabled class="mr-2">
                    False
                </label>
            {% endif %}
            
            <!-- Correct answer (faqat preview mode da) -->
            <p class="text-sm text-green-600 mt-2">✓ To'g'ri javob: {{ q.correct_answer }}</p>
        </div>
        {% endfor %}
    </div>
    {% endfor %}
    
    <!-- Back button -->
    <div class="text-center mt-8">
        <a href="{% url 'admin:tests_listeningtest_change' test.id %}" 
           class="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700">
            ← Admin panelga qaytish
        </a>
    </div>
</div>
{% endblock %}
```

**Xuddi shunday `preview_reading.html` va `preview_writing.html` yaratiladi.**

---

### D) Admin'ga "Preview" tugmasi qo'shish

**Fayl:** `tests/admin.py`

```python
from django.urls import reverse
from django.utils.html import format_html

@admin.register(ListeningTest)
class ListeningTestAdmin(admin.ModelAdmin):
    list_display = ['name', 'library', 'duration_minutes', 'audio_preview', 'preview_button', 'created_at']
    
    def preview_button(self, obj):
        url = reverse('listening_test_preview', args=[obj.id])
        return format_html(
            '<a href="{}" target="_blank" class="button" style="padding: 5px 10px; background: #417690; color: white; border-radius: 4px; text-decoration: none;">👁 Preview</a>',
            url
        )
    preview_button.short_description = 'Amallar'
```

---

## 4️⃣ TEST CLONE (NUSXA KO'CHIRISH)

### A) Clone funksiyasi yaratish

**Fayl:** `tests/utils.py` (yangi)

```python
from .models import ListeningTest, ListeningSection, ListeningQuestion
from .models import ReadingTest, ReadingPassage, ReadingQuestion
from .models import WritingTest

def clone_listening_test(original_test, new_name=None):
    """Listening testni nusxa ko'chirish"""
    
    # Yangi test yaratish
    new_test = ListeningTest.objects.create(
        library=original_test.library,
        name=new_name or f"Copy of {original_test.name}",
        description=original_test.description,
        audio_file=original_test.audio_file,  # Xuddi shu fayl (nusxa emas)
        duration_minutes=original_test.duration_minutes,
    )
    
    # Sectionlarni nusxa ko'chirish
    for section in original_test.sections.all():
        new_section = ListeningSection.objects.create(
            test=new_test,
            title=section.title,
            order=section.order,
            image=section.image,
            instructions=section.instructions,
        )
        
        # Savollarni nusxa ko'chirish
        for question in section.questions.all():
            ListeningQuestion.objects.create(
                section=new_section,
                question_text=question.question_text,
                question_type=question.question_type,
                order=question.order,
                image=question.image,
                options=question.options,
                correct_answer=question.correct_answer,
            )
    
    return new_test


def clone_reading_test(original_test, new_name=None):
    """Reading testni nusxa ko'chirish"""
    
    new_test = ReadingTest.objects.create(
        library=original_test.library,
        name=new_name or f"Copy of {original_test.name}",
        description=original_test.description,
        duration_minutes=original_test.duration_minutes,
    )
    
    for passage in original_test.passages.all():
        new_passage = ReadingPassage.objects.create(
            test=new_test,
            title=passage.title,
            text=passage.text,
            order=passage.order,
            image=passage.image,
        )
        
        for question in passage.questions.all():
            ReadingQuestion.objects.create(
                passage=new_passage,
                question_text=question.question_text,
                question_type=question.question_type,
                order=question.order,
                image=question.image,
                options=question.options,
                correct_answer=question.correct_answer,
            )
    
    return new_test


def clone_writing_test(original_test, new_name=None):
    """Writing testni nusxa ko'chirish"""
    
    new_test = WritingTest.objects.create(
        library=original_test.library,
        name=new_name or f"Copy of {original_test.name}",
        description=original_test.description,
        task1_description=original_test.task1_description,
        task1_image=original_test.task1_image,
        task2_description=original_test.task2_description,
        duration_minutes=original_test.duration_minutes,
    )
    
    return new_test
```

---

### B) View yaratish

**Fayl:** `tests/views.py`

```python
from django.contrib import messages
from django.shortcuts import redirect
from .utils import clone_listening_test, clone_reading_test, clone_writing_test

@login_required
def clone_listening_test_view(request, test_id):
    """Listening testni clone qilish"""
    original = get_object_or_404(ListeningTest, id=test_id, library=request.user.library)
    
    new_test = clone_listening_test(original)
    
    messages.success(request, f'"{original.name}" testidan nusxa yaratildi: "{new_test.name}"')
    
    return redirect('admin:tests_listeningtest_change', new_test.id)


@login_required
def clone_reading_test_view(request, test_id):
    """Reading testni clone qilish"""
    original = get_object_or_404(ReadingTest, id=test_id, library=request.user.library)
    
    new_test = clone_reading_test(original)
    
    messages.success(request, f'"{original.name}" testidan nusxa yaratildi: "{new_test.name}"')
    
    return redirect('admin:tests_readingtest_change', new_test.id)


@login_required
def clone_writing_test_view(request, test_id):
    """Writing testni clone qilish"""
    original = get_object_or_404(WritingTest, id=test_id, library=request.user.library)
    
    new_test = clone_writing_test(original)
    
    messages.success(request, f'"{original.name}" testidan nusxa yaratildi: "{new_test.name}"')
    
    return redirect('admin:tests_writingtest_change', new_test.id)
```

---

### C) URL pattern

```python
urlpatterns = [
    # Clone URLs
    path('tests/listening/<int:test_id>/clone/', test_views.clone_listening_test_view, name='clone_listening_test'),
    path('tests/reading/<int:test_id>/clone/', test_views.clone_reading_test_view, name='clone_reading_test'),
    path('tests/writing/<int:test_id>/clone/', test_views.clone_writing_test_view, name='clone_writing_test'),
]
```

---

### D) Admin'ga "Clone" tugmasi

**Fayl:** `tests/admin.py`

```python
@admin.register(ListeningTest)
class ListeningTestAdmin(admin.ModelAdmin):
    list_display = ['name', 'library', 'duration_minutes', 'audio_preview', 'action_buttons', 'created_at']
    
    def action_buttons(self, obj):
        preview_url = reverse('listening_test_preview', args=[obj.id])
        clone_url = reverse('clone_listening_test', args=[obj.id])
        
        return format_html(
            '<a href="{}" target="_blank" class="button" style="padding: 5px 10px; background: #417690; color: white; border-radius: 4px; text-decoration: none; margin-right: 5px;">👁 Preview</a>'
            '<a href="{}" class="button" style="padding: 5px 10px; background: #28a745; color: white; border-radius: 4px; text-decoration: none;">📋 Clone</a>',
            preview_url, clone_url
        )
    action_buttons.short_description = 'Amallar'
```

---

## 🧪 SINOV (TESTING)

### Test Ssenariysi:

#### 1. MP3 Upload Test
```bash
# Terminal'da
python manage.py shell

>>> from tests.models import ListeningTest
>>> from django.core.files import File
>>> test = ListeningTest.objects.first()

# Kichik MP3 fayl yuklang (< 50MB)
>>> with open('test_audio.mp3', 'rb') as f:
>>>     test.audio_file.save('test.mp3', File(f))

# Admin panelda audio player ko'rinishi kerak
```

#### 2. Rasm Upload Test
```bash
# Admin panelda:
# 1. Listening test edit
# 2. Section qo'shing, rasm yuklang
# 3. Savol qo'shing, rasm yuklang
# 4. Save bosing
# 5. Preview tugmasini bosing
# 6. Rasmlar ko'rinishi kerak
```

#### 3. Preview Test
```
1. Admin panel → Listening Tests → test tanlang
2. "Preview" tugmasini bosing
3. Yangi tab ochiladi
4. Talaba ko'radigan ko'rinishda test ko'rsatiladi
5. Input'lar disabled (javob topshirish o'chirilgan)
6. To'g'ri javoblar yashil rangda ko'rsatiladi
```

#### 4. Clone Test
```
1. Admin panel → Listening Tests
2. Biror test yonidagi "Clone" tugmasini bosing
3. Yangi test yaratiladi: "Copy of [original]"
4. Barcha section va savollar nusxa ko'chirilgan
5. Audio fayl xuddi shu (yangi nusxa emas)
```

---

## ✅ ACCEPTANCE CRITERIA

1. ✅ MP3 fayl yuklanadi va audio player ko'rsatiladi
2. ✅ 50MB+ fayl reject qilinadi va xato xabari chiqadi
3. ✅ Section va savollar uchun rasm qo'shiladi
4. ✅ Preview mode talaba interfeysini to'liq ko'rsatadi
5. ✅ Preview mode'da input'lar disabled
6. ✅ Clone tugmasi barcha ma'lumotlarni nusxa ko'chiradi
7. ✅ Clone qilingan testni edit qilish mumkin

---

## 📦 MIGRATION VA DEPLOYMENT

### 1. Migration
```bash
python manage.py makemigrations tests
python manage.py migrate tests
```

### 2. Requirements
```bash
pip install mutagen Pillow
```

### 3. Media papka yaratish
```bash
mkdir -p media/listening_audios
mkdir -p media/listening_images
mkdir -p media/reading_images
```

### 4. Permissions (Production server'da)
```bash
chmod 755 media
chown -R www-data:www-data media
```

---

## 🚨 MUHIM ESLATMALAR

### 1. Audio Fayl Optimal Hajmi
- IELTS Listening odatda 30-40 daqiqa
- MP3 128kbps: ~30 daqiqa = ~30MB
- WAV format ishlatmang (juda katta)
- Admin'ga ko'rsatma: "Audio'ni MP3 formatda, 128kbps bitrate'da optimize qiling"

### 2. Rasm Optimal Hajmi
- Maksimal 2MB
- PNG yoki JPEG
- Optimal o'lcham: 800x600 yoki 1024x768
- Django Pillow bilan avtomatik resize qilish mumkin (keyinroq)

### 3. Production Server Media Serve
- Development: Django static serve
- Production: Nginx yoki S3 bucket
- ETAP 3 tugagandan keyin Nginx config qo'shiladi

---

## 🎯 YAKUNIY NATIJA

ETAP 2.5 tugagandan keyin:

✅ **Admin oson test yaratadi**
- MP3 yuklaydi, avtomatik validatsiya
- Rasm qo'shadi (optional)
- Preview qilib ko'radi
- Clone qilib vaqt tejaydi

✅ **Test sifati yuqori**
- Audio to'g'ri formatda
- Rasmlar ko'rsatiladi (diagram, map, chart)
- Xatolar preview'da topiladi

✅ **ETAP 3 ga tayyor**
- Mock sessiya test bazasidan test tanlaydi
- Barcha funksiyalar ishlaydi

---

Omad! 🚀
