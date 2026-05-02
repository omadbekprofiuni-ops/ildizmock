# ETAP 15: DAVOMAT TIZIMI - ATTENDANCE SYSTEM

**Maqsad:** Professional davomat tizimi - o'qituvchilar talabalarning davomatini ism-familiya bo'yicha, dars kunlari bo'yicha qayd qiladi. Avtomatik jadval, analytics, reports.

---

## 🎯 YECHIM VARIANTLARI TAHLILI

Men 4 ta variant ko'rib chiqdim va eng yaxshisini tanladim:

---

### ❌ Variant 1: Simple Boolean (Oddiy)
```python
AttendanceRecord:
- student
- date
- is_present (boolean)
- marked_by (teacher)
```

**Pros:**
- Juda oddiy
- Tez implement
- Tushunarli

**Cons:**
- Faqat keldi/kelmadi ❌
- Late, excused, sick yo'q ❌
- Reports past ❌
- Schedule tracking yo'q ❌

**Verdict: ❌ Professional emas**

---

### ❌ Variant 2: Status-based (O'rtacha)
```python
AttendanceRecord:
- student
- date
- status (present/absent/late/excused/sick)
- marked_by
- notes
```

**Pros:**
- Detailed status ✓
- Notes ✓
- Flexible ✓

**Cons:**
- Schedule management yo'q ❌
- Auto-generation yo'q ❌
- Dars jadvali tracking yo'q ❌

**Verdict: ❌ Yetarli emas**

---

### ❌ Variant 3: Mock Session Integration (Cheklangan)
```python
MockSession bilan integratsiya
Auto-mark "present" when student joins
```

**Pros:**
- Mock bilan integration ✓
- Auto-tracking ✓

**Cons:**
- Faqat mock sessions uchun ❌
- Regular class attendance yo'q ❌
- Daily classes tracking yo'q ❌

**Verdict: ❌ Scope cheklangan**

---

### ✅ Variant 4: SCHEDULE-BASED (PROFESSIONAL) ⭐ RECOMMENDED

```python
ClassSchedule:
- group
- day_of_week (Mon-Sun)
- start_time
- end_time
- is_active

AttendanceSession:
- group
- date
- schedule (optional)
- created_by (teacher)
- is_finalized

AttendanceRecord:
- session
- student
- status (present/absent/late/excused/sick)
- marked_at
- marked_by
- notes
```

**Pros:**
- ✅ Weekly schedule management
- ✅ Auto-generate sessions
- ✅ Multiple statuses
- ✅ Professional reports
- ✅ Analytics powerful
- ✅ Calendar view
- ✅ Group bilan integratsiya (ETAP 11)
- ✅ Scalable

**Cons:**
- More setup (lekin worth it!)

**Verdict: ✅ ENG PROFESSIONAL YECHIM**

---

## 🎯 TANLANGAN YECHIM: SCHEDULE-BASED

### Nima uchun bu eng yaxshi?

1. **Real o'quv markazlar shunday ishlaydi:**
   ```
   IELTS 7.0 Group:
   - Dushanba, Chorshanba, Juma
   - 18:00 - 20:00
   - Ustoz: Javohir
   ```

2. **Avtomatik session yaratish:**
   ```
   Schedule yaratilsa → Har hafta avtomatik
   O'qituvchi faqat "present/absent" bosadi
   ```

3. **Powerful analytics:**
   ```
   - Kimning attendance rate past?
   - Qaysi kunlarda ko'p kelmaydi?
   - Group average necha %?
   - Trend analysis
   ```

4. **ETAP 11 (Groups) bilan perfect fit:**
   ```
   Group → Schedule → Sessions → Attendance
   ```

---

## 📋 SYSTEM ARCHITECTURE

### Database Models (3 ta asosiy):

