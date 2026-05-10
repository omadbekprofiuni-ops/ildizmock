"""DEFINITIVE FIX — audio_finished_parts maydoni.

audio_played_parts (mavjud) endi "audio boshlangan" semantikasiga ega bo'ladi;
audio_finished_parts (yangi) "audio to'liq tugagan" qiymatlarini saqlaydi.
Refresh-safe tekshirish ikkalasining birlashmasi (union) orqali bo'ladi.
"""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('mock', '0012_participant_audio_played_parts'),
    ]

    operations = [
        migrations.AddField(
            model_name='mockparticipant',
            name='audio_finished_parts',
            field=models.JSONField(
                blank=True,
                default=list,
                help_text='List of part orders whose audio fully ENDED: [1, 2, ...]',
            ),
        ),
    ]
