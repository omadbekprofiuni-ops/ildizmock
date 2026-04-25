from rest_framework import permissions


class IsAdmin(permissions.BasePermission):
    """Access for users with role superadmin / org_admin (or is_staff)."""

    message = 'Admin huquqi talab qilinadi.'

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return user.role in ('superadmin', 'org_admin') or user.is_staff


class IsTeacher(permissions.BasePermission):
    """Access for role=teacher (org admins / superadmin allowed too)."""

    message = 'O‘qituvchi huquqi talab qilinadi.'

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return user.role in ('teacher', 'org_admin', 'superadmin')