```
┌─────────────────────────────────────────────┐
│  ClassSchedule (Dars jadvali)               │
├─────────────────────────────────────────────┤
│  - group (FK to StudentGroup)               │
│  - day_of_week (0=Mon, 6=Sun)               │
│  - start_time (14:00)                       │
│  - end_time (16:00)                         │
│  - room (optional)                          │
│  - is_active                                │
└─────────────────────────────────────────────┘
           │
           │ Generates
           ▼
┌─────────────────────────────────────────────┐
│  AttendanceSession (Konkret dars)           │
├─────────────────────────────────────────────┤
│  - group (FK)                               │
│  - date (2026-05-03)                        │
│  - schedule (FK, optional)                  │
│  - created_by (teacher)                     │
│  - is_finalized (locked)                    │
│  - notes                                    │
└─────────────────────────────────────────────┘
           │
           │ Has many
           ▼
┌─────────────────────────────────────────────┐
│  AttendanceRecord (Talaba davomati)         │
├─────────────────────────────────────────────┤
│  - session (FK)                             │
│  - student (FK to StudentProfile)           │
│  - status (present/absent/late/excused)     │
│  - marked_at                                │
│  - marked_by (teacher)                      │
│  - notes                                    │
└─────────────────────────────────────────────┘
```

---

## 🔧 STEP-BY-STEP IMPLEMENTATION

---

## STEP 1: Models yaratish

### A) ClassSchedule Model

**Fayl:** `backend/apps/students/models.py` (yoki yangi `apps/attendance/models.py`)

```python
from django.db import models
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator, MaxValueValidator

class ClassSchedule(models.Model):
    """
    Weekly class schedule for a group
    Example: IELTS 7.0 - Dushanba/Chorshanba/Juma 18:00-20:00
    """
    
    DAYS_OF_WEEK = [
        (0, 'Dushanba'),
        (1, 'Seshanba'),
        (2, 'Chorshanba'),
        (3, 'Payshanba'),
        (4, 'Juma'),
        (5, 'Shanba'),
        (6, 'Yakshanba'),
    ]
    
    # Relations
    group = models.ForeignKey(
        'StudentGroup',
        on_delete=models.CASCADE,
        related_name='schedules',
        verbose_name='Guruh'
    )
    
    # Schedule details
    day_of_week = models.IntegerField(
        choices=DAYS_OF_WEEK,
        verbose_name='Hafta kuni'
    )
    
    start_time = models.TimeField(
        verbose_name='Boshlanish vaqti',
        help_text='Format: 14:00'
    )
    
    end_time = models.TimeField(
        verbose_name='Tugash vaqti',
        help_text='Format: 16:00'
    )
    
    # Optional
    room = models.CharField(
        max_length=50,
        blank=True,
        verbose_name='Xona',
        help_text='Misol: Room 301, Online'
    )
    
    # Status
    is_active = models.BooleanField(
        default=True,
        verbose_name='Aktiv'
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_schedules'
    )
    
    class Meta:
        db_table = 'class_schedules'
        verbose_name = 'Dars Jadvali'
        verbose_name_plural = 'Dars Jadvallari'
        ordering = ['day_of_week', 'start_time']
        unique_together = ['group', 'day_of_week', 'start_time']
    
    def __str__(self):
        day_name = dict(self.DAYS_OF_WEEK)[self.day_of_week]
        return (
            f"{self.group.name} - {day_name} "
            f"{self.start_time.strftime('%H:%M')}-{self.end_time.strftime('%H:%M')}"
        )
    
    def get_duration_minutes(self):
        """Calculate duration in minutes"""
        from datetime import datetime
        start = datetime.combine(datetime.today(), self.start_time)
        end = datetime.combine(datetime.today(), self.end_time)
        duration = (end - start).total_seconds() / 60
        return int(duration)


class AttendanceSession(models.Model):
    """
    Konkret dars sessiyasi (actual class on a specific date)
    Example: IELTS 7.0 - 2026-05-05 (Dushanba)
    """
    
    # Relations
    group = models.ForeignKey(
        'StudentGroup',
        on_delete=models.CASCADE,
        related_name='attendance_sessions',
        verbose_name='Guruh'
    )
    
    schedule = models.ForeignKey(
        'ClassSchedule',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sessions',
        verbose_name='Jadval',
        help_text='Qaysi jadvaldан yaratilgan (optional)'
    )
    
    # Date & time
    date = models.DateField(
        verbose_name='Sana',
        db_index=True
    )
    
    start_time = models.TimeField(
        null=True,
        blank=True,
        verbose_name='Boshlanish vaqti'
    )
    
    end_time = models.TimeField(
        null=True,
        blank=True,
        verbose_name='Tugash vaqti'
    )
    
    # Status
    is_finalized = models.BooleanField(
        default=False,
        verbose_name='Yakunlangan',
        help_text='Yakunlangandan keyin o\'zgartirish mumkin emas'
    )
    
    # Notes
    notes = models.TextField(
        blank=True,
        verbose_name='Izohlar',
        help_text='Dars haqida qo\'shimcha ma\'lumot'
    )
    
    # Tracking
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_sessions'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'attendance_sessions'
        verbose_name = 'Dars Sessiyasi'
        verbose_name_plural = 'Dars Sessiyalari'
        ordering = ['-date', '-start_time']
        unique_together = ['group', 'date']
    
    def __str__(self):
        return f"{self.group.name} - {self.date.strftime('%d.%m.%Y')}"
    
    def get_attendance_rate(self):
        """Calculate attendance percentage"""
        total = self.attendance_records.count()
        if total == 0:
            return 0
        
        present = self.attendance_records.filter(
            status__in=['present', 'late']
        ).count()
        
        return round((present / total) * 100, 1)
    
    def get_present_count(self):
        """Count present students"""
        return self.attendance_records.filter(status='present').count()
    
    def get_absent_count(self):
        """Count absent students"""
        return self.attendance_records.filter(status='absent').count()


class AttendanceRecord(models.Model):
    """
    Individual student attendance record
    """
    
    STATUS_CHOICES = [
        ('present', 'Keldi'),
        ('absent', 'Kelmadi'),
        ('late', 'Kechikdi'),
        ('excused', 'Sababli'),
        ('sick', 'Kasal'),
    ]
    
    # Relations
    session = models.ForeignKey(
        'AttendanceSession',
        on_delete=models.CASCADE,
        related_name='attendance_records',
        verbose_name='Sessiya'
    )
    
    student = models.ForeignKey(
        'StudentProfile',
        on_delete=models.CASCADE,
        related_name='attendance_records',
        verbose_name='Talaba'
    )
    
    # Status
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='present',
        verbose_name='Holat'
    )
    
    # Notes
    notes = models.TextField(
        blank=True,
        verbose_name='Izoh',
        help_text='Kechikish sababi, kasal sababi, etc.'
    )
    
    # Tracking
    marked_at = models.DateTimeField(
        auto_now=True,
        verbose_name='Belgilangan vaqt'
    )
    
    marked_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='marked_attendances'
    )
    
    class Meta:
        db_table = 'attendance_records'
        verbose_name = 'Davomat Yozuvi'
        verbose_name_plural = 'Davomat Yozuvlari'
        ordering = ['student__user__first_name']
        unique_together = ['session', 'student']
    
    def __str__(self):
        return (
            f"{self.student.user.get_full_name()} - "
            f"{self.session.date.strftime('%d.%m.%Y')} - "
            f"{self.get_status_display()}"
        )
```

