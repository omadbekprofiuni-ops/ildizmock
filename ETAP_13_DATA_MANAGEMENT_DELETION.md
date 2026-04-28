# ETAP 13: DATA MANAGEMENT & SAFE DELETION

**Maqsad:** O'quv markaz admini testlar, sessiyalar, talabalar, statistikalarni XAVFSIZ o'chira oladi. Double confirmation, soft delete, restore option.

---

## 📋 ETAP 13 QISMLARI

### 1. Test Deletion
- Test o'chirish (all sections/questions cascade)
- Bulk test deletion
- Archive option
- Restore deleted tests

### 2. Session Deletion
- Mock session o'chirish (all participants/results)
- Practice attempts o'chirish
- Bulk deletion

### 3. Student & Group Management
- Student deletion (all data)
- Group deletion
- Bulk operations

### 4. Safety Features
- Double confirmation
- Soft delete (archive)
- Restore functionality
- Audit logs

---

## 🔧 QILINISHI KERAK ISHLAR

---

## 1️⃣ SOFT DELETE PATTERN

### A) Model Updates - Add Deleted Flag

**Fayl:** `tests/models.py` (har bir asosiy model)

```python
from django.db import models
from django.utils import timezone

class SoftDeleteManager(models.Manager):
    """Deleted items'larni avtomatik exclude qiladi"""
    def get_queryset(self):
        return super().get_queryset().filter(is_deleted=False)


class SoftDeleteModel(models.Model):
    """Base model for soft deletion"""
    
    is_deleted = models.BooleanField(
        default=False,
        verbose_name='O\'chirilgan'
    )
    
    deleted_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='O\'chirilgan vaqti'
    )
    
    deleted_by = models.ForeignKey(
        'auth.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='%(class)s_deleted',
        verbose_name='Kim o\'chirdi'
    )
    
    # Default manager - excludes deleted
    objects = SoftDeleteManager()
    
    # All objects including deleted
    all_objects = models.Manager()
    
    class Meta:
        abstract = True
    
    def soft_delete(self, user=None):
        """Soft delete - archive, don't remove from DB"""
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.deleted_by = user
        self.save()
    
    def restore(self):
        """Restore from deleted"""
        self.is_deleted = False
        self.deleted_at = None
        self.deleted_by = None
        self.save()


# UPDATE EXISTING MODELS:

class ListeningTest(SoftDeleteModel, TimeStampedModel):
    """Listening test - NOW with soft delete"""
    # ... existing fields ...
    pass

class ReadingTest(SoftDeleteModel, TimeStampedModel):
    """Reading test - NOW with soft delete"""
    # ... existing fields ...
    pass

class WritingTest(SoftDeleteModel, TimeStampedModel):
    """Writing test - NOW with soft delete"""
    # ... existing fields ...
    pass

class MockSession(SoftDeleteModel, TimeStampedModel):
    """Mock session - NOW with soft delete"""
    # ... existing fields ...
    pass

class StudentProfile(SoftDeleteModel, TimeStampedModel):
    """Student profile - NOW with soft delete"""
    # ... existing fields ...
    pass
```

---

## 2️⃣ TEST DELETION VIEWS

### A) Delete Single Test

**Fayl:** `tests/views.py`

