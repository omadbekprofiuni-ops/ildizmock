# ETAP 14: B2C Foundation + Rich Dashboard (ildiz-testing.uz)

## Kontekst

ILDIZ Mock Platform hozirgacha **B2B model** asosida qurilgan (o'quv markazlar → guruhlar → o'qituvchilar → o'quvchilar). Endi platformaga **B2C variant** qo'shilmoqda — individual foydalanuvchilar mustaqil ro'yxatdan o'tib, keyinchalik kredit tizimi orqali testlarni ishlatadi.

**Bu ETAP-ning vazifasi:**
- B2C user uchun foundation (user model, signup, login, URL izolatsiya)
- Boy va polished `/b2c/dashboard/` (greeting + KPI tiles + section overview + Getting Started + maxsus Activity widget)
- Ikkilangan landing sahifa (`/`)
- B2B va B2C bir-biriga to'sqinlik qilmasligi uchun middleware

**Bu ETAP-da YO'Q:** Google OAuth (ETAP 15), test katalogi (ETAP 16), kredit tizimi (ETAP 17), to'lov (ETAP 18). Hozircha B2C user **email + parol** orqali kiradi, dashboardda asosiy section/credit bloklari **"Tez orada"** placeholderlari ko'rsatadi.

**Vizual mo'ljal:** Konkurent IELTS platformalaridagi dashboard tipi (chap sidebar, greeting + KPI tiles, section kartochkalar, Getting Started checklist, Activity bo'limi) — lekin **Activity bo'limi ulardan farqli**: oddiy "kun ishtirok etdi/etmadi" GitHub-style heatmap o'rniga **streak + haftalik maqsad + daqiqa-intensivlik heatmap** bo'lsin.

## Loyihaning hozirgi holati

- Django 5.x + PostgreSQL + Tailwind + Alpine.js + Chart.js
- Mavjud apps (haqiqiy nomlarni saqlang): `users`, `tests`, `groups`, `sessions`, `practice`, `super_admin`, `admin_panel`
- `SoftDeleteModel` base class mavjud
- Multi-tenant: o'quv markazlar bo'yicha izolatsiya
- Mavjud URL'lar: `/login/`, `/super-admin/`, `/admin-panel/`, `/groups/`, va h.k.

## ETAP yakunidagi natija

1. `User.user_type` field + data migration mavjud foydalanuvchilarni to'g'ri tipga ko'chiradi
2. `B2CProfile` va `B2CActivityEvent` modellari yaratilgan
3. `/b2c/signup/`, `/b2c/login/`, `/b2c/logout/`, `/b2c/dashboard/`, `/b2c/profile/` ishlaydi
4. Bosh sahifa `/` — ikkilangan landing
5. Dashboard quyidagilarni o'z ichiga oladi:
   - Chap sidebar (Dashboard / Katalog [Soon] / Test History [Soon] / Kreditlar [Soon] / Profil)
   - Hello + 4 KPI tiles (Practice Days, Tests Taken, Avg Score, Exam in)
   - Section Overview (Listening / Reading / Writing / Full Mock — hozircha "Soon")
   - Getting Started checklist (haqiqiy logic)
   - **Maxsus Activity widget**: streak + best streak + haftalik maqsad + bu hafta daqiqa, ostida 12-haftalik heatmap (daqiqa-intensivlik)
6. URL izolatsiya middleware: B2C user `/admin-panel/` va h.k.larga kira olmaydi; B2B user `/b2c/dashboard/` ga kira olmaydi
7. Git push muvaffaqiyatli bajarilgan

---

## 1-bosqich: User modelini kengaytirish

`apps/users/models.py` (yoki User joylashgan haqiqiy fayl) ichida:

```python
class User(AbstractUser):
    # ... mavjud maydonlar ...
    
    class UserType(models.TextChoices):
        SUPERADMIN = "superadmin", "Super Admin"
        B2B_ADMIN = "b2b_admin", "O'quv markaz admini"
        B2B_TEACHER = "b2b_teacher", "O'qituvchi"
        B2B_STUDENT = "b2b_student", "O'quvchi (guruh)"
        B2C_USER = "b2c_user", "Individual foydalanuvchi"
    
    user_type = models.CharField(
        max_length=20,
        choices=UserType.choices,
        default=UserType.B2B_STUDENT,
        db_index=True,
    )
    
    @property
    def is_b2c(self):
        return self.user_type == self.UserType.B2C_USER
    
    @property
    def is_b2b(self):
        return self.user_type in [
            self.UserType.B2B_ADMIN,
            self.UserType.B2B_TEACHER,
            self.UserType.B2B_STUDENT,
        ]
```

Migration:
```bash
python manage.py makemigrations users
```

**Data migration** — mavjud userlarni to'g'ri tipga o'tkazish:

```bash
python manage.py makemigrations --empty users --name set_user_types
```

```python
from django.db import migrations


def set_user_types(apps, schema_editor):
    User = apps.get_model("users", "User")
    
    # Superadminlar
    User.objects.filter(is_superuser=True).update(user_type="superadmin")
    
    # O'qituvchilar va o'quvchilarni loyihadagi haqiqiy belgilar asosida yangilang:
    # masalan: User.objects.filter(is_staff=True, is_superuser=False).update(user_type="b2b_teacher")
    # yoki StudentGroup-ga member bo'lganlar uchun:
    # User.objects.filter(studentgroup__isnull=False).distinct().update(user_type="b2b_student")


def reverse_set_user_types(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [("users", "<oldingi migration nomi>")]
    operations = [migrations.RunPython(set_user_types, reverse_set_user_types)]
```

**Cursor Agent eslatma:** Loyihadagi haqiqiy munosabatlarni (`Teacher`, `StudentGroup`, `is_staff` semantikasi) tekshirib, yuqoridagi taxminlarni kodga moslab yozsin.

---

## 2-bosqich: `apps/b2c/` app yaratish

```bash
python manage.py startapp b2c apps/b2c
```

`settings.py`:
```python
INSTALLED_APPS = [
    # ...
    "apps.b2c",
]
```

### `apps/b2c/models.py`

