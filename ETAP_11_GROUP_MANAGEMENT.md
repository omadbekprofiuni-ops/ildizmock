# ETAP 11: GURUH TIZIMI - GROUP MANAGEMENT & TRACKING

**Maqsad:** O'qituvchilar talabalarni guruhlarga birlashtiradi. Admin va o'qituvchilar har guruhning progressini real-time kuzatadi. Guruhlarni taqqoslaydi. Eng yaxshi guruhni topadi.

---

## 📋 ETAP 11 QISMLARI

### 1. Group Management
- Guruh yaratish (name, teacher, students)
- Talabalarni assign qilish
- Guruh edit/delete

### 2. Group Dashboard
- Har guruh uchun alohida dashboard
- Group statistics (avg scores, progress)
- Student list with individual scores
- Activity timeline

### 3. Group Analytics
- Admin uchun: barcha guruhlar taqqoslash
- O'qituvchi uchun: o'z guruhlari taqqoslash
- Progress charts (Chart.js)
- Top performers

### 4. Student Tracking
- Har talabaning qaysi guruhdaligi
- Individual progress report
- Attendance tracking

---

## 🔧 QILINISHI KERAK ISHLAR

---

## 1️⃣ GROUP MODEL

### A) Model Yaratish

**Fayl:** `students/models.py` (yoki `core/models.py`)

```python
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone

class StudentGroup(models.Model):
    """Talabalar guruhi"""
    
    # Basic info
    name = models.CharField(
        max_length=100,
        verbose_name='Guruh nomi',
        help_text='Misol: IELTS 7.0, Group A, Beginner 1'
    )
    
    # Relations
    library = models.ForeignKey(
        'Library',
        on_delete=models.CASCADE,
        related_name='student_groups'
    )
    
    teacher = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='teaching_groups',
        limit_choices_to={'role': 'teacher'},
        verbose_name='Mas\'ul o\'qituvchi'
    )
    
    # Description
    description = models.TextField(
        blank=True,
        verbose_name='Tavsif',
        help_text='Guruh haqida qisqacha ma\'lumot'
    )
    
    # Target
    target_band_score = models.DecimalField(
        max_digits=3,
        decimal_places=1,
        null=True,
        blank=True,
        verbose_name='Maqsad (band score)',
        help_text='Bu guruh qaysi ballga intiladi? (6.5, 7.0, 7.5...)'
    )
    
    # Schedule
    class_schedule = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Dars jadvali',
        help_text='Misol: Dushanba, Chorshanba, Juma 18:00-20:00'
    )
    
    # Dates
    start_date = models.DateField(
        null=True,
        blank=True,
        verbose_name='Boshlanish sanasi'
    )
    
    end_date = models.DateField(
        null=True,
        blank=True,
        verbose_name='Tugash sanasi'
    )
    
    # Status
    is_active = models.BooleanField(
        default=True,
        verbose_name='Aktiv'
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'student_groups'
        verbose_name = 'Talabalar Guruhi'
        verbose_name_plural = 'Talabalar Guruhlari'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.name} - {self.library.name}"
    
    def get_students_count(self):
        """Guruhda nechta talaba bor"""
        return self.students.count()
    
    def get_average_score(self):
        """Guruhning o'rtacha balli"""
        from mock.models import MockParticipant
        
        participants = MockParticipant.objects.filter(
            student_profile__group=self,
            overall_band_score__isnull=False
        )
        
        if not participants.exists():
            return None
        
        return participants.aggregate(avg=models.Avg('overall_band_score'))['avg']
    
    def get_latest_test_average(self):
        """Eng so'nggi testda o'rtacha ball"""
        from mock.models import MockSession, MockParticipant
        
        # Get latest session this group participated in
        latest_session = MockSession.objects.filter(
            library=self.library,
            participants__student_profile__group=self
        ).order_by('-date').first()
        
        if not latest_session:
            return None
        
        # Get average for this session
        participants = MockParticipant.objects.filter(
            session=latest_session,
            student_profile__group=self,
            overall_band_score__isnull=False
        )
        
        if not participants.exists():
            return None
        
        return participants.aggregate(avg=models.Avg('overall_band_score'))['avg']
    
    def get_progress_trend(self):
        """Progress trend (up/down/stable)"""
        from mock.models import MockSession, MockParticipant
        
        # Get last 2 sessions
        sessions = MockSession.objects.filter(
            library=self.library,
            participants__student_profile__group=self,
            status='completed'
        ).distinct().order_by('-date')[:2]
        
        if sessions.count() < 2:
            return 'insufficient_data'
        
        # Calculate averages
        recent = MockParticipant.objects.filter(
            session=sessions[0],
            student_profile__group=self,
            overall_band_score__isnull=False
        ).aggregate(avg=models.Avg('overall_band_score'))['avg']
        
        previous = MockParticipant.objects.filter(
            session=sessions[1],
            student_profile__group=self,
            overall_band_score__isnull=False
        ).aggregate(avg=models.Avg('overall_band_score'))['avg']
        
        if recent is None or previous is None:
            return 'insufficient_data'
        
        diff = recent - previous
        
        if diff > 0.2:
            return 'improving'
        elif diff < -0.2:
            return 'declining'
        else:
            return 'stable'
```

