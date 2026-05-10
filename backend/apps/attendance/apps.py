from django.apps import AppConfig


class AttendanceConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.attendance'
    verbose_name = 'Attendance'

    def ready(self) -> None:
        # ETAP 28 — signal handler'larni ulaymiz.
        from . import signals  # noqa: F401
