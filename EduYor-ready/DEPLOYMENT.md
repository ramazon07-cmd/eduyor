# EduYor deployment — one Linux VPS, one HTTPS origin

Prepared configuration; no server or domain has been deployed from this workspace. Keep local SQLite for development. The production profile always uses PostgreSQL because live booking conflict protection depends on row locks.

Prerequisites: Ubuntu 24.04 or equivalent, Python 3.12+, PostgreSQL 16+, system-wide Node.js 22.13+, Nginx, Certbot, a domain pointing to the VPS, and ports 80/443 open. Backend 8000, frontend 3000 and PostgreSQL stay private. The examples use `/srv/eduyor` and the **placeholder** `eduyor.example`; replace it with the actual domain.

## 1. Code, user, data directories

On a new server (or adapt to an existing service account):

```bash
sudo useradd --system --create-home --home-dir /srv/eduyor --shell /bin/bash eduyor
unzip EduYor-ready.zip
sudo cp -R EduYor-ready/. /srv/eduyor/
sudo mkdir -p /srv/eduyor/shared/static /srv/eduyor/shared/media /etc/eduyor
sudo chown -R eduyor:www-data /srv/eduyor
sudo chmod 750 /srv/eduyor/shared /srv/eduyor/shared/static /srv/eduyor/shared/media
sudo install -o eduyor -g eduyor -m 600 /srv/eduyor/backend/.env.production.example /etc/eduyor/backend.env
sudo install -o eduyor -g eduyor -m 600 /srv/eduyor/frontend/.env.production.example /etc/eduyor/frontend.env
sudo nano /etc/eduyor/backend.env
```

Fill a new random SECRET_KEY (at least 50 characters), actual domain/HTTPS CSRF origin, actual PostgreSQL credentials and verified payment instructions/support. Generate a key privately with Python's secrets.token_urlsafe(64); never commit env files. `TRUST_PROXY_HTTPS=1` is for the supplied Nginx config only: Nginx overwrites the forwarded-proto header. Use a separate production secret, not the development secret.

Create the PostgreSQL role/database interactively:

```bash
sudo -u postgres psql
```

```sql
CREATE ROLE eduyor WITH LOGIN PASSWORD 'REPLACE_WITH_A_RANDOM_PASSWORD';
CREATE DATABASE eduyor OWNER eduyor;
\q
```

Enter the same password in `/etc/eduyor/backend.env`. Use a password manager, do not put an actual password in shared shell history. For remote PostgreSQL, use the provider's TLS requirements and certificate setup; the sample is for PostgreSQL on the same VPS.

## 2. Backend and frontend build

```bash
sudo -u eduyor -H bash <<'SH'
set -eu
cd /srv/eduyor
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
set -a
. /etc/eduyor/backend.env
set +a
.venv/bin/python backend/manage.py check --deploy --fail-level ERROR
.venv/bin/python backend/manage.py migrate --noinput
.venv/bin/python backend/manage.py collectstatic --noinput
.venv/bin/python backend/manage.py createsuperuser
SH
```

Two optional Django warnings are deliberately retained: W005 (HSTS subdomains) and W021 (preload). Do not opt unknown subdomains into HTTPS/preload before all of them support HTTPS. HSTS for this host is enabled for one hour; after a successful rollout, the operator can extend it deliberately. No other deployment security warnings are expected.

In a separate process, load only the frontend environment:

```bash
sudo -u eduyor -H bash <<'SH'
set -eu
cd /srv/eduyor/frontend
set -a
. /etc/eduyor/frontend.env
set +a
npm ci
npm run typecheck
npm run build
SH
```

The provided frontend service expects `/usr/bin/node`; check `command -v node` and change ExecStart if the system-wide Node installation uses another path. DJANGO_API_ORIGIN is server-only; when changing it, rebuild Next.js. Nginx routes `/api/` and `/admin/` directly to Django on the same public origin, while `/` goes to Next.js. No CORS or browser token storage is needed.

## 3. HTTPS and services

Obtain the real domain's certificate before enabling the TLS config. On a fresh VPS using standalone Certbot, port 80 must be free while issuing:

