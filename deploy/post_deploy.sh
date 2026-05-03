#!/usr/bin/env bash
# Server'ga `git pull` qilingandan keyin ishga tushiring.
#
#   cd /home/ildiz/ildizmock && bash deploy/post_deploy.sh
#
# Nima qiladi:
#   1) backend dependency'larni yangilaydi (requirements.txt o'zgarsa)
#   2) DB migratsiyasini yuritadi  (← "Xatolik yuz berdi" muammosini hal qiladi)
#   3) Default global testlarni seed qiladi (idempotent)
#   4) Static fayllarni yig'adi
#   5) Gunicorn'ni restart qiladi (systemd yoki supervisor orqali)

set -euo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-/home/ildiz/ildizmock}"
cd "$PROJECT_ROOT/backend"

# 1) venv
if [ -d venv ]; then
  # shellcheck disable=SC1091
  source venv/bin/activate
fi

# 2) deps
pip install -r requirements.txt --quiet

# 3) migrate (eng muhimi — yangi ustunlar shu yerda qo'shiladi)
python manage.py migrate --noinput

# 4) seed default global tests (idempotent — eski testlarni tozalab qaytadan yaratadi)
python manage.py seed_default_tests || echo "seed_default_tests skipped"

# 5) static
python manage.py collectstatic --noinput

# 6) restart — siz qaysi process manager ishlatishingizga qarab birini tanlang
if systemctl is-active --quiet gunicorn 2>/dev/null; then
  sudo systemctl restart gunicorn
elif command -v supervisorctl >/dev/null 2>&1; then
  sudo supervisorctl restart ildizmock || true
else
  echo "WARN: gunicorn'ni qo'lda restart qiling."
fi

echo "OK — deploy yakunlandi."