```python
from django.shortcuts import get_object_or_404, redirect
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db import transaction

@login_required
def test_delete(request, test_type, test_id):
    """
    Test o'chirish - SOFT DELETE
    test_type: 'listening', 'reading', 'writing'
    """
    
    library = request.user.library
    
    # Get test based on type
    if test_type == 'listening':
        test = get_object_or_404(ListeningTest, id=test_id, library=library)
    elif test_type == 'reading':
        test = get_object_or_404(ReadingTest, id=test_id, library=library)
    elif test_type == 'writing':
        test = get_object_or_404(WritingTest, id=test_id, library=library)
    else:
        messages.error(request, 'Noto\'g\'ri test turi!')
        return redirect('tests_list')
    
    if request.method == 'POST':
        action = request.POST.get('action')
        
        if action == 'soft_delete':
            # SOFT DELETE - Archive
            test.soft_delete(user=request.user)
            messages.success(request, f'Test "{test.name}" arxivlandi. 30 kun ichida qaytarishingiz mumkin.')
            
        elif action == 'hard_delete':
            # HARD DELETE - Permanent
            # Check if test is used in any sessions
            if test_type == 'listening':
                sessions_count = MockSession.objects.filter(listening_test=test).count()
            elif test_type == 'reading':
                sessions_count = MockSession.objects.filter(reading_test=test).count()
            else:
                sessions_count = MockSession.objects.filter(writing_test=test).count()
            
            if sessions_count > 0:
                messages.error(
                    request, 
                    f'Bu test {sessions_count} ta sessiyada ishlatilgan! '
                    f'Avval sessiyalarni o\'chiring yoki arxivlang.'
                )
                return redirect('test_delete_confirm', test_type=test_type, test_id=test_id)
            
            # Safe to delete
            with transaction.atomic():
                test_name = test.name
                test.delete()  # CASCADE - all sections/questions deleted
            
            messages.warning(request, f'Test "{test_name}" butunlay o\'chirildi!')
        
        return redirect('tests_list')
    
    # Show confirmation page
    return render(request, 'tests/test_delete_confirm.html', {
        'test': test,
        'test_type': test_type,
    })


@login_required
def test_restore(request, test_type, test_id):
    """O'chirilgan testni qaytarish"""
    
    library = request.user.library
    
    # Get deleted test
    if test_type == 'listening':
        test = get_object_or_404(ListeningTest.all_objects, id=test_id, library=library, is_deleted=True)
    elif test_type == 'reading':
        test = get_object_or_404(ReadingTest.all_objects, id=test_id, library=library, is_deleted=True)
    elif test_type == 'writing':
        test = get_object_or_404(WritingTest.all_objects, id=test_id, library=library, is_deleted=True)
    else:
        messages.error(request, 'Noto\'g\'ri test turi!')
        return redirect('archive_list')
    
    test.restore()
    messages.success(request, f'Test "{test.name}" qaytarildi!')
    
    return redirect('tests_list')
```

---

### B) Test Delete Confirmation Template

**Fayl:** `tests/templates/tests/test_delete_confirm.html`

