# Manual migration: bir talaba — bir PDFTest urinish.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tests', '0009_pdftest_pdftestattempt'),
    ]

    operations = [
        migrations.AlterUniqueTogether(
            name='pdftestattempt',
            unique_together={('test', 'student')},
        ),
        migrations.AddIndex(
            model_name='pdftestattempt',
            index=models.Index(
                fields=['test', 'student'],
                name='tests_pdfat_test_id_student_idx',
            ),
        ),
    ]
