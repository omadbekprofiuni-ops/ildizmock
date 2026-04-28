# ETAP 11: StudentGroup model

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('organizations', '0004_seed_memberships_from_users'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='StudentGroup',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(help_text='Misol: IELTS 7.0, Group A, Beginner 1', max_length=100)),
                ('description', models.TextField(blank=True, default='')),
                ('target_band_score', models.DecimalField(blank=True, decimal_places=1, help_text='Maqsad band score (6.5, 7.0, 7.5...)', max_digits=3, null=True)),
                ('class_schedule', models.CharField(blank=True, default='', max_length=200)),
                ('start_date', models.DateField(blank=True, null=True)),
                ('end_date', models.DateField(blank=True, null=True)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='student_groups', to='organizations.organization')),
                ('teacher', models.ForeignKey(blank=True, limit_choices_to={'role': 'teacher'}, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='teaching_groups', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
                'unique_together': {('organization', 'name')},
            },
        ),
    ]