---

### B) StudentProfile Update

**Fayl:** `students/models.py` (existing model update)

```python
class StudentProfile(models.Model):
    # ... existing fields
    
    # YANGI: Group assignment
    group = models.ForeignKey(
        'StudentGroup',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='students',
        verbose_name='Guruh'
    )
    
    # YANGI: Enrollment date
    enrolled_at = models.DateField(
        null=True,
        blank=True,
        verbose_name='Guruhga qo\'shilgan sana'
    )
```

---

## 2️⃣ GROUP MANAGEMENT VIEWS

### A) Group List View

**Fayl:** `students/views.py`

```python
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.db.models import Count, Avg
from .models import StudentGroup, StudentProfile

@login_required
def groups_list(request):
    """Barcha guruhlar ro'yxati"""
    
    library = request.user.library
    
    # Get groups
    if request.user.role == 'teacher':
        # O'qituvchi faqat o'z guruhlarini ko'radi
        groups = StudentGroup.objects.filter(
            library=library,
            teacher=request.user
        ).annotate(
            student_count=Count('students')
        )
    else:
        # Admin barcha guruhlarni ko'radi
        groups = StudentGroup.objects.filter(
            library=library
        ).annotate(
            student_count=Count('students')
        )
    
    # Add statistics to each group
    for group in groups:
        group.avg_score = group.get_average_score()
        group.latest_avg = group.get_latest_test_average()
        group.trend = group.get_progress_trend()
    
    return render(request, 'students/groups_list.html', {
        'groups': groups,
    })


@login_required
def group_create(request):
    """Yangi guruh yaratish"""
    
    library = request.user.library
    
    if request.method == 'POST':
        name = request.POST.get('name')
        description = request.POST.get('description', '')
        teacher_id = request.POST.get('teacher')
        target_score = request.POST.get('target_band_score')
        schedule = request.POST.get('class_schedule', '')
        start_date = request.POST.get('start_date')
        
        # Create group
        group = StudentGroup.objects.create(
            library=library,
            name=name,
            description=description,
            teacher_id=teacher_id if teacher_id else None,
            target_band_score=target_score if target_score else None,
            class_schedule=schedule,
            start_date=start_date if start_date else None
        )
        
        messages.success(request, f'Guruh "{name}" yaratildi!')
        return redirect('group_detail', group_id=group.id)
    
    # Get teachers for dropdown
    teachers = User.objects.filter(
        library=library,
        role='teacher'
    )
    
    return render(request, 'students/group_create.html', {
        'teachers': teachers,
    })


@login_required
def group_detail(request, group_id):
    """Guruh batafsil ma'lumotlari"""
    
    group = get_object_or_404(
        StudentGroup,
        id=group_id,
        library=request.user.library
    )
    
    # Get students in this group
    students = StudentProfile.objects.filter(
        group=group
    ).select_related('user')
    
    # Get each student's stats
    from mock.models import MockParticipant
    
    for student in students:
        # Latest test
        latest = MockParticipant.objects.filter(
            student_profile=student,
            overall_band_score__isnull=False
        ).order_by('-session__date').first()
        
        student.latest_score = latest.overall_band_score if latest else None
        
        # Average
        avg = MockParticipant.objects.filter(
            student_profile=student,
            overall_band_score__isnull=False
        ).aggregate(avg=Avg('overall_band_score'))['avg']
        
        student.avg_score = avg
        
        # Test count
        student.test_count = MockParticipant.objects.filter(
            student_profile=student,
            overall_band_score__isnull=False
        ).count()
    
    # Group statistics
    group_avg = group.get_average_score()
    latest_avg = group.get_latest_test_average()
    trend = group.get_progress_trend()
    
    # Progress chart data (last 5 tests)
    from mock.models import MockSession
    
    sessions = MockSession.objects.filter(
        library=request.user.library,
        participants__student_profile__group=group,
        status='completed'
    ).distinct().order_by('-date')[:5]
    
    chart_data = []
    for session in reversed(sessions):
        avg = MockParticipant.objects.filter(
            session=session,
            student_profile__group=group,
            overall_band_score__isnull=False
        ).aggregate(avg=Avg('overall_band_score'))['avg']
        
        chart_data.append({
            'session': session.name,
            'date': session.date.strftime('%d %b'),
            'avg': round(avg, 1) if avg else 0
        })
    
    return render(request, 'students/group_detail.html', {
        'group': group,
        'students': students,
        'group_avg': group_avg,
        'latest_avg': latest_avg,
        'trend': trend,
        'chart_data': chart_data,
    })


@login_required
def group_add_students(request, group_id):
    """Guruhga talabalar qo'shish"""
    
    group = get_object_or_404(
        StudentGroup,
        id=group_id,
        library=request.user.library
    )
    
    if request.method == 'POST':
        student_ids = request.POST.getlist('students')
        
        # Add students to group
        from django.utils import timezone
        
        for student_id in student_ids:
            try:
                student = StudentProfile.objects.get(
                    id=student_id,
                    library=request.user.library
                )
                student.group = group
                student.enrolled_at = timezone.now().date()
                student.save()
            except StudentProfile.DoesNotExist:
                pass
        
        messages.success(request, f'{len(student_ids)} ta talaba guruhga qo\'shildi!')
        return redirect('group_detail', group_id=group.id)
    
    # Get students NOT in any group
    available_students = StudentProfile.objects.filter(
        library=request.user.library,
        group__isnull=True
    ).select_related('user')
    
    # Get students in THIS group (to show current)
    current_students = StudentProfile.objects.filter(
        group=group
    ).select_related('user')
    
    return render(request, 'students/group_add_students.html', {
        'group': group,
        'available_students': available_students,
        'current_students': current_students,
    })


@login_required
def group_remove_student(request, group_id, student_id):
    """Talabani guruhdan o'chirish"""
    
    group = get_object_or_404(
        StudentGroup,
        id=group_id,
        library=request.user.library
    )
    
    student = get_object_or_404(
        StudentProfile,
        id=student_id,
        group=group
    )
    
    student.group = None
    student.save()
    
    messages.success(request, f'{student.user.get_full_name()} guruhdan o\'chirildi!')
    return redirect('group_detail', group_id=group.id)
```

