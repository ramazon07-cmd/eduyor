"""Single HTTPS origin, PostgreSQL, and persistent media/static directories."""
from urllib.parse import urlsplit
from .settings import *  # noqa: F403

DEBUG = False
TEMPLATES = [{**entry,'DIRS':[BASE_DIR/'core/templates',*entry.get('DIRS',[])]} for entry in TEMPLATES]
if len(SECRET_KEY) < 50 or len(set(SECRET_KEY)) < 5 or SECRET_KEY.startswith('django-insecure-'):
    raise ImproperlyConfigured('Production requires a strong DJANGO_SECRET_KEY of at least 50 characters.')
ALLOWED_HOSTS = [value.strip() for value in os.getenv('DJANGO_ALLOWED_HOSTS','').split(',') if value.strip()]
if not ALLOWED_HOSTS or '*' in ALLOWED_HOSTS:
    raise ImproperlyConfigured('Set explicit DJANGO_ALLOWED_HOSTS for production.')
CSRF_TRUSTED_ORIGINS = [value.strip() for value in os.getenv('CSRF_TRUSTED_ORIGINS','').split(',') if value.strip()]
if not CSRF_TRUSTED_ORIGINS or any(urlsplit(value).scheme != 'https' or not urlsplit(value).netloc or '*' in value for value in CSRF_TRUSTED_ORIGINS):
    raise ImproperlyConfigured('Set explicit HTTPS CSRF_TRUSTED_ORIGINS for production.')
for name in ['POSTGRES_DB','POSTGRES_USER','POSTGRES_PASSWORD','POSTGRES_HOST']:
    if not os.getenv(name):
        raise ImproperlyConfigured(f'Set {name} for production PostgreSQL.')
DATABASES = {'default':{
    'ENGINE':'django.db.backends.postgresql',
    'NAME':os.environ['POSTGRES_DB'],'USER':os.environ['POSTGRES_USER'],
    'PASSWORD':os.environ['POSTGRES_PASSWORD'],'HOST':os.environ['POSTGRES_HOST'],
    'PORT':os.getenv('POSTGRES_PORT','5432'),'CONN_MAX_AGE':60,'CONN_HEALTH_CHECKS':True,
    'OPTIONS':{'sslmode':os.getenv('POSTGRES_SSLMODE','prefer')},
}}
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_SSL_REDIRECT = True
SECURE_HSTS_SECONDS = 3600
SECURE_HSTS_INCLUDE_SUBDOMAINS = False
SECURE_HSTS_PRELOAD = False
STATIC_ROOT = Path(os.getenv('DJANGO_STATIC_ROOT',str(BASE_DIR/'staticfiles')))
MEDIA_ROOT = Path(os.getenv('DJANGO_MEDIA_ROOT',str(BASE_DIR/'media')))
# Set TRUST_PROXY_HTTPS=1 only with the supplied Nginx config (it overwrites this header).
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO','https') if os.getenv('TRUST_PROXY_HTTPS') == '1' else None
FILE_UPLOAD_PERMISSIONS = 0o640
FILE_UPLOAD_DIRECTORY_PERMISSIONS = 0o750

