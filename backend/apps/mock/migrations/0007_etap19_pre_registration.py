"""ETAP 19 — pre-registered participants + link expiry + has_joined flag.

Mavjud (legacy) participantlar uchun has_joined=True va claimed_at=joined_at
qilib backfill qilinadi: ular eski join_view oqimida ism kiritib qo'shilishgan.
"""

from django.db import migrations, models


def backfill_has_joined(apps, schema_editor):
    MockParticipant = apps.get_model('mock', 'MockParticipant')
    MockParticipant.objects.update(has_joined=True)
    # claimed_at bo'lmagan eski rowlar uchun joined_at ni nusxa qilamiz
    for p in MockParticipant.objects.filter(claimed_at__isnull=True):
        p.claimed_at = p.joined_at
        p.save(update_fields=['claimed_at'])


def reverse_noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('mock', '0006_mockparticipant_speaking_audio_and_more'),
    ]

    operations = [
        # MockSession yangi maydonlari
        migrations.AddField(
            model_name='mocksession',
            name='link_expires_at',
            field=models.DateTimeField(
                blank=True, null=True,
                help_text='Linkning amal qilish muddati (bo\'sh bo\'lsa cheksiz)',
            ),
        ),
        migrations.AddField(
            model_name='mocksession',
            name='allow_late_join',
            field=models.BooleanField(
                default=True,
                help_text='Sessiya boshlangandan keyin ham qo\'shilishga ruxsat',
            ),
        ),
        migrations.AddField(
            model_name='mocksession',
            name='allow_guests',
            field=models.BooleanField(
                default=True,
                help_text='Ro\'yxatda yo\'q talabalar ham ism kiritib qo\'shilsinmi',
            ),
        ),
        # MockParticipant yangi maydonlari
        migrations.AddField(
            model_name='mockparticipant',
            name='has_joined',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='mockparticipant',
            name='claimed_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        # Mavjud rowlarni backfill — eski oqimda ular allaqachon "joined"
        migrations.RunPython(backfill_has_joined, reverse_noop),
    ]