---

## 3️⃣ GROUP DASHBOARD TEMPLATE

### A) Groups List Template

**Fayl:** `students/templates/students/groups_list.html`

```html
{% extends 'admin_base.html' %}

{% block page_title %}Guruhlar{% endblock %}

{% block content %}
<div class="p-8">
    <!-- Header -->
    <div class="flex items-center justify-between mb-8">
        <h1 class="text-3xl font-bold text-gray-900">Talabalar Guruhlari</h1>
        
        {% if request.user.role == 'admin' or request.user.role == 'teacher' %}
        <a href="{% url 'group_create' %}" 
           class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition">
            + Yangi Guruh
        </a>
        {% endif %}
    </div>
    
    <!-- Groups Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {% for group in groups %}
        <div class="bg-white rounded-xl shadow-lg hover:shadow-xl transition">
            <!-- Header -->
            <div class="p-6 border-b border-gray-200">
                <div class="flex items-start justify-between">
                    <div class="flex-1">
                        <h3 class="text-xl font-bold text-gray-900 mb-1">{{ group.name }}</h3>
                        <p class="text-sm text-gray-600">
                            {% if group.teacher %}
                            O'qituvchi: {{ group.teacher.get_full_name }}
                            {% else %}
                            O'qituvchi tayinlanmagan
                            {% endif %}
                        </p>
                    </div>
                    
                    <!-- Trend Indicator -->
                    {% if group.trend == 'improving' %}
                    <div class="p-2 bg-green-100 rounded-lg">
                        <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                    </div>
                    {% elif group.trend == 'declining' %}
                    <div class="p-2 bg-red-100 rounded-lg">
                        <svg class="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6" />
                        </svg>
                    </div>
                    {% endif %}
                </div>
            </div>
            
            <!-- Stats -->
            <div class="p-6">
                <div class="grid grid-cols-2 gap-4 mb-4">
                    <!-- Student Count -->
                    <div class="text-center p-3 bg-blue-50 rounded-lg">
                        <p class="text-2xl font-bold text-blue-600">{{ group.student_count }}</p>
                        <p class="text-xs text-gray-600">Talabalar</p>
                    </div>
                    
                    <!-- Average Score -->
                    <div class="text-center p-3 bg-green-50 rounded-lg">
                        {% if group.avg_score %}
                        <p class="text-2xl font-bold text-green-600">{{ group.avg_score|floatformat:1 }}</p>
                        <p class="text-xs text-gray-600">O'rtacha Ball</p>
                        {% else %}
                        <p class="text-2xl font-bold text-gray-400">-</p>
                        <p class="text-xs text-gray-600">Hali test yo'q</p>
                        {% endif %}
                    </div>
                </div>
                
                <!-- Latest Test -->
                {% if group.latest_avg %}
                <div class="text-center p-3 bg-gray-50 rounded-lg mb-4">
                    <p class="text-sm text-gray-600 mb-1">So'nggi test:</p>
                    <p class="text-xl font-bold text-gray-900">{{ group.latest_avg|floatformat:1 }}</p>
                </div>
                {% endif %}
                
                <!-- Target -->
                {% if group.target_band_score %}
                <div class="flex items-center justify-center gap-2 mb-4">
                    <span class="text-sm text-gray-600">Maqsad:</span>
                    <span class="font-bold text-orange-600">{{ group.target_band_score }}</span>
                </div>
                {% endif %}
                
                <!-- Actions -->
                <a href="{% url 'group_detail' group.id %}" 
                   class="block w-full text-center bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg font-semibold transition">
                    Batafsil →
                </a>
            </div>
        </div>
        {% empty %}
        <div class="col-span-3 text-center py-12">
            <p class="text-gray-500 mb-4">Hali guruh yo'q</p>
            <a href="{% url 'group_create' %}" 
               class="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold">
                Birinchi Guruhni Yaratish
            </a>
        </div>
        {% endfor %}
    </div>
</div>
{% endblock %}
```

