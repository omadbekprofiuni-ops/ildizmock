from django.contrib import admin

from .models import Passage, Question, Test


class QuestionInline(admin.StackedInline):
    model = Question
    extra = 0
    fields = ('order', 'question_type', 'text', 'options', 'correct_answer',
              'acceptable_answers', 'group_id', 'instruction', 'points')


class PassageInline(admin.StackedInline):
    model = Passage
    extra = 0
    show_change_link = True


@admin.register(Test)
class TestAdmin(admin.ModelAdmin):
    list_display = ('name', 'module', 'test_type', 'difficulty', 'is_published', 'created_at')
    list_filter = ('module', 'test_type', 'is_published')
    search_fields = ('name',)
    inlines = [PassageInline]


@admin.register(Passage)
class PassageAdmin(admin.ModelAdmin):
    list_display = ('title', 'test', 'part_number', 'order')
    list_filter = ('test__module',)
    inlines = [QuestionInline]


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ('order', 'passage', 'question_type', 'group_id', 'points')
    list_filter = ('question_type', 'passage__test__module')
    search_fields = ('text',)
