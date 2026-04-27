from django.db import migrations


ROLE_MAP = {
    'org_admin': 'admin',
    'teacher': 'teacher',
    'student': 'student',
}


def seed_memberships(apps, schema_editor):
    """Existing User.organization → OrganizationMembership rows."""
    User = apps.get_model('accounts', 'User')
    Membership = apps.get_model('organizations', 'OrganizationMembership')

    for user in User.objects.exclude(organization__isnull=True):
        role = ROLE_MAP.get(user.role)
        if not role:
            continue
        Membership.objects.get_or_create(
            user=user, organization=user.organization, role=role,
        )


def unseed_memberships(apps, schema_editor):
    Membership = apps.get_model('organizations', 'OrganizationMembership')
    Membership.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('organizations', '0003_organizationmembership'),
        ('accounts', '0002_initial'),
    ]

    operations = [
        migrations.RunPython(seed_memberships, unseed_memberships),
    ]
