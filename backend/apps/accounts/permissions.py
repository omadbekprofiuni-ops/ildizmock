from rest_framework import permissions


class IsAdmin(permissions.BasePermission):
    """Access for users with role admin/super_admin or is_staff=True."""

    message = 'Admin huquqi talab qilinadi.'

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return user.role in ('admin', 'super_admin') or user.is_staff


class IsTeacher(permissions.BasePermission):
    """Access for users with role teacher (or admins for oversight)."""

    message = 'O‘qituvchi huquqi talab qilinadi.'

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return user.role in ('teacher', 'admin', 'super_admin')
