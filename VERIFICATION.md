# EduYor unified design / deployment preparation — 2026-10-21

## Passed

- Final backend suite: `TEST_SQLITE=1 python backend/manage.py test core --noinput`: **90 discovered, 87 passed, 3 skipped**. Skips are the three PostgreSQL-only concurrency tests. All earlier booking/payment/privacy/pricing/duration/filter tests and seven new deployment/setup/readiness tests are included.
- Local setup: real `config.settings_local` SQLite migrate and idempotent demo seed completed; Django `check` passed; `makemigrations --check --dry-run` found no changes.
- Real local Django HTTP smoke: readiness 200, database-backed mentor directory 200, HTTP CSRF cookie bootstrap and branded Admin login HTML passed. The development server was stopped after the check.
- Production settings `check --deploy --fail-level ERROR`: no errors, exactly two documented optional HSTS warnings (W005 subdomains, W021 preload). Strong-secret, explicit-host and HTTPS-origin validation tests passed. This check does not establish PostgreSQL connectivity.
- Production collectstatic copied 164 files, including the supplied EduYor admin logo. Gunicorn was installed from the existing requirements range, and production WSGI `gunicorn ... --check-config` passed without connecting to a production database.
- Final frontend `npm run typecheck` and `npm run build`: passed, all nine routes compiled/prerendered as applicable. The shared AppShell and supplied logo are present in built HTML for landing, directory, login, registration, profile and dashboard. Mentor/session detail routes inherit the same root shell.
- A blank-secret setup regression is covered: setup_local creates a valid key without swallowing the next env line, preserves existing values/data, does not print the secret and is idempotent.
- Booking duration remains 50 minutes for new bookings; payment hold remains 60. Price 30k–60k, 20% platform / 80% mentor. Existing immutable times/prices remain unchanged. No automatic payment approval or payout was introduced.

## Not verified here

- Browser visual QA: managed preview reported running, but browser navigation returned ERR_CONNECTION_REFUSED and supervisor status then showed stopped. Desktop/mobile visual and browser click-through QA remain unverified. No alternative preview infrastructure was substituted.
- PostgreSQL is not installed/available here, so real row-lock/concurrency tests and production database connectivity have not run. Run the included PostgreSQL verification commands before taking real bookings.
- Nginx is not installed and systemd is not running a production VPS here. Nginx syntax, actual service startup, real TLS issuance/renewal and a deployed HTTPS authentication flow must be checked on the target server.
- No deployment was published. No real bank payment, refund, mentor payout or Google Meet call was made.

The complete ZIP excludes live .env files, SQLite databases, uploaded media, build output, dependencies and local credentials. Release/update installer validation is recorded in INSTALLER_CHECK.txt.