---

## STEP 2: Migration

```bash
# Create migrations
python manage.py makemigrations

# Apply migrations
python manage.py migrate
```

---

## STEP 3: Admin Views

### A) Schedule Management View

**Fayl:** `backend/apps/students/views.py`

```python
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from .models import StudentGroup, ClassSchedule

@login_required
def schedule_create(request, group_id):
    """Create class schedule for group"""
    
    group = get_object_or_404(
        StudentGroup,
        id=group_id,
        library=request.user.library
    )
    
    if request.method == 'POST':
        day_of_week = request.POST.get('day_of_week')
        start_time = request.POST.get('start_time')
        end_time = request.POST.get('end_time')
        room = request.POST.get('room', '')
        
        # Create schedule
        schedule = ClassSchedule.objects.create(
            group=group,
            day_of_week=day_of_week,
            start_time=start_time,
            end_time=end_time,
            room=room,
            created_by=request.user
        )
        
        messages.success(request, 'Jadval muvaffaqiyatli yaratildi!')
        return redirect('group_detail', group_id=group.id)
    
    return render(request, 'students/schedule_create.html', {
        'group': group,
    })


@login_required
def schedule_delete(request, schedule_id):
    """Delete schedule"""
    
    schedule = get_object_or_404(
        ClassSchedule,
        id=schedule_id,
        group__library=request.user.library
    )
    
    group_id = schedule.group.id
    schedule.delete()
    
    messages.success(request, 'Jadval o\'chirildi!')
    return redirect('group_detail', group_id=group_id)
```