```python
from django.db import models
from django.conf import settings
from apps.common.models import SoftDeleteModel  # haqiqiy joydan import qiling


class B2CProfile(SoftDeleteModel):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="b2c_profile",
    )
    phone_number = models.CharField(max_length=20, blank=True)
    
    class Language(models.TextChoices):
        UZBEK = "uz", "O'zbek"
        RUSSIAN = "ru", "Русский"
        ENGLISH = "en", "English"
    
    preferred_language = models.CharField(
        max_length=2,
        choices=Language.choices,
        default=Language.UZBEK,
    )
    
    class SignupSource(models.TextChoices):
        EMAIL = "email", "Email"
        GOOGLE = "google", "Google"
        ADMIN = "admin", "Admin"
    
    signup_source = models.CharField(
        max_length=10,
        choices=SignupSource.choices,
        default=SignupSource.EMAIL,
    )
    
    has_completed_onboarding = models.BooleanField(default=False)
    target_exam = models.CharField(max_length=50, blank=True)  # IELTS, CEFR, va h.k.
    target_band = models.DecimalField(max_digits=3, decimal_places=1, null=True, blank=True)
    exam_date = models.DateField(null=True, blank=True)
    weekly_goal_sessions = models.PositiveSmallIntegerField(default=5)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "B2C Profile"
        verbose_name_plural = "B2C Profiles"
    
    def __str__(self):
        return f"B2C: {self.user.email}"


class B2CActivityEvent(models.Model):
    """
    B2C user har bir mashq sessiyasi (section yoki full test) yakunlanganda yaratiladi.
    Heatmap, streak va weekly progress shularning aggregatsiyasi orqali hisoblanadi.
    
    ETAP 14-da modelni yaratamiz va admin/test datasi orqali sinaymiz.
    Real yozish keyingi ETAPlarda (katalog/sessiya bilan integratsiyada) qo'shiladi.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="b2c_activity_events",
    )
    
    class Section(models.TextChoices):
        LISTENING = "listening", "Listening"
        READING = "reading", "Reading"
        WRITING = "writing", "Writing"
        FULL = "full", "Full Mock"
    
    section = models.CharField(max_length=20, choices=Section.choices)
    minutes_spent = models.PositiveSmallIntegerField(default=0)
    score = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    activity_date = models.DateField(db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        indexes = [models.Index(fields=["user", "activity_date"])]
        ordering = ["-activity_date", "-created_at"]
    
    def __str__(self):
        return f"{self.user.email} — {self.section} — {self.activity_date}"
```

### `apps/b2c/services/__init__.py`

Bo'sh fayl yarating.

### `apps/b2c/services/activity.py`

Dashboard ma'lumotlarini hisoblovchi servis. Empty datada ham xavfsiz ishlaydi.

```python
from datetime import date, timedelta
from django.db.models import Sum, Avg
from ..models import B2CActivityEvent


def get_kpi_stats(user):
    """Top 4 KPI tile uchun."""
    events = B2CActivityEvent.objects.filter(user=user)
    profile = user.b2c_profile
    
    tests_taken = events.count()
    avg_score = events.exclude(score__isnull=True).aggregate(v=Avg("score"))["v"]
    practice_days = events.values("activity_date").distinct().count()
    
    exam_in_days = None
    if profile.exam_date:
        delta = (profile.exam_date - date.today()).days
        exam_in_days = delta if delta >= 0 else 0
    
    return {
        "practice_days": practice_days,
        "tests_taken": tests_taken,
        "avg_score": round(avg_score, 1) if avg_score is not None else None,
        "exam_in_days": exam_in_days,
    }


def get_streak_stats(user):
    """Joriy va eng uzun streakni hisoblaydi."""
    dates = list(
        B2CActivityEvent.objects.filter(user=user)
        .values_list("activity_date", flat=True)
        .distinct()
        .order_by("-activity_date")
    )
    if not dates:
        return {"current_streak": 0, "best_streak": 0}
    
    dates_set = set(dates)
    today = date.today()
    
    # Current streak: bugundan (yoki kechadan, agar bugun mashq qilmagan bo'lsa) orqaga
    current = 0
    cursor = today if today in dates_set else today - timedelta(days=1)
    while cursor in dates_set:
        current += 1
        cursor -= timedelta(days=1)
    
    # Best streak: ketma-ket kunlar
    sorted_dates = sorted(dates_set)
    best = 0
    run = 0
    prev = None
    for d in sorted_dates:
        if prev is None or (d - prev).days == 1:
            run += 1
        else:
            run = 1
        best = max(best, run)
        prev = d
    
    return {"current_streak": current, "best_streak": best}


def get_weekly_progress(user):
    """Haftalik maqsad (dushanbadan boshlab)."""
    profile = user.b2c_profile
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    
    week_events = B2CActivityEvent.objects.filter(user=user, activity_date__gte=week_start)
    sessions_done = week_events.values("activity_date").distinct().count()
    minutes = week_events.aggregate(s=Sum("minutes_spent"))["s"] or 0
    
    goal = profile.weekly_goal_sessions or 5
    pct = min(100, int(round((sessions_done / goal) * 100))) if goal else 0
    
    return {
        "sessions_done": sessions_done,
        "sessions_goal": goal,
        "percent": pct,
        "minutes_this_week": minutes,
    }


def get_heatmap_data(user, weeks=12):
    """
    Oxirgi `weeks` hafta uchun heatmap.
    Return: 7 qator (Mon..Sun) × `weeks` ustun. Har bir hujayra {date, minutes, band} yoki None (kelajak kun).
    Band: 0 = 0 min, 1 = 1–15, 2 = 16–30, 3 = 31–60, 4 = 60+.
    """
    today = date.today()
    current_monday = today - timedelta(days=today.weekday())
    start = current_monday - timedelta(weeks=weeks - 1)
    
    events = (
        B2CActivityEvent.objects.filter(
            user=user, activity_date__gte=start, activity_date__lte=today
        )
        .values("activity_date")
        .annotate(total_minutes=Sum("minutes_spent"))
    )
    by_date = {e["activity_date"]: e["total_minutes"] or 0 for e in events}
    
    def band(minutes):
        if minutes <= 0:
            return 0
        if minutes <= 15:
            return 1
        if minutes <= 30:
            return 2
        if minutes <= 60:
            return 3
        return 4
    
    grid = []
    for weekday in range(7):  # 0 = Mon, 6 = Sun
        row = []
        for w in range(weeks):
            d = start + timedelta(weeks=w, days=weekday)
            if d > today:
                row.append(None)
            else:
                minutes = by_date.get(d, 0)
                row.append({"date": d, "minutes": minutes, "band": band(minutes)})
        grid.append(row)
    return grid


def get_getting_started(user):
    """Onboarding checklist holatlari."""
    profile = user.b2c_profile
    has_phone = bool(profile.phone_number)
    has_target = bool(profile.target_exam) and profile.target_band is not None
    has_first_event = B2CActivityEvent.objects.filter(user=user).exists()
    
    items = [
        {"key": "profile", "label": "Profilni to'ldiring (telefon va maqsad)", "done": has_phone and has_target, "href": "/b2c/profile/"},
        {"key": "first_test", "label": "Birinchi testni boshlang", "done": has_first_event, "href": "#"},
        {"key": "credits", "label": "Kredit balansini tekshiring", "done": profile.has_completed_onboarding, "href": "#"},
        {"key": "results", "label": "Natijalaringizni ko'ring", "done": has_first_event, "href": "#"},
    ]
    done_count = sum(1 for i in items if i["done"])
    percent = int(round((done_count / len(items)) * 100))
    
    return {"items": items, "done_count": done_count, "total": len(items), "percent": percent}
```

### `apps/b2c/forms.py`