```html
{% extends 'admin_base.html' %}

{% block page_title %}Testni O'chirish{% endblock %}

{% block content %}
<div class="max-w-3xl mx-auto p-8">
    <div class="bg-white rounded-xl shadow-lg p-8">
        <!-- Header -->
        <div class="text-center mb-8">
            <div class="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg class="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
            </div>
            <h1 class="text-3xl font-bold text-gray-900 mb-2">Testni O'chirmoqchimisiz?</h1>
            <p class="text-xl text-gray-700 font-semibold">{{ test.name }}</p>
        </div>
        
        <!-- Test Info -->
        <div class="bg-gray-50 rounded-lg p-6 mb-6">
            <h3 class="font-semibold text-gray-900 mb-3">Test Ma'lumotlari:</h3>
            <div class="space-y-2">
                <p class="text-gray-700">
                    <span class="font-semibold">Turi:</span> 
                    {{ test_type|title }}
                </p>
                <p class="text-gray-700">
                    <span class="font-semibold">Yaratilgan:</span> 
                    {{ test.created_at|date:"d M Y, H:i" }}
                </p>
                
                {% if test_type == 'listening' %}
                <p class="text-gray-700">
                    <span class="font-semibold">Sections:</span> 
                    {{ test.sections.count }} ta
                </p>
                <p class="text-gray-700">
                    <span class="font-semibold">Questions:</span> 
                    {% with total=0 %}
                    {% for section in test.sections.all %}
                        {% with total=total|add:section.questions.count %}{% endwith %}
                    {% endfor %}
                    {{ total }} ta
                    {% endwith %}
                </p>
                {% endif %}
            </div>
        </div>
        
        <!-- Warning Box -->
        <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
            <div class="flex">
                <div class="flex-shrink-0">
                    <svg class="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                    </svg>
                </div>
                <div class="ml-3">
                    <h3 class="text-sm font-semibold text-yellow-800 mb-2">DIQQAT!</h3>
                    <div class="text-sm text-yellow-700 space-y-1">
                        <p><strong>Arxivlash:</strong> Test 30 kun davomida arxivda saqlanadi, keyin o'chiriladi</p>
                        <p><strong>Butunlay o'chirish:</strong> Test va barcha ma'lumotlar darhol o'chiriladi (qaytarib bo'lmaydi!)</p>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Options -->
        <form method="post" class="space-y-4">
            {% csrf_token %}
            
            <!-- Soft Delete (Recommended) -->
            <div class="border-2 border-blue-200 rounded-lg p-6 hover:border-blue-400 transition">
                <div class="flex items-start gap-4">
                    <input type="radio" 
                           name="action" 
                           value="soft_delete" 
                           id="soft_delete"
                           class="mt-1 w-5 h-5 text-blue-600"
                           checked>
                    <label for="soft_delete" class="flex-1 cursor-pointer">
                        <div class="flex items-center gap-2 mb-1">
                            <span class="font-bold text-gray-900">Arxivlash</span>
                            <span class="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-semibold">Tavsiya</span>
                        </div>
                        <p class="text-sm text-gray-600">Test arxivlanadi, 30 kun ichida qaytarishingiz mumkin</p>
                    </label>
                </div>
            </div>
            
            <!-- Hard Delete (Dangerous) -->
            <div class="border-2 border-red-200 rounded-lg p-6 hover:border-red-400 transition">
                <div class="flex items-start gap-4">
                    <input type="radio" 
                           name="action" 
                           value="hard_delete" 
                           id="hard_delete"
                           class="mt-1 w-5 h-5 text-red-600">
                    <label for="hard_delete" class="flex-1 cursor-pointer">
                        <div class="flex items-center gap-2 mb-1">
                            <span class="font-bold text-gray-900">Butunlay O'chirish</span>
                            <span class="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full font-semibold">Xavfli</span>
                        </div>
                        <p class="text-sm text-gray-600">Test darhol o'chiriladi, qaytarish MUMKIN EMAS!</p>
                    </label>
                </div>
            </div>
            
            <!-- Double Confirmation for Hard Delete -->
            <div id="hard_delete_confirmation" class="hidden">
                <div class="bg-red-50 border-2 border-red-400 rounded-lg p-4">
                    <label class="flex items-start gap-3 cursor-pointer">
                        <input type="checkbox" 
                               id="confirm_hard_delete" 
                               class="mt-1 w-5 h-5 text-red-600">
                        <span class="text-sm text-red-800">
                            <strong>Men tushundim:</strong> Bu test va uning barcha ma'lumotlari (sections, questions, etc.) 
                            BUTUNLAY o'chiriladi va qaytarib bo'lmaydi!
                        </span>
                    </label>
                </div>
            </div>
            
            <!-- Buttons -->
            <div class="flex gap-3 pt-4">
                <button type="submit" 
                        id="delete_button"
                        class="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed">
                    O'chirish
                </button>
                
                <a href="{% url 'tests_list' %}" 
                   class="flex-1 text-center bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold transition">
                    Bekor Qilish
                </a>
            </div>
        </form>
    </div>
</div>

<script>
// Show/hide hard delete confirmation
const softDeleteRadio = document.getElementById('soft_delete');
const hardDeleteRadio = document.getElementById('hard_delete');
const hardDeleteConfirmation = document.getElementById('hard_delete_confirmation');
const confirmCheckbox = document.getElementById('confirm_hard_delete');
const deleteButton = document.getElementById('delete_button');

function updateUI() {
    if (hardDeleteRadio.checked) {
        hardDeleteConfirmation.classList.remove('hidden');
        deleteButton.disabled = !confirmCheckbox.checked;
    } else {
        hardDeleteConfirmation.classList.add('hidden');
        deleteButton.disabled = false;
    }
}

softDeleteRadio.addEventListener('change', updateUI);
hardDeleteRadio.addEventListener('change', updateUI);
confirmCheckbox.addEventListener('change', updateUI);

updateUI();
</script>
{% endblock %}
```

---

## 3️⃣ SESSION DELETION

### A) View

**Fayl:** `mock/views.py`

