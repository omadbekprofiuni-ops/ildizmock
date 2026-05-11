# ETAP 14: B2C User Foundation (ildiz-testing.uz)

## Kontekst

ILDIZ Mock Platform hozirgacha **B2B model** asosida qurilgan: o'quv markazlar → guruhlar → o'qituvchilar → o'quvchilar. Endi platformaga **B2C variant** qo'shilmoqda — individual foydalanuvchilar mustaqil ro'yxatdan o'tib, testlarni kredit tizimi orqali ishlatadi.

**Bu ETAP-ning vazifasi:** B2C uchun foundation qurish — User modelini kengaytirish, B2C ro'yxat va login sahifalari, dashboard skeleton, URL izolatsiyasi, va landing sahifasini ikkilangan qilish. Google OAuth bu ETAP-da emas (ETAP 15-da). Hozircha B2C foydalanuvchi faqat **email + parol** orqali ro'yxatdan o'tadi va kiradi.

## Loyihaning hozirgi holati

- Django 5.x + PostgreSQL + Tailwind + Chart.js
- Mavjud apps: `users`, `tests`, `groups`, `sessions`, `practice`, `super_admin`, `admin_panel` (taxminiy nomlar — loyihadagi haqiqiy nomlarni saqlang)
- `SoftDeleteModel` base class mavjud
- Multi-tenant: o'quv markazlar bo'yicha izolatsiya
- Login URL: `/login/`, super-admin: `/super-admin/`, admin: `/admin-panel/`

## Maqsad

ETAP yakunida quyidagilar ishlashi kerak:

1. `User` modelida `user_type` field bo'lishi
2. Mavjud foydalanuvchilar to'g'ri tipga ko'chirilishi (data migration)
3. `/b2c/signup/` orqali yangi B2C user ro'yxatdan o'ta olishi
4. `/b2c/login/` orqali B2C user kira olishi (email + parol)
5. `/b2c/dashboard/` — B2C user uchun bosh sahifa
6. `/b2c/profile/` — profilni tahrirlash
7. B2C user `/admin-panel/`, `/super-admin/`, `/groups/` ga kira olmasligi
8. B2B user `/b2c/dashboard/` ga kira olmasligi
9. Bosh sahifa (`/`) **ikkilangan landing** ko'rsatishi: "O'quv markazlar uchun" va "Individual foydalanuvchilar uchun"
10. Hammasi git push qilingan bo'lishi

---

## 1-bosqich: User modelini kengaytirish

`apps/users/models.py` (yoki haqiqiy User modeli joylashgan fayl) ichida:

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

**Muhim:** `is_superuser=True` bo'lganlar `user_type=SUPERADMIN` ga, o'qituvchilar `B2B_TEACHER` ga, o'quvchilar `B2B_STUDENT` ga ko'chirilishi kerak.

Migration yaratish:
```bash
python manage.py makemigrations users
```

Keyin **data migration** yaratish — mavjud userlarni to'g'ri tipga o'tkazish:

```bash
python manage.py makemigrations --empty users --name set_user_types
```

Yaratilgan bo'sh migration ichida (loyihadagi haqiqiy User va Group/Student munosabatlariga moslab):

```python
def set_user_types(apps, schema_editor):
    User = apps.get_model("users", "User")
    
    # Superadminlar
    User.objects.filter(is_superuser=True).update(user_type="superadmin")
    
    # O'qituvchilar — loyihadagi haqiqiy belgiga moslab
    # masalan: User.objects.filter(is_staff=True, is_superuser=False).update(user_type="b2b_teacher")
    # yoki Teacher modeliga reverse relation orqali
    
    # O'quvchilar — StudentGroup-ga member bo'lganlar
    # masalan: User.objects.filter(studentgroup__isnull=False).distinct().update(user_type="b2b_student")
    
    # Boshqalari default holatda qoladi

def reverse_set_user_types(apps, schema_editor):
    pass

class Migration(migrations.Migration):
    dependencies = [("users", "<oldingi migration>")]
    operations = [migrations.RunPython(set_user_types, reverse_set_user_types)]
```

**Eslatma:** Cursor Agent haqiqiy modellar munosabatlarini o'qib, yuqoridagi taxminlarni loyiha kodiga moslab yozsin.

---

## 2-bosqich: Yangi app `apps/b2c/` yaratish

```bash
python manage.py startapp b2c apps/b2c
```

`settings.py` `INSTALLED_APPS` ga qo'shish:
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
    
    target_exam = models.CharField(max_length=50, blank=True)  # IELTS, CEFR va h.k. — kelajak uchun
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "B2C Profile"
        verbose_name_plural = "B2C Profiles"
    
    def __str__(self):
        return f"B2C: {self.user.email}"
```

### `apps/b2c/forms.py`

```python
from django import forms
from django.contrib.auth import get_user_model, password_validation
from django.core.exceptions import ValidationError

User = get_user_model()