```bash
sudo systemctl stop nginx
sudo certbot certonly --standalone -d eduyor.example
sudo cp /srv/eduyor/deploy/eduyor-backend.service /etc/systemd/system/
sudo cp /srv/eduyor/deploy/eduyor-frontend.service /etc/systemd/system/
sudo cp /srv/eduyor/deploy/nginx.conf.example /etc/nginx/sites-available/eduyor
sudo nano /etc/nginx/sites-available/eduyor
```

Replace every `eduyor.example` in Nginx, including certificate paths, with the real domain. Preserve the forwarded headers, private upstream ports, static/media aliases and body limit.

```bash
sudo ln -sfn /etc/nginx/sites-available/eduyor /etc/nginx/sites-enabled/eduyor
sudo nginx -t
sudo systemctl daemon-reload
sudo systemctl enable --now eduyor-backend eduyor-frontend
sudo systemctl enable --now nginx
sudo mkdir -p /etc/letsencrypt/renewal-hooks/pre /etc/letsencrypt/renewal-hooks/post
sudo install -m 755 /srv/eduyor/deploy/certbot-pre.sh /etc/letsencrypt/renewal-hooks/pre/eduyor-stop-nginx
sudo install -m 755 /srv/eduyor/deploy/certbot-post.sh /etc/letsencrypt/renewal-hooks/post/eduyor-start-nginx
sudo systemctl enable --now certbot.timer
sudo certbot renew --dry-run
```

The supplied pre/post hooks also run for scheduled standalone renewal. Renewal briefly stops Nginx; switch to a webroot renewal method later if that interruption is unacceptable. Do not run an unhooked standalone renewal timer while Nginx occupies port 80.

Nginx serves uploaded avatars as inert media files with nosniff and no executable handlers. Admin CSS/logo are served from collectstatic output. Shared media stays outside replaceable source. Services restart on failure; no Docker, Redis or Celery is introduced.

## 4. Verify and operate

Replace the placeholder domain in these commands:

```bash
curl -I http://eduyor.example/
curl -fsS https://eduyor.example/api/health/
sudo systemctl status eduyor-backend eduyor-frontend --no-pager
sudo journalctl -u eduyor-backend -u eduyor-frontend -n 80 --no-pager
```

Expected: HTTP redirects to HTTPS; readiness returns `{"status":"ok"}`. Then register/sign in through HTTPS, save a profile, approve a real mentor in Admin and test booking → claim → independently checked payment → Meet → completion → recorded manual payout. The student message must never automatically verify receipt. Do not send test payments to an unknown recipient.

Run the concurrency suite against PostgreSQL before accepting real bookings. The database role needs temporary CREATEDB permission for Django's isolated test database. On the clean supplied base settings:

```bash
sudo -u postgres psql -c 'ALTER ROLE eduyor CREATEDB;'
sudo -u eduyor -H bash <<'SH'
set -eu
cd /srv/eduyor
set -a
. /etc/eduyor/backend.env
set +a
DJANGO_DEBUG=1 .venv/bin/python backend/manage.py test core --settings=config.settings --noinput
SH
sudo -u postgres psql -c 'ALTER ROLE eduyor NOCREATEDB;'
```

The test command explicitly uses base PostgreSQL settings without production HTTPS redirect so the isolated test client can exercise all endpoints. It does not start a public debug server. If base settings were customized to SQLite, restore the supplied clean base for this server-side PostgreSQL check, or use an equivalent isolated PostgreSQL test settings module.

Back up PostgreSQL and `/srv/eduyor/shared/media` before updates and test restoration. Do not overwrite the local SQLite file with a server database or automatically import demo accounts. Moving real existing local users/bookings into production requires a separate reviewed data migration.

For later releases: back up → stop services → update source/dependencies → migrate → collectstatic → rebuild Next → restart → check readiness/auth. Keep production env files and shared media. Optional reservation cleanup can be run manually with the production environment loaded: `python backend/manage.py expire_reservations`; holds expire without the cleanup command too.

References: [Django deployment checklist](https://docs.djangoproject.com/en/5.2/howto/deployment/checklist/), [proxy trust settings](https://docs.djangoproject.com/en/5.2/ref/settings/#secure-proxy-ssl-header), [Next.js self-hosting](https://nextjs.org/docs/app/guides/self-hosting).
