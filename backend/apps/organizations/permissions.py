from rest_framework.permissions import BasePermission


class IsSuperAdmin(BasePermission):
    message = 'Faqat superadmin uchun.'

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.role == 'superadmin'
        )


class IsOrgAdmin(BasePermission):
    """Org admin yoki superadmin."""

    message = 'Markaz administratori huquqi talab qilinadi.'

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        return request.user.role in ('superadmin', 'org_admin')


class IsOrgMember(BasePermission):
    """Object-level — user obj.organization ga tegishlimi."""

    def has_object_permission(self, request, view, obj):
        if request.user.is_authenticated and request.user.role == 'superadmin':
            return True
        org_id = getattr(obj, 'organization_id', None)
        return (
            org_id is not None
            and getattr(request.user, 'organization_id', None) == org_id
        )


class IsTeacherInOrg(BasePermission):
    message = 'Ustoz huquqi talab qilinadi.'

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        return request.user.role in ('teacher', 'org_admin', 'superadmin')