```python
@login_required
def session_delete(request, session_id):
    """Mock sessiyani o'chirish"""
    
    session = get_object_or_404(
        MockSession,
        id=session_id,
        library=request.user.library
    )
    
    if request.method == 'POST':
        action = request.POST.get('action')
        
        if action == 'soft_delete':
            # Soft delete
            session.soft_delete(user=request.user)
            messages.success(request, f'Sessiya "{session.name}" arxivlandi!')
            
        elif action == 'hard_delete':
            # Check participants
            participants_count = session.participants.count()
            
            if participants_count > 0:
                # Ask for confirmation - will delete all results!
                confirm = request.POST.get('confirm_delete_results')
                if confirm != 'yes':
                    messages.error(
                        request,
                        f'Bu sessiyada {participants_count} ta ishtirokchi bor! '
                        f'Barcha natijalar o\'chiriladi. Tasdiqlang.'
                    )
                    return redirect('session_delete', session_id=session_id)
            
            # Delete
            with transaction.atomic():
                session_name = session.name
                session.delete()  # CASCADE - all participants deleted
            
            messages.warning(request, f'Sessiya "{session_name}" va barcha natijalar o\'chirildi!')
        
        return redirect('mock_sessions_list')
    
    # Show confirmation
    return render(request, 'mock/session_delete_confirm.html', {
        'session': session,
        'participants_count': session.participants.count(),
    })
```

---

## 4️⃣ BULK DELETION

### A) Bulk Delete Tests View

**Fayl:** `tests/views.py`

```python
@login_required
def tests_bulk_delete(request):
    """Ko'plab testlarni bir vaqtda o'chirish"""
    
    if request.method == 'POST':
        test_ids = request.POST.getlist('test_ids')
        action = request.POST.get('action')
        
        if not test_ids:
            messages.error(request, 'Test tanlanmagan!')
            return redirect('tests_list')
        
        # Get tests
        tests = []
        for test_id in test_ids:
            test_type, tid = test_id.split('_')
            if test_type == 'listening':
                test = ListeningTest.objects.filter(id=tid, library=request.user.library).first()
            elif test_type == 'reading':
                test = ReadingTest.objects.filter(id=tid, library=request.user.library).first()
            elif test_type == 'writing':
                test = WritingTest.objects.filter(id=tid, library=request.user.library).first()
            
            if test:
                tests.append(test)
        
        if action == 'soft_delete':
            # Soft delete all
            for test in tests:
                test.soft_delete(user=request.user)
            
            messages.success(request, f'{len(tests)} ta test arxivlandi!')
            
        elif action == 'hard_delete':
            # Hard delete all
            with transaction.atomic():
                count = 0
                for test in tests:
                    test.delete()
                    count += 1
            
            messages.warning(request, f'{count} ta test butunlay o\'chirildi!')
        
        return redirect('tests_list')
    
    return redirect('tests_list')
```

---

## 5️⃣ ARCHIVE & RESTORE

### A) Archive List View

**Fayl:** `tests/views.py`

```python
@login_required
def archive_list(request):
    """O'chirilgan (arxivlangan) ma'lumotlar"""
    
    library = request.user.library
    
    # Get all deleted items
    deleted_listening = ListeningTest.all_objects.filter(
        library=library,
        is_deleted=True
    ).order_by('-deleted_at')
    
    deleted_reading = ReadingTest.all_objects.filter(
        library=library,
        is_deleted=True
    ).order_by('-deleted_at')
    
    deleted_writing = WritingTest.all_objects.filter(
        library=library,
        is_deleted=True
    ).order_by('-deleted_at')
    
    deleted_sessions = MockSession.all_objects.filter(
        library=library,
        is_deleted=True
    ).order_by('-deleted_at')
    
    deleted_students = StudentProfile.all_objects.filter(
        library=library,
        is_deleted=True
    ).order_by('-deleted_at')
    
    return render(request, 'core/archive_list.html', {
        'deleted_listening': deleted_listening,
        'deleted_reading': deleted_reading,
        'deleted_writing': deleted_writing,
        'deleted_sessions': deleted_sessions,
        'deleted_students': deleted_students,
    })
```

---

### B) Archive List Template

**Fayl:** `templates/core/archive_list.html`

