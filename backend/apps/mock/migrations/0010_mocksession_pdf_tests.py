# Manually crafted: ikkita yangi nullable FK MockSession -> tests.PDFTest

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('mock', '0009_mocksession_archived_at_mocksession_is_archived_and_more'),
        ('tests', '0012_rename_tests_pdfat_test_id_student_idx_tests_pdfat_test_id_b65dd8_idx_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='mocksession',
            name='listening_pdf_test',
            field=models.ForeignKey(
                blank=True,
                limit_choices_to={'module': 'listening'},
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='+',
                to='tests.pdftest',
            ),
        ),
        migrations.AddField(
            model_name='mocksession',
            name='reading_pdf_test',
            field=models.ForeignKey(
                blank=True,
                limit_choices_to={'module': 'reading'},
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='+',
                to='tests.pdftest',
            ),
        ),
    ]
