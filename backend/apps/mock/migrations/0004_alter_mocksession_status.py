# ETAP 12: 'cancelled' status uchun

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('mock', '0003_mockparticipant_user'),
    ]

    operations = [
        migrations.AlterField(
            model_name='mocksession',
            name='status',
            field=models.CharField(
                choices=[
                    ('waiting', 'Kutilmoqda'),
                    ('listening', 'Listening'),
                    ('reading', 'Reading'),
                    ('writing', 'Writing'),
                    ('finished', 'Tugagan'),
                    ('cancelled', 'Bekor qilingan'),
                ],
                default='waiting',
                max_length=20,
            ),
        ),
    ]