```html
{% extends 'admin_base.html' %}

{% block page_title %}Arxiv{% endblock %}

{% block content %}
<div class="p-8">
    <h1 class="text-3xl font-bold text-gray-900 mb-8">Arxivlangan Ma'lumotlar</h1>
    
    <!-- Info Box -->
    <div class="bg-blue-50 border-l-4 border-blue-400 p-4 mb-8">
        <p class="text-sm text-blue-800">
            <strong>Eslatma:</strong> Arxivlangan ma'lumotlar 30 kun saqlanadi, keyin avtomatik o'chiriladi. 
            Kerakli ma'lumotlarni qaytarishingiz mumkin.
        </p>
    </div>
    
    <!-- Tabs -->
    <div class="mb-6">
        <div class="border-b border-gray-200">
            <nav class="-mb-px flex space-x-8">
                <a href="#tests" class="tab-link active border-blue-500 text-blue-600 py-4 px-1 border-b-2 font-medium">
                    Testlar ({{ deleted_listening.count|add:deleted_reading.count|add:deleted_writing.count }})
                </a>
                <a href="#sessions" class="tab-link border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 py-4 px-1 border-b-2 font-medium">
                    Sessiyalar ({{ deleted_sessions.count }})
                </a>
                <a href="#students" class="tab-link border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 py-4 px-1 border-b-2 font-medium">
                    Talabalar ({{ deleted_students.count }})
                </a>
            </nav>
        </div>
    </div>
    
    <!-- Tests Tab -->
    <div id="tests-content" class="tab-content">
        <div class="bg-white rounded-lg shadow overflow-hidden">
            <table class="min-w-full">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Test Nomi</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Turi</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">O'chirilgan</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kim o'chirdi</th>
                        <th class="px-6 py-3"></th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                    {% for test in deleted_listening %}
                    <tr>
                        <td class="px-6 py-4 font-semibold">{{ test.name }}</td>
                        <td class="px-6 py-4">
                            <span class="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm">Listening</span>
                        </td>
                        <td class="px-6 py-4 text-sm text-gray-500">{{ test.deleted_at|date:"d M Y, H:i" }}</td>
                        <td class="px-6 py-4 text-sm">{{ test.deleted_by.get_full_name }}</td>
                        <td class="px-6 py-4 text-right">
                            <a href="{% url 'test_restore' 'listening' test.id %}" 
                               class="text-blue-600 hover:text-blue-700 font-semibold"
                               onclick="return confirm('Bu testni qaytarmoqchimisiz?')">
                                Qaytarish
                            </a>
                        </td>
                    </tr>
                    {% endfor %}
                    
                    {% for test in deleted_reading %}
                    <tr>
                        <td class="px-6 py-4 font-semibold">{{ test.name }}</td>
                        <td class="px-6 py-4">
                            <span class="px-2 py-1 bg-purple-100 text-purple-700 rounded text-sm">Reading</span>
                        </td>
                        <td class="px-6 py-4 text-sm text-gray-500">{{ test.deleted_at|date:"d M Y, H:i" }}</td>
                        <td class="px-6 py-4 text-sm">{{ test.deleted_by.get_full_name }}</td>
                        <td class="px-6 py-4 text-right">
                            <a href="{% url 'test_restore' 'reading' test.id %}" 
                               class="text-blue-600 hover:text-blue-700 font-semibold"
                               onclick="return confirm('Bu testni qaytarmoqchimisiz?')">
                                Qaytarish
                            </a>
                        </td>
                    </tr>
                    {% endfor %}
                    
                    {% for test in deleted_writing %}
                    <tr>
                        <td class="px-6 py-4 font-semibold">{{ test.name }}</td>
                        <td class="px-6 py-4">
                            <span class="px-2 py-1 bg-orange-100 text-orange-700 rounded text-sm">Writing</span>
                        </td>
                        <td class="px-6 py-4 text-sm text-gray-500">{{ test.deleted_at|date:"d M Y, H:i" }}</td>
                        <td class="px-6 py-4 text-sm">{{ test.deleted_by.get_full_name }}</td>
                        <td class="px-6 py-4 text-right">
                            <a href="{% url 'test_restore' 'writing' test.id %}" 
                               class="text-blue-600 hover:text-blue-700 font-semibold"
                               onclick="return confirm('Bu testni qaytarmoqchimisiz?')">
                                Qaytarish
                            </a>
                        </td>
                    </tr>
                    {% endfor %}
                </tbody>
            </table>
        </div>
    </div>
    
    <!-- Sessions & Students tabs similar structure -->
</div>
{% endblock %}
```

