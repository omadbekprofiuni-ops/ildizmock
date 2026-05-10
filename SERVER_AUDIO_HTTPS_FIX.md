# SERVER AUDIO FIX - HTTPS MIXED CONTENT

**PROBLEM:** Production server blocks audio because of mixed content
- Frontend: https://ildiz-testing.uz (HTTPS)
- Audio URL: http://207.180.226.230/media/... (HTTP)
- Browser: BLOCKED! ❌

**SOLUTION:** Configure Django + Nginx to serve media via HTTPS

---

## 🔧 FIX 1: Nginx Configuration (CRITICAL)

**File:** `/etc/nginx/sites-available/ildizmock` (or similar)

**Add these headers and media location:**

```nginx
server {
    listen 80;
    server_name ildiz-testing.uz 207.180.226.230;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name ildiz-testing.uz 207.180.226.230;
    
    # SSL certificates
    ssl_certificate /path/to/ssl/cert.pem;
    ssl_certificate_key /path/to/ssl/key.pem;
    
    # CRITICAL: Proxy headers for Django
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;  # ← THIS IS CRITICAL!
    
    # Django application
    location / {
        proxy_pass http://127.0.0.1:8000;  # or Unix socket
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;  # ← REPEAT HERE
    }
    
    # CRITICAL: Serve media files via Nginx
    location /media/ {
        alias /home/jasmina/mock_exam/backend/media/;  # ← YOUR PATH
        expires 30d;
        add_header Cache-Control "public, immutable";
        
        # CORS headers if needed
        add_header Access-Control-Allow-Origin *;
    }
    
    # Static files
    location /static/ {
        alias /home/jasmina/mock_exam/backend/staticfiles/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

**Apply changes:**
```bash
# Test config
sudo nginx -t

# If OK, reload
sudo systemctl reload nginx
```

---

## 🔧 FIX 2: Django Settings (Production)

**File:** `backend/config/settings.py`

**Ensure these settings:**

```python
import os
from decouple import config

DEBUG = config('DJANGO_DEBUG', default=False, cast=bool)

ALLOWED_HOSTS = config(
    'ALLOWED_HOSTS', 
    default='ildiz-testing.uz,207.180.226.230',
    cast=Csv()
)

# HTTPS/SSL Settings
if not DEBUG:
    # Trust X-Forwarded-Proto header from Nginx
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    
    # Force HTTPS
    SECURE_SSL_REDIRECT = True
    
    # Cookie security
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    
    # HSTS
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

# Media files
MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')
```

**File:** `backend/.env`

```bash
DJANGO_DEBUG=False
ALLOWED_HOSTS=ildiz-testing.uz,207.180.226.230
SECURE_SSL_REDIRECT=True
```

**Restart services:**
```bash
sudo supervisorctl restart ildizmock
# or
sudo systemctl restart gunicorn
```

---

## 🔧 FIX 3: Serializer - Return HTTPS URL

**File:** `backend/apps/tests/serializers.py`

```python
class ListeningPartSerializer(serializers.ModelSerializer):
    audio_url = serializers.SerializerMethodField()
    
    class Meta:
        model = ListeningPart
        fields = ['id', 'part_number', 'audio_url', 'duration', 'questions']
    
    def get_audio_url(self, obj):
        """Return full HTTPS URL for audio file"""
        if obj.audio_file:
            request = self.context.get('request')
            if request:
                # Build absolute URI (will use HTTPS if X-Forwarded-Proto is set)
                return request.build_absolute_uri(obj.audio_file.url)
            
            # Fallback - force HTTPS in production
            from django.conf import settings
            if not settings.DEBUG:
                return f"https://ildiz-testing.uz{obj.audio_file.url}"
            return obj.audio_file.url
        return None
```

---

## ✅ VERIFICATION STEPS

### STEP 1: Check Nginx config

```bash
# SSH to server
ssh user@207.180.226.230

# Check Nginx config
sudo cat /etc/nginx/sites-available/ildizmock | grep -A 5 "X-Forwarded-Proto"
# Should show: proxy_set_header X-Forwarded-Proto $scheme;

# Check media location
sudo cat /etc/nginx/sites-available/ildizmock | grep -A 3 "/media/"
# Should show: location /media/ { alias ... }

