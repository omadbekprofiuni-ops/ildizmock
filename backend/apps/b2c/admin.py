from django.contrib import admin

from .models import B2CProfile


@admin.register(B2CProfile)
class B2CProfileAdmin(admin.ModelAdmin):
    list_display = (
        'user', 'phone_number', 'preferred_language',
        'signup_source', 'has_completed_onboarding', 'created_at',
    )
    list_filter = ('signup_source', 'preferred_language', 'has_completed_onboarding')
    search_fields = (
        'user__username', 'user__email', 'user__first_name',
        'user__last_name', 'phone_number',
    )
    readonly_fields = ('created_at', 'updated_at')
    autocomplete_fields = ('user',)