---

### B) Group Detail Template

**Fayl:** `students/templates/students/group_detail.html`

```html
{% extends 'admin_base.html' %}

{% block page_title %}{{ group.name }}{% endblock %}

{% block content %}
<div class="p-8">
    <!-- Breadcrumb -->
    <div class="mb-6">
        <a href="{% url 'groups_list' %}" class="text-blue-600 hover:underline">← Guruhlar</a>
    </div>
    
    <!-- Group Header -->
    <div class="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl shadow-lg p-8 mb-8 text-white">
        <div class="flex items-start justify-between">
            <div>
                <h1 class="text-3xl font-bold mb-2">{{ group.name }}</h1>
                <p class="text-blue-100">
                    {% if group.teacher %}
                    O'qituvchi: {{ group.teacher.get_full_name }}
                    {% else %}
                    O'qituvchi tayinlanmagan
                    {% endif %}
                </p>
                {% if group.description %}
                <p class="text-sm text-blue-100 mt-2">{{ group.description }}</p>
                {% endif %}
            </div>
            
            <div class="text-right">
                {% if group.target_band_score %}
                <p class="text-sm text-blue-100">Maqsad</p>
                <p class="text-4xl font-bold">{{ group.target_band_score }}</p>
                {% endif %}
            </div>
        </div>
    </div>
    
    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div class="bg-white rounded-xl shadow p-6">
            <p class="text-sm text-gray-500 mb-1">Talabalar</p>
            <p class="text-3xl font-bold text-blue-600">{{ students.count }}</p>
        </div>
        
        <div class="bg-white rounded-xl shadow p-6">
            <p class="text-sm text-gray-500 mb-1">O'rtacha Ball</p>
            {% if group_avg %}
            <p class="text-3xl font-bold text-green-600">{{ group_avg|floatformat:1 }}</p>
            {% else %}
            <p class="text-3xl font-bold text-gray-400">-</p>
            {% endif %}
        </div>
        
        <div class="bg-white rounded-xl shadow p-6">
            <p class="text-sm text-gray-500 mb-1">So'nggi Test</p>
            {% if latest_avg %}
            <p class="text-3xl font-bold text-purple-600">{{ latest_avg|floatformat:1 }}</p>
            {% else %}
            <p class="text-3xl font-bold text-gray-400">-</p>
            {% endif %}
        </div>
        
        <div class="bg-white rounded-xl shadow p-6">
            <p class="text-sm text-gray-500 mb-1">Trend</p>
            {% if trend == 'improving' %}
            <p class="text-2xl font-bold text-green-600">📈 Yaxshilanmoqda</p>
            {% elif trend == 'declining' %}
            <p class="text-2xl font-bold text-red-600">📉 Pasaymoqda</p>
            {% elif trend == 'stable' %}
            <p class="text-2xl font-bold text-gray-600">➡️ Barqaror</p>
            {% else %}
            <p class="text-2xl font-bold text-gray-400">-</p>
            {% endif %}
        </div>
    </div>
    
    <!-- Progress Chart -->
    {% if chart_data %}
    <div class="bg-white rounded-xl shadow-lg p-6 mb-8">
        <h2 class="text-xl font-bold text-gray-900 mb-4">Progress Chart</h2>
        <canvas id="progressChart" height="80"></canvas>
    </div>
    {% endif %}
    
    <!-- Students Table -->
    <div class="bg-white rounded-xl shadow-lg overflow-hidden">
        <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 class="text-xl font-bold text-gray-900">Talabalar</h2>
            
            <a href="{% url 'group_add_students' group.id %}" 
               class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold transition">
                + Talaba Qo'shish
            </a>
        </div>
        
        <div class="overflow-x-auto">
            <table class="w-full">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ism</th>
                        <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Testlar Soni</th>
                        <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">O'rtacha</th>
                        <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">So'nggi Ball</th>
                        <th class="px-6 py-3"></th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                    {% for student in students %}
                    <tr class="hover:bg-gray-50">
                        <td class="px-6 py-4">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                    <span class="text-blue-600 font-bold">{{ student.user.first_name|first|upper }}</span>
                                </div>
                                <div>
                                    <p class="font-semibold text-gray-900">{{ student.user.get_full_name }}</p>
                                    <p class="text-sm text-gray-500">{{ student.user.email }}</p>
                                </div>
                            </div>
                        </td>
                        <td class="px-6 py-4 text-center">
                            <span class="text-lg font-semibold">{{ student.test_count }}</span>
                        </td>
                        <td class="px-6 py-4 text-center">
                            {% if student.avg_score %}
                            <span class="text-lg font-bold text-green-600">{{ student.avg_score|floatformat:1 }}</span>
                            {% else %}
                            <span class="text-gray-400">-</span>
                            {% endif %}
                        </td>
                        <td class="px-6 py-4 text-center">
                            {% if student.latest_score %}
                            <span class="text-lg font-bold text-purple-600">{{ student.latest_score|floatformat:1 }}</span>
                            {% else %}
                            <span class="text-gray-400">-</span>
                            {% endif %}
                        </td>
                        <td class="px-6 py-4 text-right">
                            <a href="{% url 'group_remove_student' group.id student.id %}" 
                               class="text-red-600 hover:text-red-700 text-sm"
                               onclick="return confirm('Bu talabani guruhdan o\'chirmoqchimisiz?')">
                                O'chirish
                            </a>
                        </td>
                    </tr>
                    {% empty %}
                    <tr>
                        <td colspan="5" class="px-6 py-12 text-center text-gray-500">
                            Guruhda talaba yo'q
                        </td>
                    </tr>
                    {% endfor %}
                </tbody>
            </table>
        </div>
    </div>
</div>

<!-- Chart.js -->
{% if chart_data %}
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<script>
const ctx = document.getElementById('progressChart').getContext('2d');
new Chart(ctx, {
    type: 'line',
    data: {
        labels: [{% for item in chart_data %}'{{ item.date }}',{% endfor %}],
        datasets: [{
            label: 'O\'rtacha Ball',
            data: [{% for item in chart_data %}{{ item.avg }},{% endfor %}],
            borderColor: 'rgb(59, 130, 246)',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            tension: 0.4,
            fill: true,
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: {
                beginAtZero: false,
                min: 0,
                max: 9,
                ticks: { stepSize: 1 }
            }
        },
        plugins: {
            legend: {
                display: false
            }
        }
    }
});
</script>
{% endif %}
{% endblock %}
```