class B2CSignupForm(forms.Form):
    first_name = forms.CharField(max_length=150, label="Ism")
    last_name = forms.CharField(max_length=150, label="Familiya")
    email = forms.EmailField(label="Email")
    password1 = forms.CharField(widget=forms.PasswordInput, label="Parol")
    password2 = forms.CharField(widget=forms.PasswordInput, label="Parolni takrorlang")
    
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
    email = forms.EmailField(label="Email")
    password = forms.CharField(widget=forms.PasswordInput, label="Parol")


class B2CProfileForm(forms.ModelForm):
    first_name = forms.CharField(max_length=150)
    last_name = forms.CharField(max_length=150)
    
    class Meta:
        model = None  # B2CProfile bilan to'ldiriladi
        fields = ["phone_number", "preferred_language", "target_exam"]
    
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
        ctx["profile"] = self.request.user.b2c_profile
        # ETAP 16-17-da kengaytiriladi: katalog preview, kredit balansi, recent results
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

Asosiy `config/urls.py` ga qo'shish:
```python
urlpatterns = [
    # ...
    path("b2c/", include("apps.b2c.urls", namespace="b2c")),
]
```

---

## 3-bosqich: Templates

Loyihaning hozirgi Tailwind dizayniga moslab yarating. Quyida minimal struktura:

### `apps/b2c/templates/b2c/base_b2c.html`

B2C uchun alohida base template. Mavjud B2B base'dan farqlanishi kerak (rang, navigatsiya, branding). Top bar: logo, "Katalog", "Kreditlar" (placeholder), "Profil", "Chiqish".

### `apps/b2c/templates/b2c/signup.html`

Email, parol formasi. Pastida: "Akkauntingiz bormi? **Kiring**" (link → `/b2c/login/`).

### `apps/b2c/templates/b2c/login.html`

Email + parol. **Hozircha** Google tugmasi yo'q (ETAP 15-da qo'shiladi) — lekin tugma joyini placeholder bilan qoldiring (commented yoki disabled). Pastida: "Akkauntingiz yo'qmi? **Ro'yxatdan o'ting**".

### `apps/b2c/templates/b2c/dashboard.html`

Salomlashish ("Salom, {{ user.first_name }}!"), tezkor harakatlar bloki (Katalogni ochish, Profilim, Kreditlarim — keyinchalik ishga tushadi). Hozircha placeholder kartochkalar.

### `apps/b2c/templates/b2c/profile.html`

Ism, familiya, telefon, til, target_exam tahrirlash formasi.

**Muhim:** Mavjud B2B templatelaridagi navbar/sidebar B2C sahifalarda chiqmasligi kerak — alohida `base_b2c.html` shu uchun.

---

## 4-bosqich: Bosh sahifa (landing split)

Mavjud `/` view'ini ikkilangan landing bilan almashtiring (yoki yangi template yarating):

`templates/landing.html`:
- Hero section: "ILDIZ Mock Platform — IELTS-ga tayyorgarlik" (yoki haqiqiy slogan)
- Ikki katta CTA kartochka:
  - **O'quv markazlar uchun**: "Guruh boshqaruvi, o'qituvchi paneli, batafsil hisobotlar" → `/login/`
  - **Individual foydalanuvchilar uchun**: "O'zingiz uchun tayyorlanmoqdamisiz? Hoziroq boshlang" → `/b2c/signup/`
- Pastda: features taqqoslash jadvali (ixtiyoriy)

Agar mavjud landing bo'lsa — uni yangilang, agar yo'q bo'lsa — `core/views.py` ga `LandingView` qo'shing.

---

## 5-bosqich: Login redirect logikasi

`settings.py`:

```python
LOGIN_URL = "/login/"  # mavjudligicha qoladi (B2B uchun)
LOGIN_REDIRECT_URL = "/"  # custom view orqali yo'naltiramiz
```

`apps/users/views.py` ichida mavjud login view ga (B2B login) qo'shimcha tekshiruv:

```python
# Login successful bo'lganda:
if user.is_b2c:
    logout(request)
    messages.error(request, "Individual foydalanuvchilar uchun /b2c/login/ orqali kiring.")
    return redirect("/b2c/login/")
elif user.user_type == "superadmin":
    return redirect("/super-admin/")
# va boshqalar...
```

B2C login view'ida (yuqorida ko'rsatilgan) teskari tekshiruv mavjud: B2B user `/b2c/login/` orqali kira olmaydi.

---

## 6-bosqich: Mavjud B2B URL'larini himoyalash

Mavjud `/admin-panel/`, `/super-admin/`, `/groups/`, `/sessions/` va boshqa B2B view'lariga `B2BUserRequiredMixin` qo'shing (yoki middleware yarating). Eng kam ishlatadigan yondashuv — middleware:

`apps/b2c/middleware.py`:

