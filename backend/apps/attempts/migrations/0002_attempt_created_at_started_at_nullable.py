# Adds created_at and makes started_at nullable so the timer only begins
# when the student explicitly starts the test (after audio preload).

import django.utils.timezone
from django.db import migrations, models


def copy_started_at_to_created_at(apps, schema_editor):
    Attempt = apps.get_model('attempts', 'Attempt')
    for attempt in Attempt.objects.all().only('id', 'started_at'):
        attempt.created_at = attempt.started_at
        attempt.save(update_fields=['created_at'])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('attempts', '0001_initial'),
    ]

    operations = [
        # 1) Add created_at as nullable so we can backfill from started_at
        migrations.AddField(
            model_name='attempt',
            name='created_at',
            field=models.DateTimeField(null=True, blank=True),
        ),
        # 2) Backfill created_at from existing started_at values
        migrations.RunPython(copy_started_at_to_created_at, noop_reverse),
        # 3) Lock created_at down: required, auto_now_add for new rows
        migrations.AlterField(
            model_name='attempt',
            name='created_at',
            field=models.DateTimeField(
                auto_now_add=True, default=django.utils.timezone.now,
            ),
            preserve_default=False,
        ),
        # 4) Make started_at nullable (no longer auto_now_add)
        migrations.AlterField(
            model_name='attempt',
            name='started_at',
            field=models.DateTimeField(null=True, blank=True),
        ),
        # 5) Default ordering follows created_at now (started_at can be null)
        migrations.AlterModelOptions(
            name='attempt',
            options={'ordering': ['-created_at']},
        ),
    ]