```python
from django import forms
from django.contrib.auth import get_user_model, password_validation
from django.core.exceptions import ValidationError

User = get_user_model()

INPUT_CLASSES = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"


class B2CSignupForm(forms.Form):
    first_name = forms.CharField(max_length=150, label="Ism",
        widget=forms.TextInput(attrs={"class": INPUT_CLASSES}))
    last_name = forms.CharField(max_length=150, label="Familiya",
        widget=forms.TextInput(attrs={"class": INPUT_CLASSES}))
    email = forms.EmailField(label="Email",
        widget=forms.EmailInput(attrs={"class": INPUT_CLASSES}))
    password1 = forms.CharField(label="Parol",
        widget=forms.PasswordInput(attrs={"class": INPUT_CLASSES}))
    password2 = forms.CharField(label="Parolni takrorlang",
        widget=forms.PasswordInput(attrs={"class": INPUT_CLASSES}))
    
    def clean_email(self):
        email = self.cleaned_data["email"].lower().strip()
        if User.objects.filter(email__iexact=email).exists():
            raise ValidationError("Bu email allaqachon ro'yxatdan o'tgan.")
        return email
    
    def clean(self):
        cleaned = super().clean()
        p1, p2 = cleaned.get("password1"), cleaned.get("password2")
        if p1 and p2 and p1 != p2:
            raise ValidationError("Parollar mos kelmadi.")
        if p1:
            password_validation.validate_password(p1)
        return cleaned


class B2CLoginForm(forms.Form):
    email = forms.EmailField(label="Email",
        widget=forms.EmailInput(attrs={"class": INPUT_CLASSES}))
    password = forms.CharField(label="Parol",
        widget=forms.PasswordInput(attrs={"class": INPUT_CLASSES}))


class B2CProfileForm(forms.ModelForm):
    first_name = forms.CharField(max_length=150,
        widget=forms.TextInput(attrs={"class": INPUT_CLASSES}))
    last_name = forms.CharField(max_length=150,
        widget=forms.TextInput(attrs={"class": INPUT_CLASSES}))
    
    class Meta:
        model = None  # __init__ da to'ldiriladi
        fields = ["phone_number", "preferred_language", "target_exam", "target_band", "exam_date", "weekly_goal_sessions"]
        widgets = {
            "phone_number": forms.TextInput(attrs={"class": INPUT_CLASSES}),
            "preferred_language": forms.Select(attrs={"class": INPUT_CLASSES}),
            "target_exam": forms.TextInput(attrs={"class": INPUT_CLASSES}),
            "target_band": forms.NumberInput(attrs={"class": INPUT_CLASSES, "step": "0.5"}),
            "exam_date": forms.DateInput(attrs={"type": "date", "class": INPUT_CLASSES}),
            "weekly_goal_sessions": forms.NumberInput(attrs={"class": INPUT_CLASSES, "min": "1", "max": "14"}),
        }
    
    def __init__(self, *args, **kwargs):
        from .models import B2CProfile
        self._meta.model = B2CProfile
        super().__init__(*args, **kwargs)
        if self.instance and self.instance.user_id:
            self.fields["first_name"].initial = self.instance.user.first_name
            self.fields["last_name"].initial = self.instance.user.last_name
    
    def save(self, commit=True):
        profile = super().save(commit=False)
        profile.user.first_name = self.cleaned_data["first_name"]
        profile.user.last_name = self.cleaned_data["last_name"]
        if commit:
            profile.user.save()
            profile.save()
        return profile
```

### `apps/b2c/mixins.py`

```python
from django.contrib.auth.mixins import LoginRequiredMixin
from django.http import HttpResponseForbidden
from django.shortcuts import redirect


class B2CUserRequiredMixin(LoginRequiredMixin):
    login_url = "/b2c/login/"
    
    def dispatch(self, request, *args, **kwargs):
        if not request.user.is_authenticated:
            return redirect(self.login_url)
        if not request.user.is_b2c:
            return HttpResponseForbidden("Bu sahifa faqat B2C foydalanuvchilar uchun.")
        return super().dispatch(request, *args, **kwargs)


class B2BUserRequiredMixin(LoginRequiredMixin):
    login_url = "/login/"
    
    def dispatch(self, request, *args, **kwargs):
        if not request.user.is_authenticated:
            return redirect(self.login_url)
        if not (request.user.is_b2b or request.user.user_type == "superadmin"):
            return HttpResponseForbidden("Bu sahifa B2C foydalanuvchilar uchun mavjud emas.")
        return super().dispatch(request, *args, **kwargs)
```

### `apps/b2c/views.py`

```python
from django.contrib.auth import authenticate, login, logout, get_user_model
from django.contrib.auth.hashers import make_password
from django.contrib import messages
from django.shortcuts import render, redirect
from django.urls import reverse_lazy
from django.views import View
from django.views.generic import TemplateView, UpdateView

from .forms import B2CSignupForm, B2CLoginForm, B2CProfileForm
from .models import B2CProfile
from .mixins import B2CUserRequiredMixin
from .services import activity as activity_service

User = get_user_model()


class B2CSignupView(View):
    template_name = "b2c/signup.html"
    
    def get(self, request):
        if request.user.is_authenticated and request.user.is_b2c:
            return redirect("b2c:dashboard")
        return render(request, self.template_name, {"form": B2CSignupForm()})
    
    def post(self, request):
        form = B2CSignupForm(request.POST)
        if not form.is_valid():
            return render(request, self.template_name, {"form": form})
        
        user = User.objects.create(
            username=form.cleaned_data["email"],
            email=form.cleaned_data["email"],
            first_name=form.cleaned_data["first_name"],
            last_name=form.cleaned_data["last_name"],
            password=make_password(form.cleaned_data["password1"]),
            user_type=User.UserType.B2C_USER,
        )
        B2CProfile.objects.create(user=user, signup_source=B2CProfile.SignupSource.EMAIL)
        
        login(request, user)
        messages.success(request, "Xush kelibsiz! Ro'yxatdan o'tdingiz.")
        return redirect("b2c:dashboard")


class B2CLoginView(View):
    template_name = "b2c/login.html"
    
    def get(self, request):
        if request.user.is_authenticated and request.user.is_b2c:
            return redirect("b2c:dashboard")
        return render(request, self.template_name, {"form": B2CLoginForm()})
    
    def post(self, request):
        form = B2CLoginForm(request.POST)
        if not form.is_valid():
            return render(request, self.template_name, {"form": form})
        
        email = form.cleaned_data["email"].lower()
        password = form.cleaned_data["password"]
        
        try:
            user_obj = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            messages.error(request, "Email yoki parol noto'g'ri.")
            return render(request, self.template_name, {"form": form})
        
        user = authenticate(request, username=user_obj.username, password=password)
        if user is None:
            messages.error(request, "Email yoki parol noto'g'ri.")
            return render(request, self.template_name, {"form": form})
        
        if not user.is_b2c:
            messages.error(request, "Bu kirish faqat individual foydalanuvchilar uchun. O'quv markaz logini orqali kiring.")
            return render(request, self.template_name, {"form": form})
        
        login(request, user)
        return redirect("b2c:dashboard")


class B2CLogoutView(View):
    def post(self, request):
        logout(request)
        return redirect("b2c:login")
    
    def get(self, request):
        return self.post(request)


class B2CDashboardView(B2CUserRequiredMixin, TemplateView):
    template_name = "b2c/dashboard.html"
    
    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        user = self.request.user
        ctx["profile"] = user.b2c_profile
        ctx["kpi"] = activity_service.get_kpi_stats(user)
        ctx["streak"] = activity_service.get_streak_stats(user)
        ctx["weekly"] = activity_service.get_weekly_progress(user)
        ctx["heatmap"] = activity_service.get_heatmap_data(user, weeks=12)
        ctx["getting_started"] = activity_service.get_getting_started(user)
        ctx["sections"] = [
            {"key": "listening", "name": "Listening", "count": 0, "accent": "blue", "ready": False},
            {"key": "reading", "name": "Reading", "count": 0, "accent": "rose", "ready": False},
            {"key": "writing", "name": "Writing", "count": 0, "accent": "emerald", "ready": False},
            {"key": "full", "name": "Full Mock", "count": 0, "accent": "violet", "ready": False},
        ]
        return ctx


class B2CProfileView(B2CUserRequiredMixin, UpdateView):
    template_name = "b2c/profile.html"
    form_class = B2CProfileForm
    success_url = reverse_lazy("b2c:profile")
    
    def get_object(self):
        return self.request.user.b2c_profile
    
    def form_valid(self, form):
        messages.success(self.request, "Profil yangilandi.")
        return super().form_valid(form)
```