```python
from django.shortcuts import redirect


B2B_PREFIXES = ("/admin-panel/", "/super-admin/", "/groups/", "/sessions/", "/tests/manage/")
B2C_PREFIXES = ("/b2c/",)


class UserTypeRouteMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        if request.user.is_authenticated:
            path = request.path
            
            # B2C user B2B URL'larga kira olmaydi
            if request.user.is_b2c and any(path.startswith(p) for p in B2B_PREFIXES):
                return redirect("b2c:dashboard")
            
            # B2B user B2C URL'larga kira olmaydi (login va signup'dan tashqari)
            if request.user.is_b2b and any(path.startswith(p) for p in B2C_PREFIXES):
                if not (path.startswith("/b2c/login/") or path.startswith("/b2c/signup/")):
                    return redirect("/")
        
        return self.get_response(request)
```

`settings.py` `MIDDLEWARE` ga qo'shing (AuthenticationMiddleware'dan keyin):

```python
MIDDLEWARE = [
    # ...
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "apps.b2c.middleware.UserTypeRouteMiddleware",
    # ...
]
```

---

## 7-bosqich: Admin (Django admin)

`apps/b2c/admin.py`:

```python
from django.contrib import admin
from .models import B2CProfile


@admin.register(B2CProfile)
class B2CProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "phone_number", "preferred_language", "signup_source", "has_completed_onboarding", "created_at")
    list_filter = ("signup_source", "preferred_language", "has_completed_onboarding")
    search_fields = ("user__email", "user__first_name", "user__last_name", "phone_number")
    readonly_fields = ("created_at", "updated_at")
```

`User` admin'iga `user_type` filter qo'shing (agar UserAdmin custom bo'lsa).

---

## 8-bosqich: Migration va test

```bash
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser  # agar kerak bo'lsa
```

**Manual test checklist:**

1. `/` ochiladi — ikkilangan landing ko'rinadi
2. `/b2c/signup/` — yangi user yaratish ishlaydi
3. Yangi user avtomatik login bo'lib `/b2c/dashboard/` ga tushadi
4. `/b2c/profile/` — telefon, til, target_exam saqlanadi
5. B2C user `/admin-panel/` ga kirsa — `/b2c/dashboard/` ga yo'naltiriladi
6. Logout `/b2c/logout/`
7. B2B user (mavjud o'qituvchi) `/login/` orqali kirsa — eski oqim ishlaydi
8. B2B user qo'lda `/b2c/dashboard/` ga kirsa — `/` ga yo'naltiriladi
9. Bir xil email bilan B2C signup ikki marta — xatolik chiqadi
10. B2C user `/login/` orqali kirishga harakat qilsa — `/b2c/login/` ga yo'naltirilib xatolik chiqadi

---

## 9-bosqich: Production tayyorgarlik (Settings va Static)

**Eslatma:** Mavjud `STATIC_ROOT` va `MEDIA_ROOT` `settings.py` da git push'dan keyin yo'qolib turadi — `settings.py` o'zgartirishlardan keyin shularni qayta tekshiring va kerak bo'lsa qo'shing:

```python
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_ROOT = BASE_DIR / "media"
```

`collectstatic` ishga tushiring:
```bash
python manage.py collectstatic --noinput
```

---

## 10-bosqich: Git commit va push (MAJBURIY)

```bash
git add .
git commit -m "ETAP 14: B2C user foundation — user_type, signup/login, dashboard, URL isolation, landing split"
git push origin main
```

**Eslatma:** Agar branch nomi `main` emas bo'lsa (`master`, `dev` va h.k.) — to'g'ri branchni ishlating. Push avtomatik bajarilishi shart, lokal qoldirilmasin.

---

## Yakuniy checklist

- [ ] `User.user_type` field qo'shilgan va data migration ishlagan
- [ ] `B2CProfile` modeli yaratilgan
- [ ] `apps.b2c` app `INSTALLED_APPS` da
- [ ] `/b2c/signup/`, `/b2c/login/`, `/b2c/logout/`, `/b2c/dashboard/`, `/b2c/profile/` ishlaydi
- [ ] `base_b2c.html` alohida dizayn bilan
- [ ] `/` ikkilangan landing ko'rsatadi
- [ ] `UserTypeRouteMiddleware` B2B va B2C URL'larini ajratadi
- [ ] Django admin'da B2CProfile ko'rinadi
- [ ] STATIC_ROOT/MEDIA_ROOT `settings.py` da saqlanib turibdi
- [ ] Migration fayllar git'ga qo'shilgan
- [ ] `git push origin <branch>` muvaffaqiyatli bajarilgan

---

## ETAP 15 oldidan eslatma

Keyingi ETAP'da `django-allauth` qo'shiladi va `/b2c/login/` sahifasidagi "Google bilan kirish" tugmasi ishga tushiriladi. Hozirgi `B2CProfile.signup_source` field va `B2CLoginForm` allauth bilan integratsiyaga tayyor — strukturani buzmang.