### B) Attendance Session Views

```python
from django.utils import timezone
from datetime import datetime, timedelta

@login_required
def attendance_sessions_list(request):
    """List all attendance sessions - today + upcoming"""
    
    library = request.user.library
    today = timezone.now().date()
    
    # Get sessions
    if request.user.role == 'teacher':
        # Teacher sees own groups
        sessions = AttendanceSession.objects.filter(
            group__teacher=request.user,
            date__gte=today
        ).order_by('date', 'start_time')
    else:
        # Admin sees all
        sessions = AttendanceSession.objects.filter(
            group__library=library,
            date__gte=today
        ).order_by('date', 'start_time')
    
    # Today's sessions
    today_sessions = sessions.filter(date=today)
    
    # Upcoming sessions
    upcoming_sessions = sessions.filter(date__gt=today)[:10]
    
    return render(request, 'students/attendance_sessions_list.html', {
        'today_sessions': today_sessions,
        'upcoming_sessions': upcoming_sessions,
    })


@login_required
def attendance_session_create(request):
    """Create attendance session"""
    
    library = request.user.library
    
    if request.method == 'POST':
        group_id = request.POST.get('group')
        date = request.POST.get('date')
        start_time = request.POST.get('start_time')
        end_time = request.POST.get('end_time')
        notes = request.POST.get('notes', '')
        
        group = get_object_or_404(StudentGroup, id=group_id, library=library)
        
        # Create session
        session = AttendanceSession.objects.create(
            group=group,
            date=date,
            start_time=start_time if start_time else None,
            end_time=end_time if end_time else None,
            notes=notes,
            created_by=request.user
        )
        
        # Auto-create attendance records for all students
        for student in group.students.all():
            AttendanceRecord.objects.create(
                session=session,
                student=student,
                status='present',  # Default present
                marked_by=request.user
            )
        
        messages.success(request, 'Sessiya yaratildi!')
        return redirect('attendance_session_detail', session_id=session.id)
    
    # Get groups
    if request.user.role == 'teacher':
        groups = StudentGroup.objects.filter(
            library=library,
            teacher=request.user
        )
    else:
        groups = StudentGroup.objects.filter(library=library)
    
    return render(request, 'students/attendance_session_create.html', {
        'groups': groups,
    })


@login_required
def attendance_session_detail(request, session_id):
    """Session detail with quick attendance marking"""
    
    session = get_object_or_404(
        AttendanceSession,
        id=session_id,
        group__library=request.user.library
    )
    
    # Get attendance records
    records = session.attendance_records.select_related(
        'student__user'
    ).order_by('student__user__first_name')
    
    # Statistics
    stats = {
        'total': records.count(),
        'present': records.filter(status='present').count(),
        'absent': records.filter(status='absent').count(),
        'late': records.filter(status='late').count(),
        'excused': records.filter(status='excused').count(),
        'sick': records.filter(status='sick').count(),
        'rate': session.get_attendance_rate(),
    }
    
    return render(request, 'students/attendance_session_detail.html', {
        'session': session,
        'records': records,
        'stats': stats,
    })


@login_required
def attendance_mark(request, record_id):
    """Quick mark attendance"""
    
    if request.method == 'POST':
        record = get_object_or_404(
            AttendanceRecord,
            id=record_id,
            session__group__library=request.user.library
        )
        
        # Check if session is finalized
        if record.session.is_finalized:
            return JsonResponse({
                'error': 'Session yakunlangan, o\'zgartirib bo\'lmaydi'
            }, status=400)
        
        status = request.POST.get('status')
        notes = request.POST.get('notes', '')
        
        record.status = status
        record.notes = notes
        record.marked_by = request.user
        record.save()
        
        return JsonResponse({
            'success': True,
            'status': record.get_status_display()
        })
    
    return JsonResponse({'error': 'Invalid request'}, status=400)


@login_required
def attendance_session_finalize(request, session_id):
    """Finalize session - lock it"""
    
    session = get_object_or_404(
        AttendanceSession,
        id=session_id,
        group__library=request.user.library
    )
    
    session.is_finalized = True
    session.save()
    
    messages.success(request, 'Sessiya yakunlandi!')
    return redirect('attendance_session_detail', session_id=session.id)
```

