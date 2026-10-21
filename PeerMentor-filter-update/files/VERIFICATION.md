# Filter update verification · 2026-10-21

Current focused checks:
- `TEST_SQLITE=1 python manage.py test core.test_directory_filters core.test_payment_updates core.test_pricing --noinput`: 21/21 passed (29.270 seconds).
- Includes 9 directory tests: combined filters, inclusive prices, language aliases/token boundaries, search/deduplication, ascending/descending prices, invalid values, empty filters, private/unapproved profile exclusion, stable pagination after filtering.
- Frontend TypeScript check and production build passed.
- No browser interaction tests were run for this filter update. The API tests do not prove responsive layout or history interactions in a real browser.

Prior cumulative pricing/design verification:
- Original 47-test suite: 44 passed, 3 PostgreSQL concurrency cases skipped on SQLite.
- Upgrade fixture from 0001 to 0002: listing prices 10k/45k/100k became 30k/45k/60k; confirmed 100k / 10% booking snapshot remained unchanged.
- PostgreSQL concurrency and real bank/Meet operations remain unverified in this environment.

Installer verification: reproduced ZIP extraction under backend/; installer detected the correct project root, applied all 29 files, and preserved settings.py/.env/SQLite bytes. A second application changed 0 files.