---

## 6️⃣ AUTO CLEANUP - 30 DAYS

### A) Management Command

**Fayl:** `core/management/commands/cleanup_deleted.py`

```python
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from tests.models import ListeningTest, ReadingTest, WritingTest
from mock.models import MockSession
from students.models import StudentProfile

class Command(BaseCommand):
    help = 'Clean up soft-deleted items older than 30 days'
    
    def handle(self, *args, **kwargs):
        # Calculate cutoff date
        cutoff_date = timezone.now() - timedelta(days=30)
        
        # Delete old archived items
        deleted_count = 0
        
        # Listening tests
        old_listening = ListeningTest.all_objects.filter(
            is_deleted=True,
            deleted_at__lt=cutoff_date
        )
        count = old_listening.count()
        old_listening.delete()
        deleted_count += count
        self.stdout.write(f'Deleted {count} listening tests')
        
        # Reading tests
        old_reading = ReadingTest.all_objects.filter(
            is_deleted=True,
            deleted_at__lt=cutoff_date
        )
        count = old_reading.count()
        old_reading.delete()
        deleted_count += count
        self.stdout.write(f'Deleted {count} reading tests')
        
        # Writing tests
        old_writing = WritingTest.all_objects.filter(
            is_deleted=True,
            deleted_at__lt=cutoff_date
        )
        count = old_writing.count()
        old_writing.delete()
        deleted_count += count
        self.stdout.write(f'Deleted {count} writing tests')
        
        # Sessions
        old_sessions = MockSession.all_objects.filter(
            is_deleted=True,
            deleted_at__lt=cutoff_date
        )
        count = old_sessions.count()
        old_sessions.delete()
        deleted_count += count
        self.stdout.write(f'Deleted {count} sessions')
        
        # Students
        old_students = StudentProfile.all_objects.filter(
            is_deleted=True,
            deleted_at__lt=cutoff_date
        )
        count = old_students.count()
        old_students.delete()
        deleted_count += count
        self.stdout.write(f'Deleted {count} students')
        
        self.stdout.write(self.style.SUCCESS(f'Total deleted: {deleted_count} items'))
```

**Run manually:**
```bash
python manage.py cleanup_deleted
```

**Run via cron (daily):**
```bash
0 3 * * * cd /path/to/project && python manage.py cleanup_deleted
```

---

## 7️⃣ TESTS LIST UPDATE - ADD DELETE BUTTON

**Fayl:** `tests/templates/tests/tests_list.html`

```html
<!-- Add delete button for each test -->
{% for test in tests %}
<tr>
    <td>{{ test.name }}</td>
    <td>...</td>
    <td class="px-6 py-4 text-right">
        <a href="{% url 'test_edit' test.id %}" class="text-blue-600 hover:underline mr-3">
            Tahrirlash
        </a>
        <a href="{% url 'test_delete' test_type test.id %}" 
           class="text-red-600 hover:text-red-700 font-semibold">
            O'chirish
        </a>
    </td>
</tr>
{% endfor %}

<!-- Bulk delete -->
<div class="p-4 bg-gray-50">
    <button onclick="bulkDelete()" 
            class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded">
        Belgilanganlarni O'chirish
    </button>
</div>
```

---

## 8️⃣ URL ROUTING

**Fayl:** `urls.py`

```python
urlpatterns = [
    # ... mavjud patterns
    
    # === DELETE & RESTORE ===
    # Tests
    path('tests/<str:test_type>/<int:test_id>/delete/', test_views.test_delete, name='test_delete'),
    path('tests/<str:test_type>/<int:test_id>/restore/', test_views.test_restore, name='test_restore'),
    path('tests/bulk-delete/', test_views.tests_bulk_delete, name='tests_bulk_delete'),
    
    # Sessions
    path('mock/session/<int:session_id>/delete/', mock_views.session_delete, name='session_delete'),
    path('mock/session/<int:session_id>/restore/', mock_views.session_restore, name='session_restore'),
    
    # Students
    path('students/<int:student_id>/delete/', student_views.student_delete, name='student_delete'),
    path('students/<int:student_id>/restore/', student_views.student_restore, name='student_restore'),
    
    # Archive
    path('archive/', core_views.archive_list, name='archive_list'),
]
```

