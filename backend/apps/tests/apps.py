from django.apps import AppConfig


class TestsConfig(AppConfig):
    """IELTS Test bazasi (Reading/Listening/Writing/Speaking).

    ⚠️  Ma'lum nomdan kelib chiqqan muammo:
    App nomi `tests` Django'ning standart `manage.py test` discovery'si bilan
    to'qnashishi mumkin. Test running uchun `pytest` ishlatishni tavsiya
    qilamiz (requirements.txt'da bor):

        pytest                          # to'liq suite
        pytest apps/attendance/         # bitta app

    Kelajakda renaming ko'zda tutilgan: `apps/tests` → `apps/exams`.
    Bu jarayon:
        1. Folder rename: apps/tests → apps/exams
        2. Barcha import yo'llari almashtiriladi
        3. db_table'lar bir xil — migration kerak emas (faqat AppConfig.label)
        4. INSTALLED_APPS yangilanadi
        5. URLs ro'yxati ham yangilanadi
    Hozircha legacy nom saqlanadi.
    """

    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.tests'
    label = 'tests'
    verbose_name = 'Tests'
