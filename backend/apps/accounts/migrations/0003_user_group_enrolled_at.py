# ETAP 11: User.group + User.enrolled_at

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0002_initial'),
        ('organizations', '0005_studentgroup'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='group',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='members', to='organizations.studentgroup'),
        ),
        migrations.AddField(
            model_name='user',
            name='enrolled_at',
            field=models.DateField(blank=True, null=True),
        ),
    ]