### `apps/b2c/urls.py`

```python
from django.urls import path
from . import views

app_name = "b2c"

urlpatterns = [
    path("signup/", views.B2CSignupView.as_view(), name="signup"),
    path("login/", views.B2CLoginView.as_view(), name="login"),
    path("logout/", views.B2CLogoutView.as_view(), name="logout"),
    path("dashboard/", views.B2CDashboardView.as_view(), name="dashboard"),
    path("profile/", views.B2CProfileView.as_view(), name="profile"),
]
```

Asosiy `config/urls.py`:
```python
urlpatterns = [
    # ...
    path("b2c/", include("apps.b2c.urls", namespace="b2c")),
]
```

---

## 3-bosqich: Auth template'lar (signup, login)

### `apps/b2c/templates/b2c/_auth_base.html`

```html
{% load static %}
<!doctype html>
<html lang="uz">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{% block title %}ILDIZ Mock{% endblock %}</title>
  <link rel="stylesheet" href="{% static 'css/tailwind.css' %}">
</head>
<body class="min-h-screen bg-gray-50 flex items-center justify-center px-4">
  <div class="w-full max-w-md">
    <a href="/" class="flex items-center gap-2 justify-center mb-8">
      <span class="text-2xl font-bold text-rose-600">ILDIZ</span>
      <span class="text-2xl font-semibold">Mock</span>
    </a>
    {% if messages %}
      <div class="mb-4 space-y-2">
        {% for m in messages %}
          <div class="px-4 py-2.5 rounded-lg text-sm {% if m.tags == 'error' %}bg-red-50 text-red-700 border border-red-100{% else %}bg-green-50 text-green-700 border border-green-100{% endif %}">{{ m }}</div>
        {% endfor %}
      </div>
    {% endif %}
    <div class="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
      {% block content %}{% endblock %}
    </div>
  </div>
</body>
</html>
```

### `apps/b2c/templates/b2c/signup.html`

```html
{% extends "b2c/_auth_base.html" %}
{% block title %}Ro'yxatdan o'tish — ILDIZ Mock{% endblock %}
{% block content %}
<h1 class="text-2xl font-bold mb-1">Ro'yxatdan o'ting</h1>
<p class="text-gray-600 text-sm mb-6">Individual foydalanuvchi sifatida bepul akkaunt yarating.</p>

<form method="post" class="space-y-4">
  {% csrf_token %}
  <div class="grid grid-cols-2 gap-3">
    <div>
      <label class="text-sm font-medium text-gray-700 mb-1 block">Ism</label>
      {{ form.first_name }}
    </div>
    <div>
      <label class="text-sm font-medium text-gray-700 mb-1 block">Familiya</label>
      {{ form.last_name }}
    </div>
  </div>
  <div>
    <label class="text-sm font-medium text-gray-700 mb-1 block">Email</label>
    {{ form.email }}
    {% if form.email.errors %}<p class="text-xs text-red-600 mt-1">{{ form.email.errors.0 }}</p>{% endif %}
  </div>
  <div>
    <label class="text-sm font-medium text-gray-700 mb-1 block">Parol</label>
    {{ form.password1 }}
  </div>
  <div>
    <label class="text-sm font-medium text-gray-700 mb-1 block">Parolni takrorlang</label>
    {{ form.password2 }}
  </div>
  {% if form.non_field_errors %}<p class="text-xs text-red-600">{{ form.non_field_errors.0 }}</p>{% endif %}
  <button type="submit" class="w-full bg-rose-600 hover:bg-rose-700 text-white font-medium py-2.5 rounded-xl transition">Ro'yxatdan o'tish</button>
</form>

<p class="text-sm text-gray-600 mt-6 text-center">
  Akkauntingiz bormi? <a href="{% url 'b2c:login' %}" class="text-rose-600 font-medium hover:underline">Kiring</a>
</p>
{% endblock %}
```

### `apps/b2c/templates/b2c/login.html`

```html
{% extends "b2c/_auth_base.html" %}
{% block title %}Kirish — ILDIZ Mock{% endblock %}
{% block content %}
<h1 class="text-2xl font-bold mb-1">Akkauntingizga kiring</h1>
<p class="text-gray-600 text-sm mb-6">Individual foydalanuvchi kirishi.</p>

<form method="post" class="space-y-4">
  {% csrf_token %}
  <div>
    <label class="text-sm font-medium text-gray-700 mb-1 block">Email</label>
    {{ form.email }}
  </div>
  <div>
    <label class="text-sm font-medium text-gray-700 mb-1 block">Parol</label>
    {{ form.password }}
  </div>
  <button type="submit" class="w-full bg-rose-600 hover:bg-rose-700 text-white font-medium py-2.5 rounded-xl">Kirish</button>
</form>

{# ETAP 15-da Google tugmasi shu yerga ulanadi #}
<div class="mt-4">
  <button type="button" disabled
          class="w-full border border-gray-300 rounded-xl py-2.5 text-sm font-medium text-gray-400 cursor-not-allowed flex items-center justify-center gap-2">
    <span>Google bilan kirish</span>
    <span class="text-[10px] font-bold bg-gray-100 px-2 py-0.5 rounded-full">SOON</span>
  </button>
</div>

<p class="text-sm text-gray-600 mt-6 text-center">
  Akkauntingiz yo'qmi? <a href="{% url 'b2c:signup' %}" class="text-rose-600 font-medium hover:underline">Ro'yxatdan o'ting</a>
</p>
{% endblock %}
```

