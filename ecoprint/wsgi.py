"""
WSGI config for ecoprint project.
"""

import os
from django.core.wsgi import get_wsgi_application

# ИСПРАВЛЕНИЕ:
# Указываем на твой единый settings.py, а не на 'ecoprint.settings.prod'
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ecoprint.settings')

application = get_wsgi_application()