---

## 4️⃣ GROUP COMPARISON (ADMIN ANALYTICS)

### A) View

**Fayl:** `students/views.py`

```python
@login_required
def groups_comparison(request):
    """Barcha guruhlarni taqqoslash - Admin uchun"""
    
    library = request.user.library
    
    groups = StudentGroup.objects.filter(
        library=library,
        is_active=True
    ).annotate(
        student_count=Count('students')
    )
    
    # Get stats for each group
    comparison_data = []
    
    for group in groups:
        avg_score = group.get_average_score()
        latest_avg = group.get_latest_test_average()
        
        comparison_data.append({
            'name': group.name,
            'teacher': group.teacher.get_full_name() if group.teacher else 'No teacher',
            'student_count': group.student_count,
            'avg_score': round(avg_score, 1) if avg_score else 0,
            'latest_avg': round(latest_avg, 1) if latest_avg else 0,
            'target': group.target_band_score,
        })
    
    # Sort by average score
    comparison_data.sort(key=lambda x: x['avg_score'], reverse=True)
    
    return render(request, 'students/groups_comparison.html', {
        'comparison_data': comparison_data,
    })
```

---

## 5️⃣ URL ROUTING

**Fayl:** `urls.py`

```python
from students import views as student_views

urlpatterns = [
    # ... mavjud patterns
    
    # Groups
    path('groups/', student_views.groups_list, name='groups_list'),
    path('groups/create/', student_views.group_create, name='group_create'),
    path('groups/<int:group_id>/', student_views.group_detail, name='group_detail'),
    path('groups/<int:group_id>/add-students/', student_views.group_add_students, name='group_add_students'),
    path('groups/<int:group_id>/remove/<int:student_id>/', student_views.group_remove_student, name='group_remove_student'),
    
    # Group Analytics
    path('groups/comparison/', student_views.groups_comparison, name='groups_comparison'),
]
```