---

## 4-bosqich: Dashboard layout (base + sidebar)

### `apps/b2c/templates/b2c/base_b2c.html`

```html
{% load static %}
<!doctype html>
<html lang="uz">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{% block title %}ILDIZ Mock{% endblock %}</title>
  <link rel="stylesheet" href="{% static 'css/tailwind.css' %}">
  <script defer src="https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js"></script>
</head>
<body class="bg-gray-50 text-gray-900 antialiased">

<header class="bg-white border-b border-gray-200">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
    <a href="{% url 'b2c:dashboard' %}" class="flex items-center gap-2">
      <span class="text-xl font-bold text-rose-600">ILDIZ</span>
      <span class="text-xl font-semibold">Mock</span>
    </a>
    <div class="flex items-center gap-4">
      <a href="{% url 'b2c:profile' %}" class="text-sm text-gray-600 hover:text-gray-900">
        {{ request.user.get_full_name|default:request.user.email }}
      </a>
      <form method="post" action="{% url 'b2c:logout' %}">
        {% csrf_token %}
        <button type="submit" class="text-sm text-gray-500 hover:text-rose-600">Chiqish</button>
      </form>
    </div>
  </div>
</header>

<main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
  {% if messages %}
    <div class="mb-4 space-y-2">
      {% for m in messages %}
        <div class="px-4 py-3 rounded-lg text-sm {% if m.tags == 'error' %}bg-red-50 text-red-700{% else %}bg-green-50 text-green-700{% endif %}">{{ m }}</div>
      {% endfor %}
    </div>
  {% endif %}
  {% block content %}{% endblock %}
</main>

</body>
</html>
```

### `apps/b2c/templates/b2c/_sidebar.html`

```html
<aside class="w-64 shrink-0 bg-white border border-gray-200 rounded-2xl p-4 h-fit sticky top-6 hidden lg:block">
  <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Menyu</p>
  <nav class="space-y-1">
    <a href="{% url 'b2c:dashboard' %}"
       class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium {% if active == 'dashboard' %}bg-rose-50 text-rose-600{% else %}text-gray-700 hover:bg-gray-50{% endif %}">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/></svg>
      Dashboard
    </a>
    <a href="#" class="flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 cursor-not-allowed">
      <span class="flex items-center gap-3">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h7"/></svg>
        Katalog
      </span>
      <span class="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">SOON</span>
    </a>
    <a href="#" class="flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 cursor-not-allowed">
      <span class="flex items-center gap-3">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 8v4l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        Test History
      </span>
      <span class="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">SOON</span>
    </a>
    <a href="#" class="flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 cursor-not-allowed">
      <span class="flex items-center gap-3">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 8c-2.21 0-4 1.34-4 3s1.79 3 4 3 4 1.34 4 3-1.79 3-4 3m0-12V4m0 16v2"/></svg>
        Kreditlar
      </span>
      <span class="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">SOON</span>
    </a>
    <a href="{% url 'b2c:profile' %}"
       class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium {% if active == 'profile' %}bg-rose-50 text-rose-600{% else %}text-gray-700 hover:bg-gray-50{% endif %}">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5.121 17.804A9 9 0 1118.879 6.196 9 9 0 015.121 17.804z M15 10a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
      Profil
    </a>
  </nav>
</aside>
```

---

## 5-bosqich: Dashboard sahifasi (asosiy)

### `apps/b2c/templates/b2c/dashboard.html`

```html
{% extends "b2c/base_b2c.html" %}
{% block title %}Dashboard — ILDIZ Mock{% endblock %}
{% block content %}
<div class="flex gap-6">
  {% include "b2c/_sidebar.html" with active="dashboard" %}

  <div class="flex-1 space-y-6 min-w-0">
    
    {# ====== Greeting + KPI tiles ====== #}
    <div class="bg-white border border-gray-200 rounded-2xl p-6">
      <div class="flex items-start justify-between mb-5">
        <h1 class="text-2xl font-bold">Salom, {{ request.user.first_name|default:request.user.email }}!</h1>
        <a href="#" class="text-sm text-rose-600 font-medium hover:underline hidden sm:inline">Statistikani ko'rish →</a>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div class="border border-gray-200 rounded-xl p-4">
          <p class="text-xs text-gray-500 mb-1">Mashq kunlari</p>
          <p class="text-2xl font-bold">{{ kpi.practice_days|default:"--" }}</p>
        </div>
        <div class="border border-gray-200 rounded-xl p-4">
          <p class="text-xs text-gray-500 mb-1">Yechilgan testlar</p>
          <p class="text-2xl font-bold">{{ kpi.tests_taken|default:"--" }}</p>
        </div>
        <div class="border border-gray-200 rounded-xl p-4">
          <p class="text-xs text-gray-500 mb-1">O'rtacha ball</p>
          <p class="text-2xl font-bold">{{ kpi.avg_score|default:"--" }}</p>
        </div>
        <div class="border border-gray-200 rounded-xl p-4">
          <p class="text-xs text-gray-500 mb-1">Imtihon</p>
          <p class="text-2xl font-bold">
            {% if kpi.exam_in_days is not None %}{{ kpi.exam_in_days }} kun{% else %}--{% endif %}
          </p>
        </div>
      </div>
    </div>

    {# ====== Section overview ====== #}
    <div class="bg-white border border-gray-200 rounded-2xl p-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-bold">Bo'limlar</h2>
        <span class="text-xs text-gray-500">Katalog tez orada ochiladi</span>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        {% for s in sections %}
          {% if s.accent == "blue" %}
            <div class="border-l-4 border-blue-500 bg-blue-50/40 rounded-xl p-4">
          {% elif s.accent == "rose" %}
            <div class="border-l-4 border-rose-500 bg-rose-50/40 rounded-xl p-4">
          {% elif s.accent == "emerald" %}
            <div class="border-l-4 border-emerald-500 bg-emerald-50/40 rounded-xl p-4">
          {% else %}
            <div class="border-l-4 border-violet-500 bg-violet-50/40 rounded-xl p-4">
          {% endif %}
            <p class="text-sm font-semibold text-gray-800">{{ s.name }}</p>
            <p class="text-xs text-gray-500 mt-1">
              {% if s.ready %}{{ s.count }} testlar{% else %}Tez orada{% endif %}
            </p>
          </div>
        {% endfor %}
      </div>
    </div>

    {# ====== Getting Started ====== #}
    <div class="bg-white border border-gray-200 rounded-2xl p-6">
      <div class="flex items-center justify-between mb-1">
        <h2 class="text-lg font-bold">Boshlash</h2>
        <span class="text-sm font-semibold text-gray-700">{{ getting_started.percent }}%</span>
      </div>
      <p class="text-xs text-gray-500 mb-4">{{ getting_started.done_count }} / {{ getting_started.total }} bajarildi</p>
      <div class="w-full h-1.5 bg-gray-100 rounded-full mb-4 overflow-hidden">
        <div class="h-full bg-rose-500" style="width: {{ getting_started.percent }}%"></div>
      </div>
      <ul class="divide-y divide-gray-100">
        {% for item in getting_started.items %}
          <a href="{{ item.href }}" class="flex items-center gap-3 py-3 hover:bg-gray-50 -mx-2 px-2 rounded-lg transition">
            {% if item.done %}
              <span class="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs font-bold">✓</span>
            {% else %}
              <span class="w-6 h-6 rounded-full border-2 border-gray-300"></span>
            {% endif %}
            <span class="flex-1 text-sm {% if item.done %}text-gray-400 line-through{% else %}text-gray-800{% endif %}">{{ item.label }}</span>
            <span class="text-gray-400">→</span>
          </a>
        {% endfor %}
      </ul>
    </div>

    {# ====== Activity widget ====== #}
    {% include "b2c/_activity.html" %}

  </div>
</div>
{% endblock %}
```

