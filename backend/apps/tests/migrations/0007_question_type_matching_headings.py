# Add matching_headings + sentence_completion to Question.TYPE_CHOICES

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tests', '0006_test_soft_delete'),
    ]

    operations = [
        migrations.AlterField(
            model_name='question',
            name='question_type',
            field=models.CharField(
                choices=[
                    ('mcq', 'Multiple Choice'),
                    ('tfng', 'True/False/Not Given'),
                    ('ynng', 'Yes/No/Not Given'),
                    ('fill', 'Fill in the Blank'),
                    ('gap_fill', 'Gap Fill'),
                    ('matching', 'Matching'),
                    ('matching_headings', 'Matching Headings'),
                    ('short_answer', 'Short Answer'),
                    ('form_completion', 'Form Completion'),
                    ('map_labeling', 'Map Labeling'),
                    ('summary_completion', 'Summary Completion'),
                    ('sentence_completion', 'Sentence Completion'),
                ],
                max_length=30,
            ),
        ),
    ]
