#!/bin/bash
# Deploy + diagnose script — server'da bitta komanda bilan barchasini yangilaydi
# va testlar holatini ko'rsatadi.
#
# Foydalanish (server'da):
#   bash /home/ildiz/ildizmock/scripts/deploy_and_diagnose.sh

set -e
cd /home/ildiz/ildizmock

echo "═══════════════════════════════════════════════════"
echo "  ILDIZ Mock — Deploy + Diagnose"
echo "═══════════════════════════════════════════════════"

# 1. Eng so'nggi kodni tortish
echo
echo "→ [1/7] Git pull..."
git pull origin main

# 2. Backend deps
echo
echo "→ [2/7] Backend dependencies..."
cd backend
source venv/bin/activate
pip install -r requirements.txt --break-system-packages -q

# 3. Migrationlar (yetishmayotgan jadvallar yaratiladi)
echo
echo "→ [3/7] Migrationlar..."
python manage.py migrate 2>&1 | grep -E "Applying|OK|FAIL|ERROR" || echo "  (no new migrations)"

# 4. Eski testlar status'ini sinxronlash (is_published=True bo'lganlarni
#    status='published'ga olib o'tadi)
echo
echo "→ [4/7] sync_test_status (testlar holati to'g'rilanadi)..."
python manage.py sync_test_status

# 5. Tashxis — testlar holati
echo
echo "→ [5/7] Diagnostika — markazda nima bor?"
python manage.py shell <<'PYEOF'
from apps.tests.models import Test
from apps.organizations.models import Organization
from django.db.models import Q

for org in Organization.objects.filter(status='active'):
    tests = Test.objects.filter(organization=org, is_deleted=False)
    if not tests.exists():
        continue
    pub_q = Q(status='published') | Q(is_published=True)
    pub = tests.filter(pub_q).count()
    draft = tests.exclude(pub_q).count()
    print(f"  [{org.slug}]  jami={tests.count()}, published={pub}, draft={draft}")
    if draft > 0:
        print(f"     ⚠ {draft} ta draft test bor — admin Tests sahifasida 'Nashr' bosishi kerak")
PYEOF

# 6. Static + frontend
echo
echo "→ [6/7] Static + frontend build..."
python manage.py collectstatic --noinput >/dev/null
cd ../frontend
npm install --silent
npm run build 2>&1 | tail -3

# 7. Restart
echo
echo "→ [7/7] Restart..."
sudo supervisorctl restart ildizmock
sudo systemctl reload nginx

echo
echo "═══════════════════════════════════════════════════"
echo "  ✓ Deploy yakunlandi"
echo "═══════════════════════════════════════════════════"
echo
echo "Endi nima qilish kerak:"
echo "  1. Brauzer'da Ctrl+Shift+R bilan hard refresh qiling"
echo "  2. Tests sahifasiga kiring — agar draft testlar bo'lsa yashil"
echo "     'Nashr' tugmasini bosing"
echo "  3. Mock sessions → + New session → endi testlar ko'rinishi kerak"
echo
