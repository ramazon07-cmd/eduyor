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

## Homework, tests and availability — 2026-10-25

- Django `check` and migration drift check passed; migration 0012 applied locally.
- Full backend suite: 145 tests, OK; 3 PostgreSQL-only concurrency tests skipped on local SQLite. Booking participant locks remain unchanged; concurrent booking behavior requires PostgreSQL verification before production use.
- New learning tests cover participant privacy, hidden test keys, automatic scores and rounding, untrusted client scores, deadline rejection, one submission, mentor approval/student eligibility, malformed answers, and grading permissions.
- Schedule tests now require published windows, reject invalid/overlapping rules, block reserved slots and blocked dates, and preserve existing reservations when the schedule changes. Existing booking, payments, receipts, requests, session duration, and directory tests passed with explicit availability fixtures.
- Frontend typecheck, production build, and i18n checks passed.
- Browser verification used disposable accounts/database on backend 8001 and frontend 3001 because another application owns port 8000. Verified student test submission (100/100), result summary refresh, written homework submission, mentor grading (95/100 plus feedback), and weekly schedule save. No QA accounts or assignments were added to the project database.

## Simplified weekly availability editor — 2026-10-25

- Replaced the day dropdown with seven fixed weekday rows, on/off switches, compact time fields, additional intervals and a copy-to-selected-days panel. Kept the existing schedule API and mentor-profile location.
- Browser verification: copied Monday hours to Tuesday–Friday, caught a reversed interval inline and disabled saving, saved valid hours, then reloaded and confirmed all five weekdays persisted.
- Frontend typecheck, production build and translation checks passed. Preview used a temporary, unpublished mentor account; signed out and removed that account and its schedule after verification.

## Assignments without numeric scores — 2026-10-25

- Removed maximum scores, submission scores, numeric grading and percentage averages from the current schema, API and UI. Migration 0013 preserves existing review status and feedback before removing score fields.
- Homework review now accepts feedback and marks the submission reviewed. Tests return per-answer correctness without aggregate points or percentages. Before submission, students still cannot access answer keys.
- All 9 learning API tests passed, including private review without a score, mixed correct/incorrect test answers, invalid answers, deadlines and participant permissions. Frontend typecheck and translation checks passed.

## Learning production hardening — 2026-10-25

- Reviewed homework now displays a single feedback block and an explicit edit action. Later edits carry the existing review timestamp; stale changes return 409, identical retries remain idempotent.
- Server-side role/status filtering, stable 20-item pagination, role-wide counts and lightweight list serializers prevent downloading every task/question/answer at once. Private details use a separate participant-scoped endpoint; student picker responses use bounded 50-item pages.
- Shared PostgreSQL-backed per-account quotas apply to all learning endpoints across workers (120 reads/minute, 60 writes/hour), returning 429 with Retry-After. Quota rows are bounded to two per user. Migration 0014 adds quotas and assignment lookup indexes and was applied locally.
- List/detail polling refreshes every 20 seconds and on window focus, skips hidden pages, aborts stale reads and preserves answer/edit drafts. Review controls no longer duplicate the saved feedback form.
- Full backend suite: 155 tests, OK; 149 passed and 6 PostgreSQL-only concurrency tests skipped. New checks cover paginated/private payloads, summaries and filters, separate/shared quotas and resets, CSRF, exact deadlines, stale review protection and idempotency. Three learning concurrency tests are defined for the existing PostgreSQL test environment; no extra server/database service was started, as requested.
- Frontend production build, TypeScript and i18n checks passed. `npm run check:learning` rendered the actual review component using synthetic data and verified pending/reviewed/student states, a single feedback block, per-answer correctness and absence of numeric scoring.
- Browser access to the existing signed-in Chrome tab was denied by automatic approval review; synthetic UI render and API tests were used instead. Authenticated browser end-to-end behavior and PostgreSQL concurrency remain release checks; do not label these unexecuted checks as passed.

## Authorized read-only Chrome UI check — 2026-10-25

After explicit user approval, inspected the existing signed-in EduYor Chrome tab. The teaching list showed one submitted/reviewed homework. Its detail displayed the student answer and mentor feedback once, with only the explicit “Izohni tahrirlash” action; the duplicate review form and numeric scores were absent. Captured browser console contained no error entries. No forms were edited or submitted and no account/assignment data was changed. This verifies the current reviewed-screen rendering, not a new write flow or the six pending PostgreSQL concurrency checks.

## Student answer presentation — 2026-10-25

- Written answers now use a labelled panel with a document icon, student identity and a separate readable text area. Preserves whitespace, wraps long content and adapts padding on mobile; stored answers are unchanged.
- Frontend typecheck and existing review render checks passed. Read-only verification in the authorized existing Chrome tab confirmed the new layout.
- During visual QA, concurrent local polling exposed SQLite's deferred read-to-write transaction upgrade failure in the learning quota. Local SQLite transactions now start IMMEDIATE to acquire the write reservation before quota reads; PostgreSQL production settings are unchanged. The existing tab recovered automatically after reload of the backend configuration.
- Learning API suite passed: 16 tests, with 3 PostgreSQL-only concurrency tests skipped. No additional service was started.
