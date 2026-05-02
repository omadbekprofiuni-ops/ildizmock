"""ETAP 20 deploy — Gunicorn production config.

Server: /home/ildiz/ildizmock/
Run: gunicorn -c deploy/gunicorn_config.py config.wsgi:application
Yoki Supervisord/Systemd orqali ishga tushiring.
"""

import multiprocessing
import os

PROJECT_ROOT = os.environ.get('PROJECT_ROOT', '/home/ildiz/ildizmock')

bind = os.environ.get(
    'GUNICORN_BIND',
    f'unix:{PROJECT_ROOT}/gunicorn.sock',
)
workers = int(os.environ.get(
    'GUNICORN_WORKERS',
    multiprocessing.cpu_count() * 2 + 1,
))
worker_class = 'sync'
max_requests = 1000
max_requests_jitter = 100
timeout = 30
keepalive = 2

# Logs
errorlog = os.environ.get('GUNICORN_ERRORLOG', f'{PROJECT_ROOT}/logs/gunicorn-error.log')
accesslog = os.environ.get('GUNICORN_ACCESSLOG', f'{PROJECT_ROOT}/logs/gunicorn-access.log')
loglevel = os.environ.get('GUNICORN_LOGLEVEL', 'info')

# Security
limit_request_line = 8192
limit_request_fields = 100
