from django.contrib import admin

from .models import B2CActivityEvent, B2CProfile


@admin.register(B2CProfile)
class B2CProfileAdmin(admin.ModelAdmin):
    list_display = (
        'user', 'phone_number', 'target_exam', 'target_band', 'exam_date',
        'weekly_goal_sessions', 'preferred_language', 'signup_source',
        'has_completed_onboarding', 'created_at',
    )
    list_filter = ('signup_source', 'preferred_language', 'target_exam',
                   'has_completed_onboarding')
    search_fields = (
        'user__username', 'user__email', 'user__first_name',
        'user__last_name', 'phone_number',
    )
    readonly_fields = ('created_at', 'updated_at')
    autocomplete_fields = ('user',)


@admin.register(B2CActivityEvent)
class B2CActivityEventAdmin(admin.ModelAdmin):
    list_display = ('user', 'section', 'minutes_spent', 'score', 'activity_date')
    list_filter = ('section', 'activity_date')
    search_fields = ('user__email', 'user__username')
    date_hierarchy = 'activity_date'
    autocomplete_fields = ('user',)
