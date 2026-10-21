# EduYor

Next.js App Router + TypeScript + Tailwind, Django/DRF, Uzbek Latin UI. One shared logo/sidebar/card theme across the landing page, directory, booking, dashboard, profile, auth and session/payment pages. Django Admin uses the same brand colors and mark.

New lessons are **50 minutes** and cost **30,000–60,000 UZS**. Platform share: **20%**, mentor share: **80%**. Existing booking timestamps and financial snapshots are preserved. A payment reservation is separately held for 60 minutes.

## Local run — SQLite

Requires Python 3.12+ and Node.js 22.13+. No PostgreSQL, Docker or background worker is needed locally.

From the project root:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
python3 scripts/setup_local.py
python3 backend/manage.py migrate
python3 backend/manage.py seed_demo
python3 backend/manage.py createsuperuser
python3 backend/manage.py runserver 127.0.0.1:8000
```

In a second terminal, from the same root:

```bash
cd frontend
npm ci
npm run dev
```

Open http://localhost:3000. Admin: http://127.0.0.1:8000/admin/. Keep the frontend hostname consistent. The frontend uses relative `/api/` requests and forwards them to Django; session cookies are HttpOnly and writes use CSRF. `frontend/.env.local` defaults to the local Django origin and is prepared by setup_local.py.

`manage.py` and WSGI default to `config.settings_local`. This profile keeps an existing SQLite filename from base settings, or uses `backend/db.sqlite3`. It enables HTTP cookies locally. Production explicitly selects `config.settings_production` through its environment, uses PostgreSQL and enables HTTPS-only cookies. Never expose the development profile/runserver to the public internet.

setup_local.py creates missing env files and fills only a missing/blank secret key. Existing values and database data are preserved. Seed mentors are labelled Demo, have no usable login passwords, and are not invented React data. Do not seed demo listings into a real marketplace.

Set `PAYMENT_INSTRUCTIONS` and `PAYMENT_SUPPORT` in `backend/.env` before accepting reservations. Empty instructions disable reservations. No checkout simulates a received payment.

## Update an existing installation

Stop both servers and activate the existing Python environment. From the root containing backend/ and frontend/:

```bash
unzip -o ~/Downloads/EduYor-ready.zip -d .
python3 EduYor-ready/apply_update.py .
python3 scripts/setup_local.py
python3 backend/manage.py migrate
python3 backend/manage.py runserver
```

Restart `npm run dev` in frontend/. The installer preserves existing settings.py, .env files, SQLite data and media, and backs up changed code. The ZIP also contains a complete clean project for a fresh installation.

## Core flow

- Register, edit a private profile, search/filter real mentor listings, choose a date/time, add a lesson objective, reserve and press **Pul yubordim**. A bank reference is optional; the claim is not proof of receipt.
- Admin independently checks the bank statement, records a verified receipt reference and confirms within the reservation deadline. Late received funds require a manual full refund.
- A confirmed mentor supplies a validated HTTPS Google Meet link. Only participants/admin see it after payment verification. A student sees the link on the session page and receives an in-app notice.
- After the lesson ends, the student confirms it happened; time passing alone does not prove completion. Admin manually pays the mentor only for verified, completed, undisputed sessions and records the transfer reference.
- Every account can learn and teach. No self-booking, user cancellation or mentor availability form. Both participants are checked across both roles before a slot is reserved or confirmed.

New slots start on whole hours in the mentor timezone, leaving ten minutes between new 50-minute lessons. At least 24 hours' notice; next 30 days. UTC timestamps are stored; the viewer sees their own timezone. The API owns prices, approval, verification, commissions and payouts. Money uses Decimal; snapshots are immutable. Old booked 60-minute sessions retain their actual duration and display it honestly.

PostgreSQL services lock participant rows in deterministic order inside transactions. SQLite is for local use and cannot prove the row-lock concurrency guarantees required for live bookings. Expired holds stop blocking immediately without cleanup; `python3 backend/manage.py expire_reservations` is idempotent.

## Verification

```bash
python3 backend/manage.py check
python3 backend/manage.py makemigrations --check --dry-run
python3 backend/manage.py test core --noinput
cd frontend
npm run typecheck
npm run build
```

Local SQLite tests explicitly skip the three PostgreSQL concurrency tests. See VERIFICATION.md for actual results and limitations. Deployment configuration and exact server steps are in [DEPLOYMENT.md](DEPLOYMENT.md). API readiness: `/api/health/` (200/503, no account/internal details).

The exact supplied logo is retained under frontend/public/brand/. Uzbek date labels use explicit month names so browsers with incomplete uz locale data do not show “M10”. A price is displayed as “50 000 UZS”.
