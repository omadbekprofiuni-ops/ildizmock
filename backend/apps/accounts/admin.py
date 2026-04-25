from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.forms import UserChangeForm, UserCreationForm

from .models import User


class _CreationForm(UserCreationForm):
    class Meta:
        model = User
        fields = ('phone', 'first_name', 'last_name', 'role')


class _ChangeForm(UserChangeForm):
    class Meta:
        model = User
        fields = '__all__'


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    form = _ChangeForm
    add_form = _CreationForm

    list_display = ('phone', 'first_name', 'last_name', 'role', 'is_staff', 'created_at')
    list_filter = ('role', 'is_staff', 'is_superuser', 'is_active')
    search_fields = ('phone', 'first_name', 'last_name')
    ordering = ('phone',)
    readonly_fields = ('created_at', 'last_login')

    fieldsets = (
        (None, {'fields': ('phone', 'password')}),
        ('Personal', {'fields': ('first_name', 'last_name', 'telegram_id',
                                 'target_band', 'language')}),
        ('Permissions', {'fields': ('role', 'is_active', 'is_staff', 'is_superuser',
                                    'groups', 'user_permissions')}),
        ('Dates', {'fields': ('last_login', 'created_at')}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('phone', 'password1', 'password2', 'first_name',
                       'last_name', 'role'),
        }),
    )