---

## STEP 4: Auto-generate Sessions (Helper Functions)

```python
from datetime import timedelta

def generate_sessions_from_schedule(group, start_date, end_date):
    """
    Auto-generate sessions from group's schedule
    Example: Generate sessions for next month
    """
    
    # Get active schedules
    schedules = group.schedules.filter(is_active=True)
    
    if not schedules.exists():
        return 0
    
    created_count = 0
    current_date = start_date
    
    while current_date <= end_date:
        day_of_week = current_date.weekday()  # 0 = Monday
        
        # Check if there's a schedule for this day
        day_schedules = schedules.filter(day_of_week=day_of_week)
        
        for schedule in day_schedules:
            # Check if session already exists
            if not AttendanceSession.objects.filter(
                group=group,
                date=current_date
            ).exists():
                # Create session
                AttendanceSession.objects.create(
                    group=group,
                    schedule=schedule,
                    date=current_date,
                    start_time=schedule.start_time,
                    end_time=schedule.end_time,
                    created_by=None  # Auto-generated
                )
                created_count += 1
        
        current_date += timedelta(days=1)
    
    return created_count


# Management command for auto-generation
# File: backend/apps/students/management/commands/generate_sessions.py

from django.core.management.base import BaseCommand
from apps.students.models import StudentGroup
from datetime import datetime, timedelta

class Command(BaseCommand):
    help = 'Auto-generate attendance sessions from schedules'
    
    def handle(self, *args, **kwargs):
        today = datetime.now().date()
        next_month = today + timedelta(days=30)
        
        total_created = 0
        
        for group in StudentGroup.objects.filter(is_active=True):
            count = generate_sessions_from_schedule(
                group,
                today,
                next_month
            )
            total_created += count
            
            if count > 0:
                self.stdout.write(
                    f'Created {count} sessions for {group.name}'
                )
        
        self.stdout.write(
            self.style.SUCCESS(
                f'Total: {total_created} sessions created'
            )
        )
```

**Run manually:**
```bash
python manage.py generate_sessions
```

**Run via cron (weekly):**
```bash
0 0 * * 0 cd /path/to/project && python manage.py generate_sessions
```

---

## STEP 5: Templates

### A) Session Detail Template (Quick Marking)

**Fayl:** `students/templates/students/attendance_session_detail.html`