---

## 9️⃣ SIDEBAR NAVIGATION UPDATE

**Fayl:** `admin_base.html`

```html
<!-- Add Archive link -->
<a href="{% url 'archive_list' %}" 
   class="sidebar-link flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-800 transition">
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
    </svg>
    <span>Arxiv</span>
    {% if deleted_count > 0 %}
    <span class="ml-auto bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-bold">
        {{ deleted_count }}
    </span>
    {% endif %}
</a>
```

---

## 🧪 SINOV (TESTING)

### Test Ssenariysi:

1. **Test O'chirish**
   - Tests list'ga kiring
   - Bir testning yonidagi [O'chirish] bosing
   - Confirmation page ochiladi
   - [Arxivlash] yoki [Butunlay O'chirish] tanlang
   - Double confirmation (hard delete uchun)
   - Test o'chiriladi/arxivlanadi

2. **Arxivdan Qaytarish**
   - /archive/ ga kiring
   - O'chirilgan testlarni ko'ring
   - [Qaytarish] bosing
   - Test qaytadi

3. **Bulk Delete**
   - Bir nechta testni checkbox bilan belgilang
   - [Belgilanganlarni O'chirish]
   - Barcha belgilanganlar o'chiriladi

4. **Auto Cleanup**
   - 30 kun kutish (yoki manually run)
   - `python manage.py cleanup_deleted`
   - Eski arxiv o'chiriladi

---

## ✅ ACCEPTANCE CRITERIA:

### Core Deletion:
1. ✅ Test o'chirish (soft/hard)
2. ✅ Session o'chirish (soft/hard)
3. ✅ Student o'chirish (soft/hard)
4. ✅ Double confirmation (hard delete)
5. ✅ Cascade delete (sections/questions)

### Safety:
6. ✅ Soft delete by default
7. ✅ Hard delete confirmation
8. ✅ Archive list
9. ✅ Restore functionality
10. ✅ 30-day auto cleanup

### Bulk Operations:
11. ✅ Bulk test deletion
12. ✅ Bulk session deletion
13. ✅ Checkbox selection

### Audit:
14. ✅ Track who deleted
15. ✅ Track when deleted
16. ✅ Deletion history

---

## 🎯 WORKFLOW:

### **Soft Delete (Arxivlash):**
```
1. Admin: [O'chirish] click
2. Choose: [Arxivlash] (recommended)
3. Test.is_deleted = True
4. Test.deleted_at = now
5. Test.deleted_by = admin
6. Test goes to Archive
7. 30 days → auto deleted
```

### **Hard Delete (Butunlay):**
```
1. Admin: [O'chirish] click
2. Choose: [Butunlay O'chirish] (dangerous)
3. Double confirmation required
4. Check: test not used in sessions?
5. Delete CASCADE (all sections/questions)
6. GONE FOREVER ❌
```

### **Restore:**
```
1. Admin: /archive/
2. See deleted items
3. [Qaytarish] click
4. Test.is_deleted = False
5. Test back to normal list
```

---

## 📊 DELETION POLICY:

### **Soft Delete Preferred:**
```
✅ Xavfsiz
✅ Qaytarish mumkin
✅ 30 kun grace period
✅ Audit trail
```

### **Hard Delete Only When:**
```
❌ Test ishlatilmagan
❌ Session participants yo'q
❌ Admin 100% ishonch
❌ Double confirmed
```

---

**ETAP 13 TAYYOR - XAVFSIZ DELETE SISTEMA!** 🗑️

Admin endi:
- ✅ Testlarni o'chiradi (safe/permanent)
- ✅ Sessiyalarni o'chiradi
- ✅ Statistikalarni tozalaydi
- ✅ Arxivdan qaytaradi
- ✅ Double confirmation
- ✅ Audit logs

**Implementatsiya qilaylikmi?** 😊
