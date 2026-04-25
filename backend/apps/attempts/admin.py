from django.contrib import admin

from .models import Answer, Attempt


@admin.register(Attempt)
class AttemptAdmin(admin.ModelAdmin):
    list_display = ('user', 'test', 'status', 'raw_score', 'total_questions',
                    'band_score', 'started_at')
    list_filter = ('status', 'test__module')
    search_fields = ('user__phone', 'test__name')
    readonly_fields = ('started_at', 'submitted_at')


@admin.register(Answer)
class AnswerAdmin(admin.ModelAdmin):
    list_display = ('attempt', 'question', 'is_correct', 'points_earned', 'flagged')
    list_filter = ('is_correct', 'flagged')