---

## 6-bosqich: **MAXSUS Activity widget** (asosiy diqqat-e'tibor)

Bu widget oddiy "kun ishtirok etdi/etmadi" binary heatmap'dan **boyroq**:

1. **4 ta KPI tile widget ichida** — Joriy streak, Eng uzun streak, Haftalik maqsad (X/Y sessiya), Bu hafta daqiqalari
2. **Heatmap — 12 hafta** (yil emas) — yaqin va o'qiladigan
3. **Daqiqa-intensivlik** binar emas — 5 bandda (0 / 1–15 / 16–30 / 31–60 / 60+)
4. Hover tooltip — sana + daqiqa (browser `title` orqali)
5. Pastida legend (daqiqa diapazoni)

### `apps/b2c/templates/b2c/_activity.html`

```html
<div class="bg-white border border-gray-200 rounded-2xl p-6">
  <div class="flex items-start justify-between mb-5">
    <div>
      <h2 class="text-lg font-bold">Faollik</h2>
      <p class="text-xs text-gray-500 mt-0.5">Oxirgi 12 hafta — hujayra rangi kun davomidagi mashq daqiqasiga qarab</p>
    </div>
  </div>

  {# Top — 4 KPI tile #}
  <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
    <div class="bg-orange-50 border border-orange-100 rounded-xl p-4">
      <div class="flex items-center gap-2 mb-1">
        <span>🔥</span>
        <p class="text-xs text-orange-700 font-medium">Joriy streak</p>
      </div>
      <p class="text-2xl font-bold text-orange-700">{{ streak.current_streak }} <span class="text-sm font-medium">kun</span></p>
    </div>
    <div class="bg-amber-50 border border-amber-100 rounded-xl p-4">
      <div class="flex items-center gap-2 mb-1">
        <span>⭐</span>
        <p class="text-xs text-amber-700 font-medium">Eng uzun streak</p>
      </div>
      <p class="text-2xl font-bold text-amber-700">{{ streak.best_streak }} <span class="text-sm font-medium">kun</span></p>
    </div>
    <div class="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
      <div class="flex items-center gap-2 mb-1">
        <span>✅</span>
        <p class="text-xs text-emerald-700 font-medium">Haftalik maqsad</p>
      </div>
      <p class="text-2xl font-bold text-emerald-700">{{ weekly.sessions_done }}<span class="text-sm font-medium"> / {{ weekly.sessions_goal }}</span></p>
      <div class="mt-2 w-full h-1 bg-emerald-100 rounded-full overflow-hidden">
        <div class="h-full bg-emerald-500" style="width: {{ weekly.percent }}%"></div>
      </div>
    </div>
    <div class="bg-sky-50 border border-sky-100 rounded-xl p-4">
      <div class="flex items-center gap-2 mb-1">
        <span>⏱️</span>
        <p class="text-xs text-sky-700 font-medium">Bu hafta vaqt</p>
      </div>
      <p class="text-2xl font-bold text-sky-700">{{ weekly.minutes_this_week }} <span class="text-sm font-medium">daqiqa</span></p>
    </div>
  </div>

  {# Heatmap: 7 qator × 12 ustun #}
  <div class="flex items-start gap-3 overflow-x-auto pb-2">
    <div class="flex flex-col gap-1 text-[10px] text-gray-400 pt-0.5 shrink-0">
      <span class="h-3.5 leading-3.5">Du</span>
      <span class="h-3.5"></span>
      <span class="h-3.5 leading-3.5">Cho</span>
      <span class="h-3.5"></span>
      <span class="h-3.5 leading-3.5">Ju</span>
      <span class="h-3.5"></span>
      <span class="h-3.5 leading-3.5">Ya</span>
    </div>
    <div class="grid grid-flow-col grid-rows-7 gap-1">
      {% for row in heatmap %}
        {% for cell in row %}
          {% if cell %}
            {% if cell.band == 0 %}
              <div class="w-3.5 h-3.5 rounded-sm bg-gray-100" title="{{ cell.date|date:'d M Y' }} — {{ cell.minutes }} daqiqa"></div>
            {% elif cell.band == 1 %}
              <div class="w-3.5 h-3.5 rounded-sm bg-rose-200" title="{{ cell.date|date:'d M Y' }} — {{ cell.minutes }} daqiqa"></div>
            {% elif cell.band == 2 %}
              <div class="w-3.5 h-3.5 rounded-sm bg-rose-400" title="{{ cell.date|date:'d M Y' }} — {{ cell.minutes }} daqiqa"></div>
            {% elif cell.band == 3 %}
              <div class="w-3.5 h-3.5 rounded-sm bg-rose-600" title="{{ cell.date|date:'d M Y' }} — {{ cell.minutes }} daqiqa"></div>
            {% else %}
              <div class="w-3.5 h-3.5 rounded-sm bg-rose-800" title="{{ cell.date|date:'d M Y' }} — {{ cell.minutes }} daqiqa"></div>
            {% endif %}
          {% else %}
            <div class="w-3.5 h-3.5"></div>
          {% endif %}
        {% endfor %}
      {% endfor %}
    </div>
  </div>

  {# Legend #}
  <div class="flex items-center justify-end gap-2 mt-4 text-xs text-gray-500">
    <span>Kam</span>
    <span class="w-3 h-3 rounded-sm bg-gray-100"></span>
    <span class="w-3 h-3 rounded-sm bg-rose-200"></span>
    <span class="w-3 h-3 rounded-sm bg-rose-400"></span>
    <span class="w-3 h-3 rounded-sm bg-rose-600"></span>
    <span class="w-3 h-3 rounded-sm bg-rose-800"></span>
    <span>Ko'p</span>
  </div>
  <p class="text-[11px] text-gray-400 mt-2 text-right">0 / 1–15 / 16–30 / 31–60 / 60+ daqiqa</p>
</div>
```

**Muhim eslatma — Tailwind ranglari:** Section overview va heatmap'da ishlatilgan barcha Tailwind klasslari **statik** (dynamic interpolation yo'q). Lekin agar loyihada Tailwind purge/JIT'da bu klasslar topilmasa, `tailwind.config.js` safelist'iga qo'shing:

