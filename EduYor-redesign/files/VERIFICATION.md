# EduYor redesign verification — 2026-10-21

## Passed

- `TEST_SQLITE=1 python backend/manage.py test core --noinput`: 83 discovered, 80 passed, 3 explicitly skipped (PostgreSQL concurrency tests). The final full run includes the 6 new duration tests and 5 dashboard filter tests.
- Duration: new booking and slot ends are exactly start + 50 minutes; reservation deadline remains now + 60 minutes; completion opens only at lesson end; 1-minute cross-role overlap is rejected and adjacent 50-minute boundaries are allowed. Legacy booked 60-minute snapshots remain unchanged and display their actual duration.
- Dashboard: learning/teaching roles, combined status filters, private ownership, local timezone midnight boundaries, unprocessed expired holds, invalid and empty filter values.
- Existing coverage: payment claims/independent verification, late refund handling, immutable 20% snapshots, price bounds, private Meet links, admin idempotency, directory filters, merged bio, selectable language/price, dual-role accounts and expired slot release.
- Django `check`: passed. `makemigrations --check --dry-run`: no changes detected. These commands used a local SQLite QA override, without modifying the delivered settings.py.
- Frontend `npm run typecheck`: passed. Final `npm run build`: passed (Next.js 16.4.2), including all 9 routes.
- Supplied logo: PNG bytes match the user's attachment exactly; the SVG is a UI framing wrapper embedding that same PNG. No logo dot in active components or theme.

## Limits

- PostgreSQL is not available in this environment; the 3 real row-lock/concurrency tests were skipped by the test-only SQLite fallback. SQLite is not evidence of PostgreSQL locking behavior.
- Browser visual QA was attempted through the managed preview. The supervisor reported running, but the browser received ERR_CONNECTION_REFUSED and status then reported stopped. Desktop/mobile and signed-in visual QA remain unverified; no separate preview infrastructure was substituted.
- No actual bank transaction, mentor payout or Google Meet call was performed. Payment verification remains manual, based on independent bank receipt checks.
- Existing local settings, secrets, media and database are excluded from the update. Run the existing migrations locally before restarting. No new migration or dependency is required for the 50-minute duration/theme change itself.

Installer validation is recorded in INSTALLER_CHECK.txt beside the update instructions.