```html
{% extends 'admin_base.html' %}

{% block page_title %}Davomat - {{ session.date|date:"d M Y" }}{% endblock %}

{% block content %}
<div class="p-8">
    <!-- Header -->
    <div class="bg-white rounded-xl shadow-lg p-6 mb-6">
        <div class="flex items-center justify-between mb-4">
            <div>
                <h1 class="text-2xl font-bold text-gray-900">{{ session.group.name }}</h1>
                <p class="text-gray-600">
                    {{ session.date|date:"d M Y (l)" }}
                    {% if session.start_time %}
                    • {{ session.start_time|time:"H:i" }} - {{ session.end_time|time:"H:i" }}
                    {% endif %}
                </p>
            </div>
            
            {% if not session.is_finalized %}
            <a href="{% url 'attendance_session_finalize' session.id %}"
               class="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold"
               onclick="return confirm('Sessiyani yakunlaysizmi? Keyin o\'zgartirib bo\'lmaydi!')">
                ✓ Yakunlash
            </a>
            {% else %}
            <span class="bg-green-100 text-green-700 px-4 py-2 rounded-lg font-semibold">
                ✓ Yakunlangan
            </span>
            {% endif %}
        </div>
        
        <!-- Stats -->
        <div class="grid grid-cols-5 gap-4">
            <div class="text-center p-3 bg-blue-50 rounded-lg">
                <p class="text-2xl font-bold text-blue-600">{{ stats.total }}</p>
                <p class="text-xs text-gray-600">Jami</p>
            </div>
            
            <div class="text-center p-3 bg-green-50 rounded-lg">
                <p class="text-2xl font-bold text-green-600">{{ stats.present }}</p>
                <p class="text-xs text-gray-600">Keldi</p>
            </div>
            
            <div class="text-center p-3 bg-red-50 rounded-lg">
                <p class="text-2xl font-bold text-red-600">{{ stats.absent }}</p>
                <p class="text-xs text-gray-600">Kelmadi</p>
            </div>
            
            <div class="text-center p-3 bg-yellow-50 rounded-lg">
                <p class="text-2xl font-bold text-yellow-600">{{ stats.late }}</p>
                <p class="text-xs text-gray-600">Kechikdi</p>
            </div>
            
            <div class="text-center p-3 bg-purple-50 rounded-lg">
                <p class="text-2xl font-bold text-purple-600">{{ stats.rate }}%</p>
                <p class="text-xs text-gray-600">Davomat</p>
            </div>
        </div>
    </div>
    
    <!-- Quick Marking Table -->
    <div class="bg-white rounded-xl shadow-lg overflow-hidden">
        <table class="w-full">
            <thead class="bg-gray-50">
                <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ism Familiya</th>
                    <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Tezkor Belgilash</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Izoh</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
                {% for record in records %}
                <tr class="hover:bg-gray-50" data-record-id="{{ record.id }}">
                    <td class="px-6 py-4 text-sm">{{ forloop.counter }}</td>
                    
                    <td class="px-6 py-4">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                <span class="text-blue-600 font-bold">
                                    {{ record.student.user.first_name|first|upper }}
                                </span>
                            </div>
                            <div>
                                <p class="font-semibold text-gray-900">
                                    {{ record.student.user.get_full_name }}
                                </p>
                            </div>
                        </div>
                    </td>
                    
                    <td class="px-6 py-4">
                        {% if not session.is_finalized %}
                        <!-- Quick buttons -->
                        <div class="flex items-center justify-center gap-2">
                            <button onclick="markAttendance({{ record.id }}, 'present')"
                                    class="quick-btn {% if record.status == 'present' %}bg-green-600 text-white{% else %}bg-gray-100 text-gray-600{% endif %} px-4 py-2 rounded-lg font-semibold hover:bg-green-700 hover:text-white transition">
                                ✓
                            </button>
                            
                            <button onclick="markAttendance({{ record.id }}, 'absent')"
                                    class="quick-btn {% if record.status == 'absent' %}bg-red-600 text-white{% else %}bg-gray-100 text-gray-600{% endif %} px-4 py-2 rounded-lg font-semibold hover:bg-red-700 hover:text-white transition">
                                ✗
                            </button>
                            
                            <button onclick="markAttendance({{ record.id }}, 'late')"
                                    class="quick-btn {% if record.status == 'late' %}bg-yellow-600 text-white{% else %}bg-gray-100 text-gray-600{% endif %} px-3 py-2 rounded-lg text-sm font-semibold hover:bg-yellow-700 hover:text-white transition">
                                Kech
                            </button>
                            
                            <button onclick="markAttendance({{ record.id }}, 'excused')"
                                    class="quick-btn {% if record.status == 'excused' %}bg-purple-600 text-white{% else %}bg-gray-100 text-gray-600{% endif %} px-3 py-2 rounded-lg text-sm font-semibold hover:bg-purple-700 hover:text-white transition">
                                Sab
                            </button>
                        </div>
                        {% else %}
                        <!-- Finalized - show only -->
                        <span class="inline-block px-4 py-2 rounded-lg font-semibold
                                     {% if record.status == 'present' %}bg-green-100 text-green-700
                                     {% elif record.status == 'absent' %}bg-red-100 text-red-700
                                     {% elif record.status == 'late' %}bg-yellow-100 text-yellow-700
                                     {% elif record.status == 'excused' %}bg-purple-100 text-purple-700
                                     {% elif record.status == 'sick' %}bg-orange-100 text-orange-700
                                     {% endif %}">
                            {{ record.get_status_display }}
                        </span>
                        {% endif %}
                    </td>
                    
                    <td class="px-6 py-4">
                        {% if record.notes %}
                        <p class="text-sm text-gray-600">{{ record.notes }}</p>
                        {% endif %}
                    </td>
                </tr>
                {% endfor %}
            </tbody>
        </table>
    </div>
</div>

<script>
function markAttendance(recordId, status) {
    fetch(`/api/attendance/mark/${recordId}/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-CSRFToken': getCookie('csrftoken')
        },
        body: `status=${status}`
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Reload to update stats
            location.reload();
        } else {
            alert(data.error);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Xato yuz berdi!');
    });
}

