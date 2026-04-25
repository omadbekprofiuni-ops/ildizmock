from django.db import migrations


def rename_roles_forward(apps, schema_editor):
    User = apps.get_model('accounts', 'User')
    User.objects.filter(role='super_admin').update(role='superadmin')
    User.objects.filter(role='admin').update(role='org_admin')


def rename_roles_backward(apps, schema_editor):
    User = apps.get_model('accounts', 'User')
    User.objects.filter(role='superadmin').update(role='super_admin')
    User.objects.filter(role='org_admin').update(role='admin')


class Migration(migrations.Migration):
    dependencies = [
        ('accounts', '0003_user_organization_alter_user_role_and_more'),
    ]

    operations = [
        migrations.RunPython(rename_roles_forward, rename_roles_backward),
    ]