---

## 6️⃣ SIDEBAR NAVIGATION UPDATE

**Fayl:** `admin_base.html`

```html
<!-- Analytics Section -->
<div class="pt-4 pb-2">
    <p class="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Monitoring</p>
</div>

<a href="{% url 'groups_list' %}" 
   class="sidebar-link flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-800 transition">
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
    <span>Guruhlar</span>
</a>

{% if request.user.role == 'admin' %}
<a href="{% url 'groups_comparison' %}" 
   class="sidebar-link flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-800 transition">
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
    <span>Guruhlar Taqqoslash</span>
</a>
{% endif %}
```

---

## 🧪 SINOV (TESTING)

### Test Ssenariysi:

1. **Guruh Yaratish**
   - `/groups/create/` ga kiring
   - Name: "IELTS 7.0"
   - Teacher: O'qituvchi tanlang
   - Target: 7.0
   - Save

2. **Talabalar Qo'shish**
   - Guruh detail sahifasida
   - [+ Talaba Qo'shish] click
   - 5-10 ta talabani select qiling
   - Save

3. **Guruh Dashboard**
   - Guruh detail'ga kiring
   - Stats ko'rinadi
   - Progress chart render bo'ladi
   - Talabalar table to'liq

4. **Guruhlar Taqqoslash**
   - Admin: `/groups/comparison/`
   - Barcha guruhlar bir joyda
   - Eng yaxshi guruh birinchi

---

## ✅ ACCEPTANCE CRITERIA:

### Guruh Management:
1. ✅ Guruh yaratish
2. ✅ Talabalarni assign qilish
3. ✅ O'qituvchi assign qilish
4. ✅ Guruhdan o'chirish

### Monitoring:
5. ✅ Guruh dashboard - real stats
6. ✅ Progress chart - last 5 tests
7. ✅ Student list - individual scores
8. ✅ Trend indicator (up/down/stable)

### Analytics:
9. ✅ Groups comparison page
10. ✅ Best performing group
11. ✅ Target vs actual tracking
12. ✅ Admin global view

---

## 🎯 GURUH TIZIMI WORKFLOW:

```
Admin/Teacher:
1. Create Group → "IELTS 7.0"
2. Assign Teacher
3. Add 10 Students
4. Set Target: 7.0

Students:
- Take Mock Tests
- Scores automatically tracked

System:
- Calculates group average
- Tracks progress over time
- Shows trend (improving/declining)

Admin View:
- All groups comparison
- Best performing group
- Target achievement %
```

---

**GURUH TIZIMI TAYYOR!** 👥📊

O'qituvchilar va Admin endi:
- ✅ Guruhlarni boshqaradi
- ✅ Progressni kuzatadi
- ✅ Guruhlarni taqqoslaydi
- ✅ Best performers topadi

**Implementatsiya qilaylikmi?** 😊