function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}
</script>
{% endblock %}
```

---

## STEP 6: Reports & Analytics

### A) Student Attendance Report

```python
@login_required
def student_attendance_report(request, student_id):
    """Individual student attendance report"""
    
    student = get_object_or_404(
        StudentProfile,
        id=student_id,
        library=request.user.library
    )
    
    # Get all attendance records
    records = student.attendance_records.select_related(
        'session'
    ).order_by('-session__date')
    
    # Calculate statistics
    total = records.count()
    
    if total > 0:
        present = records.filter(status__in=['present', 'late']).count()
        absent = records.filter(status='absent').count()
        rate = round((present / total) * 100, 1)
    else:
        present = absent = rate = 0
    
    # Monthly breakdown
    from django.db.models import Count
    from django.db.models.functions import TruncMonth
    
    monthly_stats = records.annotate(
        month=TruncMonth('session__date')
    ).values('month').annotate(
        total=Count('id'),
        present=Count('id', filter=Q(status__in=['present', 'late'])),
        absent=Count('id', filter=Q(status='absent'))
    ).order_by('-month')[:6]
    
    return render(request, 'students/student_attendance_report.html', {
        'student': student,
        'records': records[:50],  # Last 50
        'stats': {
            'total': total,
            'present': present,
            'absent': absent,
            'rate': rate,
        },
        'monthly_stats': monthly_stats,
    })


@login_required
def group_attendance_report(request, group_id):
    """Group attendance report"""
    
    group = get_object_or_404(
        StudentGroup,
        id=group_id,
        library=request.user.library
    )
    
    # Get sessions
    sessions = group.attendance_sessions.all()[:30]
    
    # Get students with stats
    students = group.students.all()
    
    for student in students:
        total = student.attendance_records.filter(
            session__group=group
        ).count()
        
        if total > 0:
            present = student.attendance_records.filter(
                session__group=group,
                status__in=['present', 'late']
            ).count()
            student.attendance_rate = round((present / total) * 100, 1)
        else:
            student.attendance_rate = 0
    
    # Sort by attendance rate
    students = sorted(students, key=lambda s: s.attendance_rate, reverse=True)
    
    return render(request, 'students/group_attendance_report.html', {
        'group': group,
        'sessions': sessions,
        'students': students,
    })
```

---

## 🎯 FEATURES SUMMARY

### ✅ Implemented:

1. **Schedule Management**
   - Weekly schedule per group
   - Multiple schedules (Mon/Wed/Fri etc.)
   - Auto-generate sessions

2. **Session Management**
   - Create sessions manually or auto
   - Today's sessions dashboard
   - Quick attendance marking
   - Finalize/lock sessions

3. **Attendance Marking**
   - Quick buttons (✓ ✗ Kech Sab)
   - Multiple statuses
   - Notes per student
   - Cannot change after finalized

4. **Reports & Analytics**
   - Student individual report
   - Group attendance report
   - Attendance rate %
   - Monthly breakdown
   - Trends

5. **Integration**
   - Works with Groups (ETAP 11)
   - Teacher role support
   - Admin oversight

---

## 📊 WORKFLOW:

```
1. Admin/Teacher creates Group Schedule:
   └─ IELTS 7.0: Mon/Wed/Fri 18:00-20:00

2. Auto-generate sessions (cron):
   └─ Creates sessions for next 30 days

3. Teacher marks attendance:
   └─ Today's sessions → Quick mark → ✓✗

4. Finalize session:
   └─ Lock → Cannot change

5. View reports:
   └─ Student → Attendance history
   └─ Group → Attendance rate
```

---

## ✅ NEXT STEPS:

Ushbu ETAP 15'ni implement qilishdan keyin:

1. **Calendar View** (Optional)
2. **Excel Export** (Attendance reports)
3. **Mobile App** (Teacher quick mark)
4. **SMS Notifications** (Parent notification)

---

**ETAP 15 TAYYOR - PROFESSIONAL DAVOMAT TIZIMI!** 📝

**Boshlaymizmi?** 😊
