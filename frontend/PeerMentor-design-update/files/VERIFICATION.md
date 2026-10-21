# Verification · 2026-10-21

- Backend baseline: 47 tests discovered, 44 passed, 3 PostgreSQL concurrency tests skipped on SQLite (110.282s).
- New pricing suite: 6/6 passed (inclusive bounds, Decimal split/rounding, API field errors, model/database limits, immutable snapshots, legacy 10% payout).
- Actual upgrade from migration 0001 to 0002 on a separate SQLite fixture: listing prices 10k/45k/100k became 30k/45k/60k; confirmed historical 100k/10% booking was byte-for-value unchanged.
- `makemigrations --check --dry-run`: no changes detected.
- Frontend `npm run typecheck`: passed.
- Frontend `npm run build`: passed, all routes compiled.
- Browser: desktop landing layout rendered and visually inspected. Preview environment could not connect to the separate Django process, so signed-in browser booking/payment and mobile browser QA are unverified. API/service behavior was tested separately.
- No real bank transfer, payment gateway or live Google Meet session was used.
- Patch installer applied to a clean original archive; second application changed 0 files. Existing settings.py, .env and SQLite file bytes were preserved.
