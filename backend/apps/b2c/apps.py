from django.apps import AppConfig


class B2cConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.b2c'
    label = 'b2c'
    verbose_name = 'B2C (Individual users)'