# Test config
sudo nginx -t
```

### STEP 2: Check Django settings

```bash
cd /home/jasmina/mock_exam/backend

# Check DEBUG mode
grep "DEBUG" .env
# Should show: DJANGO_DEBUG=False

# Check SECURE_PROXY_SSL_HEADER
grep "SECURE_PROXY_SSL_HEADER" config/settings.py
# Should exist and be enabled when DEBUG=False
```

### STEP 3: Test audio URL

```bash
# From server
curl -I https://ildiz-testing.uz/media/listening_audios/part1.mp3
# Should return: 200 OK

# Check what URL backend returns
curl https://ildiz-testing.uz/api/v1/student/listening-test/1/ | grep audio_url
# Should show: "audio_url": "https://ildiz-testing.uz/media/..."
#             NOT "http://207.180.226.230/media/..."
```

### STEP 4: Browser test

```
1. Open: https://ildiz-testing.uz
2. Navigate to Listening Test
3. Press F12 → Network tab
4. Filter: "media" or ".mp3"
5. Click PLAY
6. Check request:
   ✅ URL should be: https://ildiz-testing.uz/media/...
   ✅ Status: 200 OK
   ✅ No "blocked:mixed-content" error
```

---

## 🚨 QUICK DIAGNOSTIC

**Run these on server:**

```bash
# 1. Check if Nginx has X-Forwarded-Proto
sudo nginx -T 2>/dev/null | grep -i "x-forwarded-proto"
# Should show: proxy_set_header X-Forwarded-Proto $scheme;

# 2. Check if media folder accessible
ls -la /home/jasmina/mock_exam/backend/media/listening_audios/
# Should show .mp3 files

# 3. Check Django DEBUG mode
cd /home/jasmina/mock_exam/backend
python manage.py shell -c "from django.conf import settings; print(f'DEBUG={settings.DEBUG}')"
# Should show: DEBUG=False

# 4. Check if Django detects HTTPS
python manage.py shell -c "
from django.test import RequestFactory
from django.conf import settings
rf = RequestFactory()
req = rf.get('/', HTTP_X_FORWARDED_PROTO='https')
print(f'Is secure: {req.is_secure()}')
"
# Should show: Is secure: True
```

---

## 📋 COMPLETE FIX CHECKLIST

```bash
# ON SERVER:

# 1. Update Nginx config
sudo nano /etc/nginx/sites-available/ildizmock
# Add: proxy_set_header X-Forwarded-Proto $scheme;
# Add: location /media/ { alias /path/to/media/; }

# 2. Test and reload Nginx
sudo nginx -t
sudo systemctl reload nginx

# 3. Update .env
cd /home/jasmina/mock_exam/backend
nano .env
# Set: DJANGO_DEBUG=False

# 4. Restart Django
sudo supervisorctl restart ildizmock
# or: sudo systemctl restart gunicorn

# 5. Test audio URL
curl https://ildiz-testing.uz/media/listening_audios/part1.mp3
# Should work!

# 6. Test in browser
# Go to: https://ildiz-testing.uz
# Listening test → PLAY → Should work!
```

---

## 🎯 EXPECTED RESULTS

**BEFORE (Broken):**
```
Frontend: https://ildiz-testing.uz
Audio URL: http://207.180.226.230/media/part1.mp3
Browser: BLOCKED (mixed content) ❌
Console: "Mixed Content: ... was loaded over HTTPS..."
```

**AFTER (Fixed):**
```
Frontend: https://ildiz-testing.uz
Audio URL: https://ildiz-testing.uz/media/part1.mp3
Browser: ALLOWED ✅
Console: No errors ✅
Audio: PLAYS! 🎧✅
```

---

## 💡 ALTERNATIVE: If SSL certificate issues

**If you don't have SSL certificate yet:**

**Option 1 - Get free Let's Encrypt certificate:**
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d ildiz-testing.uz
```

**Option 2 - Use HTTP for now (NOT RECOMMENDED):**
```python
# Temporary fix - backend/config/settings.py
SECURE_SSL_REDIRECT = False  # Allow HTTP
```

---

**START WITH NGINX CONFIG FIX - MOST CRITICAL!**

Report back with results! 🚀