```js
module.exports = {
  // ...
  safelist: [
    "border-blue-500", "bg-blue-50/40",
    "border-rose-500", "bg-rose-50/40",
    "border-emerald-500", "bg-emerald-50/40",
    "border-violet-500", "bg-violet-50/40",
    "bg-rose-200", "bg-rose-400", "bg-rose-600", "bg-rose-800",
  ],
};
```

---

## 7-bosqich: Profil sahifasi

### `apps/b2c/templates/b2c/profile.html`

```html
{% extends "b2c/base_b2c.html" %}
{% block title %}Profil — ILDIZ Mock{% endblock %}
{% block content %}
<div class="flex gap-6">
  {% include "b2c/_sidebar.html" with active="profile" %}
  <div class="flex-1 max-w-2xl min-w-0">
    <div class="bg-white border border-gray-200 rounded-2xl p-6">
      <h1 class="text-xl font-bold mb-1">Profil sozlamalari</h1>
      <p class="text-sm text-gray-500 mb-6">Shaxsiy ma'lumotlar va mashq maqsadlari</p>
      <form method="post" class="space-y-4">
        {% csrf_token %}
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-sm font-medium text-gray-700 mb-1 block">Ism</label>
            {{ form.first_name }}
          </div>
          <div>
            <label class="text-sm font-medium text-gray-700 mb-1 block">Familiya</label>
            {{ form.last_name }}
          </div>
        </div>
        <div>
          <label class="text-sm font-medium text-gray-700 mb-1 block">Telefon</label>
          {{ form.phone_number }}
        </div>
        <div>
          <label class="text-sm font-medium text-gray-700 mb-1 block">Til</label>
          {{ form.preferred_language }}
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-sm font-medium text-gray-700 mb-1 block">Maqsad imtihon</label>
            {{ form.target_exam }}
          </div>
          <div>
            <label class="text-sm font-medium text-gray-700 mb-1 block">Maqsad ball</label>
            {{ form.target_band }}
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-sm font-medium text-gray-700 mb-1 block">Imtihon sanasi</label>
            {{ form.exam_date }}
          </div>
          <div>
            <label class="text-sm font-medium text-gray-700 mb-1 block">Haftalik maqsad (sessiya)</label>
            {{ form.weekly_goal_sessions }}
          </div>
        </div>
        <button type="submit" class="bg-rose-600 hover:bg-rose-700 text-white font-medium px-5 py-2.5 rounded-xl">Saqlash</button>
      </form>
    </div>
  </div>
</div>
{% endblock %}
```

---

## 8-bosqich: Ikkilangan landing sahifa (`/`)

### `templates/landing.html`

```html
{% load static %}
<!doctype html>
<html lang="uz">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ILDIZ Mock — IELTS tayyorgarlik platformasi</title>
  <link rel="stylesheet" href="{% static 'css/tailwind.css' %}">
</head>
<body class="min-h-screen bg-gradient-to-br from-rose-50 via-white to-amber-50">
  <header class="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
    <div class="flex items-center gap-2">
      <span class="text-xl font-bold text-rose-600">ILDIZ</span>
      <span class="text-xl font-semibold">Mock</span>
    </div>
    <div class="flex items-center gap-4 text-sm">
      <a href="/login/" class="text-gray-600 hover:text-gray-900">O'quv markaz kirish</a>
      <a href="/b2c/login/" class="text-gray-600 hover:text-gray-900">Individual kirish</a>
    </div>
  </header>
  
  <div class="max-w-7xl mx-auto px-6 pt-16 pb-20 text-center">
    <h1 class="text-4xl md:text-5xl font-bold tracking-tight mb-4">
      IELTS-ga tayyorgarlik —<br>endi <span class="text-rose-600">soddaroq</span>
    </h1>
    <p class="text-lg text-gray-600 max-w-2xl mx-auto mb-12">
      O'quv markazlar va individual foydalanuvchilar uchun yagona mock platforma
    </p>
    
    <div class="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
      <a href="/login/" class="group bg-white border-2 border-gray-200 hover:border-rose-500 rounded-2xl p-8 text-left transition">
        <div class="w-12 h-12 rounded-xl bg-rose-100 flex items-center justify-center mb-4 text-2xl">🏫</div>
        <h3 class="text-xl font-bold mb-2">O'quv markazlar uchun</h3>
        <p class="text-sm text-gray-600 mb-4">Guruh boshqaruvi, o'qituvchi paneli, batafsil hisobotlar va boshqalar.</p>
        <span class="text-rose-600 font-medium text-sm">Kirish →</span>
      </a>
      
      <a href="/b2c/signup/" class="group bg-white border-2 border-gray-200 hover:border-rose-500 rounded-2xl p-8 text-left transition">
        <div class="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center mb-4 text-2xl">🎯</div>
        <h3 class="text-xl font-bold mb-2">Individual foydalanuvchilar</h3>
        <p class="text-sm text-gray-600 mb-4">O'zingiz uchun tayyorlanmoqdamisiz? Bepul boshlang, kredit sotib oling.</p>
        <span class="text-rose-600 font-medium text-sm">Boshlash →</span>
      </a>
    </div>
  </div>
</body>
</html>
```

**View** — `apps/core/views.py` (yoki landing joylashgan haqiqiy joy):

```python
from django.views.generic import TemplateView
from django.shortcuts import redirect


class LandingView(TemplateView):
    template_name = "landing.html"
    
    def dispatch(self, request, *args, **kwargs):
        if request.user.is_authenticated:
            if request.user.is_b2c:
                return redirect("b2c:dashboard")
            if request.user.user_type == "superadmin":
                return redirect("/super-admin/")
            if request.user.is_b2b:
                return redirect("/admin-panel/")
        return super().dispatch(request, *args, **kwargs)
```

`config/urls.py`:
```python
path("", LandingView.as_view(), name="landing"),
```

**Eslatma:** Agar mavjud landing/home view bo'lsa — uni yangilang, yo'q bo'lsa yangidan yarating. Loyiha tuzilishiga moslang.

---

## 9-bosqich: URL izolatsiya middleware

### `apps/b2c/middleware.py`

```python
from django.shortcuts import redirect


B2B_PREFIXES = ("/admin-panel/", "/super-admin/", "/groups/", "/sessions/", "/tests/manage/")
B2C_PREFIXES = ("/b2c/",)


class UserTypeRouteMiddleware:
    """B2C user B2B URL'lariga va B2B user B2C URL'lariga kira olmasligini ta'minlaydi."""
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        if request.user.is_authenticated:
            path = request.path
            
            # B2C user B2B URL'larga kira olmaydi
            if request.user.is_b2c and any(path.startswith(p) for p in B2B_PREFIXES):
                return redirect("b2c:dashboard")
            
            # B2B user B2C URL'larga kira olmaydi (login/signup'dan tashqari)
            if request.user.is_b2b and any(path.startswith(p) for p in B2C_PREFIXES):
                if not (path.startswith("/b2c/login/") or path.startswith("/b2c/signup/")):
                    return redirect("/")
        
        return self.get_response(request)
```

