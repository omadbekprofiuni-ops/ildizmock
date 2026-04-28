# ETAP 13: Speaking 4 kriteriya

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('mock', '0004_alter_mocksession_status'),
    ]

    operations = [
        migrations.AddField(
            model_name='mockparticipant',
            name='speaking_fluency',
            field=models.DecimalField(
                blank=True, decimal_places=1,
                help_text='Fluency and Coherence (0–9)',
                max_digits=3, null=True,
            ),
        ),
        migrations.AddField(
            model_name='mockparticipant',
            name='speaking_lexical',
            field=models.DecimalField(
                blank=True, decimal_places=1,
                help_text='Lexical Resource (0–9)',
                max_digits=3, null=True,
            ),
        ),
        migrations.AddField(
            model_name='mockparticipant',
            name='speaking_grammar',
            field=models.DecimalField(
                blank=True, decimal_places=1,
                help_text='Grammatical Range and Accuracy (0–9)',
                max_digits=3, null=True,
            ),
        ),
        migrations.AddField(
            model_name='mockparticipant',
            name='speaking_pronunciation',
            field=models.DecimalField(
                blank=True, decimal_places=1,
                help_text='Pronunciation (0–9)',
                max_digits=3, null=True,
            ),
        ),
    ]
