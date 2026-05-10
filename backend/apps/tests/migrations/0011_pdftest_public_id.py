import uuid

from django.db import migrations, models


def backfill_public_id(apps, schema_editor):
    PDFTest = apps.get_model('tests', 'PDFTest')
    for test in PDFTest.objects.all():
        if not test.public_id:
            test.public_id = uuid.uuid4()
            test.save(update_fields=['public_id'])


class Migration(migrations.Migration):

    dependencies = [
        ('tests', '0010_pdftestattempt_unique_test_student'),
    ]

    operations = [
        migrations.AddField(
            model_name='pdftest',
            name='public_id',
            field=models.UUIDField(
                default=uuid.uuid4,
                editable=False,
                db_index=True,
                null=True,
            ),
        ),
        migrations.RunPython(backfill_public_id, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='pdftest',
            name='public_id',
            field=models.UUIDField(
                default=uuid.uuid4,
                editable=False,
                unique=True,
            ),
        ),
    ]