`settings.py` MIDDLEWARE (AuthenticationMiddleware'dan keyin):
```python
MIDDLEWARE = [
    # ...
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "apps.b2c.middleware.UserTypeRouteMiddleware",
    # ...
]
```

**Mavjud B2B login view'iga** ham tekshiruv qo'shing: agar B2C user `/login/` orqali kirsa, rad eting va `/b2c/login/` ga yo'naltiring (`apps/users/views.py` login view ichida `user_type` tekshiruvi).

---

## 10-bosqich: Django admin

### `apps/b2c/admin.py`

```python
from django.contrib import admin
from .models import B2CProfile, B2CActivityEvent


@admin.register(B2CProfile)
class B2CProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "phone_number", "target_exam", "target_band", "exam_date", "weekly_goal_sessions", "signup_source", "created_at")
    list_filter = ("signup_source", "preferred_language", "target_exam", "has_completed_onboarding")
    search_fields = ("user__email", "user__first_name", "user__last_name", "phone_number")
    readonly_fields = ("created_at", "updated_at")


@admin.register(B2CActivityEvent)
class B2CActivityEventAdmin(admin.ModelAdmin):
    list_display = ("user", "section", "minutes_spent", "score", "activity_date")
    list_filter = ("section", "activity_date")
    search_fields = ("user__email",)
    date_hierarchy = "activity_date"
```

User admin'iga (agar custom UserAdmin bo'lsa) `user_type` filter va `list_display` ga qo'shing.

---

## 11-bosqich: Migration, collectstatic, test ma'lumot

```bash
python manage.py makemigrations
python manage.py migrate
python manage.py collectstatic --noinput
```

**Eslatma — STATIC_ROOT va MEDIA_ROOT:** Loyihada `settings.py` da bu maydonlar git push'dan keyin yo'qolib qoladigan recurring muammo bor. Qo'shganligingizni tekshiring:

```python
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_ROOT = BASE_DIR / "media"
```

**Test ma'lumot** — Activity widget'ni real ko'rinishda sinash uchun shell orqali bir nechta event yarating:

```bash
python manage.py shell
```

```python
from datetime import date, timedelta
from django.contrib.auth import get_user_model
from apps.b2c.models import B2CProfile, B2CActivityEvent

User = get_user_model()
u = User.objects.get(email="test@example.com")  # avval /b2c/signup/ orqali yarating

for i in range(20):
    d = date.today() - timedelta(days=i*2)
    B2CActivityEvent.objects.create(
        user=u, section="reading", minutes_spent=15 + (i % 5) * 10, score=6.0, activity_date=d
    )
```

Endi `/b2c/dashboard/` ga kirib heatmap, streak, KPI'larning to'g'ri ishlashini tekshiring.

---

## 12-bosqich: Manual test checklist

- [ ] `/` — ikkilangan landing, ikki CTA kartochka ishlaydi
- [ ] `/b2c/signup/` — yangi user yaratish ishlaydi, formada xatolar to'g'ri ko'rinadi
- [ ] Yangi user avtomatik login bo'lib `/b2c/dashboard/` ga tushadi
- [ ] Dashboardda: greeting, 4 KPI tile, section overview, getting started, activity widget — hammasi to'g'ri ko'rinadi (empty data bilan ham)
- [ ] Test event'lar qo'shilgandan keyin heatmap ranglari to'g'ri (intensivlik bandiga mos)
- [ ] Streak hisoblanadi (joriy + best)
- [ ] Haftalik maqsad progress bar to'g'ri foiz ko'rsatadi
- [ ] `/b2c/profile/` — barcha maydonlar saqlanadi
- [ ] Profil to'ldirilgach Getting Started "Profil to'ldirish" qadami ✓ bo'ladi va progress bar yangilanadi
- [ ] B2C user `/admin-panel/` ga kirsa — `/b2c/dashboard/` ga yo'naltiriladi
- [ ] B2B user `/b2c/dashboard/` ga kirsa — `/` ga yo'naltiriladi
- [ ] B2C user `/login/` orqali kirishga harakat qilsa — xatolik chiqib `/b2c/login/` ga yo'naltiriladi
- [ ] `/b2c/logout/` ishlaydi
- [ ] Login bo'lgan B2C user `/` ni ochsa — `/b2c/dashboard/` ga yo'naltiriladi
- [ ] Mobil ko'rinish (375px) — sidebar yashirinadi (`hidden lg:block`), asosiy bloklar stack bo'ladi

---

## 13-bosqich: Git commit va push (MAJBURIY)

```bash
git add .
git commit -m "ETAP 14: B2C foundation — user_type, signup/login, rich dashboard with custom activity widget, landing split, URL isolation"
git push origin main
```

**Eslatma:** Agar branch nomi `main` emas (`master`, `dev`) — to'g'ri branchni ishlating. Push avtomatik bajarilishi shart, lokal qoldirilmasin.

---

## Yakuniy checklist

- [ ] `User.user_type` field + data migration
- [ ] `B2CProfile` va `B2CActivityEvent` modellari
- [ ] `apps.b2c` `INSTALLED_APPS` da
- [ ] `apps/b2c/services/activity.py` to'liq ishlaydi (empty datada ham xatosiz)
- [ ] `/b2c/signup/`, `/b2c/login/`, `/b2c/logout/`, `/b2c/dashboard/`, `/b2c/profile/`
- [ ] Templates: `_auth_base.html`, `base_b2c.html`, `_sidebar.html`, `signup.html`, `login.html`, `dashboard.html`, `profile.html`, `_activity.html`
- [ ] Dashboard 4 ta blok: greeting+KPI, section overview, getting started, activity widget
- [ ] **Activity widget** — 4 KPI tile + 12-haftalik daqiqa-intensivlik heatmap + legend
- [ ] Ikkilangan landing `/`
- [ ] `UserTypeRouteMiddleware` ulangan
- [ ] Tailwind safelist yangilangan (kerak bo'lsa)
- [ ] STATIC_ROOT/MEDIA_ROOT `settings.py` da
- [ ] Django admin'da B2CProfile va B2CActivityEvent
- [ ] Migration fayllar git'da
- [ ] `git push origin <branch>` muvaffaqiyatli

---

## ETAP 15 oldidan eslatma

Keyingi ETAP'da `django-allauth` qo'shiladi:
- `/b2c/login/` va `/b2c/signup/` sahifalaridagi disabled "Google bilan kirish (SOON)" tugmasi aktivlashtiriladi
- Email mavjud B2B userga tegishli bo'lsa Google login rad etiladi
- Google orqali kirgan yangi userlarga `B2CProfile.signup_source=GOOGLE` bilan akkaunt yaratiladi va onboarding sahifasiga yo'naltiriladi

Hozirgi `B2CProfile.signup_source` field va login template'dagi disabled Google tugma joyi shu maqsad uchun saqlangan.
