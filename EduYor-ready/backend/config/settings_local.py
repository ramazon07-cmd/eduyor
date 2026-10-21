"""Loopback development: existing local SQLite data and HTTP session cookies."""
from .settings import *  # noqa: F403

DEBUG = os.getenv('DJANGO_LOCAL_DEBUG','1') == '1'
ALLOWED_HOSTS = list(dict.fromkeys([*ALLOWED_HOSTS,'localhost','127.0.0.1','[::1]']))
CSRF_TRUSTED_ORIGINS = list(dict.fromkeys([*CSRF_TRUSTED_ORIGINS,'http://localhost:3000','http://127.0.0.1:3000']))
TEMPLATES = [{**entry,'DIRS':[BASE_DIR/'core/templates',*entry.get('DIRS',[])]} for entry in TEMPLATES]
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
SECURE_SSL_REDIRECT = False
SECURE_HSTS_SECONDS = 0
SECURE_PROXY_SSL_HEADER = None
if os.getenv('TEST_SQLITE') != '1':
    existing = DATABASES['default']
    # Preserve an existing SQLite filename when the user's base settings use one.
    local_name = existing['NAME'] if existing['ENGINE'] == 'django.db.backends.sqlite3' else BASE_DIR/'db.sqlite3'
    DATABASES = {'default':{'ENGINE':'django.db.backends.sqlite3','NAME':local_name,'OPTIONS':{'timeout':20}}}

