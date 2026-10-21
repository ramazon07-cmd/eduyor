# PeerMentor

A small, runnable peer-mentoring marketplace. Next.js App Router + TypeScript + Tailwind CSS, Django/DRF, PostgreSQL. User interface: Uzbek Latin; currency: UZS.

## Run locally

Prerequisites: Python 3.12+, Node.js 22.13+, PostgreSQL 16+ running locally. No Docker or background job service is needed.

1. Create the development database (run as a PostgreSQL administrator; on macOS this is commonly your current user):

```sh
psql postgres -c "CREATE ROLE peermentor WITH LOGIN PASSWORD 'change-this-local-password' CREATEDB;"
createdb -O peermentor peermentor
```

`CREATEDB` is for Django's temporary test database. Remove this permission from a production role.

2. From the extracted `peermentor/` directory, install and configure Django:

```sh
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
cp backend/.env.example backend/.env
python - <<'PY'
from pathlib import Path
import secrets
p = Path('backend/.env')
p.write_text(p.read_text().replace('DJANGO_SECRET_KEY=', 'DJANGO_SECRET_KEY=' + secrets.token_urlsafe(48), 1))
PY
```

Edit `backend/.env`: match the database password and set `PAYMENT_INSTRUCTIONS` and `PAYMENT_SUPPORT`. For testing only, use `PAYMENT_INSTRUCTIONS=SINOV — pul yubormang. Demo administratorga murojaat qiling.` Leaving instructions empty deliberately disables new reservations. The app never pretends that money arrived.

```sh
python backend/manage.py migrate
python backend/manage.py seed_demo
python backend/manage.py createsuperuser
python backend/manage.py runserver 127.0.0.1:8000
```

3. In a second terminal, from `peermentor/`:

```sh
cd frontend
cp .env.local.example .env.local
npm ci
npm run dev
```

Open **http://localhost:3000**. Admin: **http://127.0.0.1:8000/admin/**. Keep the frontend hostname consistent (`localhost`), because cookies belong to a host. API requests use relative `/api/.../` URLs; Next proxies them to Django. The browser receives HttpOnly session cookies; mutations send the CSRF cookie in `X-CSRFToken`. Login and registration also require CSRF. No CORS configuration or browser token storage is used.

The seed command creates subjects and three explicitly labelled **Demo** mentors with unusable passwords. It is idempotent and never overwrites later operator edits. Pause these listings before accepting real bookings. Create actual learner/mentor accounts through the interface; approve applications in Admin.

## Working flow

- Register → edit profile → search mentors → pick date/time → enter a lesson objective → reserve → see payment instructions and a 60-minute deadline → press “Pul yubordim”; a transaction reference is optional.
- Admin opens Bookings → **To‘lov xabarlari** → **Tekshirish**. The compact review shows student/mentor, amount, claim and expiry. After independently matching the bank receipt, admin enters the bank reference, checks the receipt confirmation box, and confirms. A student claim never verifies payment. Expired holds with received funds are marked for full refund.
- The mentor signs in, opens the confirmed lesson, and enters a standard `https://meet.google.com/abc-defg-hij` URL. Only participants/admin can see it after verification.
- After the end, the student confirms the lesson happened. Alternatively, admin resolves completion issues. Time passing alone never completes a lesson.
- For a completed, verified, undisputed session, admin sends the booking's saved mentor net manually (80% for new bookings), then records the transfer reference using **Record mentor transfer already sent**. Buttons record actual operations; they do not send money.
- User cancellation is disabled. Admin handles support cancellation/refunds before start. After start, report an issue; admin can resolve completion or a full refund. Sessions already paid out require manual bank reconciliation first.

All booking fields are read-only in Admin; operational buttons call the same locked services used by the API. Mentor approval is handled in the mentor admin list/detail. Booking operations require the Django change-booking permission. Repeating confirmation, refund, completion, or payout does not create another operation or overwrite the first transfer reference.

## Verification

With the local environment configured and PostgreSQL running:

```sh
source .venv/bin/activate
python backend/manage.py check
python backend/manage.py makemigrations --check --dry-run
python backend/manage.py test core --verbosity 2
python backend/manage.py expire_reservations
cd frontend
npm run typecheck
npm run build
npm start
```

Concurrency tests use actual separate PostgreSQL connections. A test-only fallback is available:

```sh
TEST_SQLITE=1 python backend/manage.py test core
```

The fallback explicitly skips PostgreSQL concurrency tests and is forbidden for running the application. It is not evidence that row locks work.

See `VERIFICATION.md` for the checks performed on this delivery. Browser QA and real bank/Meet operations are distinct from backend tests: no real bank transfer or actual video meeting is performed by automated checks.

## Rules and deliberate decisions

- Every account is a learner. A mentor profile is optional and additive. Profile edits to headline/bio/subjects/languages return an application to pending review. Price/pause edits do not reset approval. Mentor schedule entry is disabled.
- Sessions are exactly 60 elapsed minutes. Students select any unoccupied whole-hour slot in the mentor’s IANA timezone; no availability form is required. Legacy availability and blocked-date records are retained but ignored. DST-ambiguous/nonexistent times are omitted rather than guessed.
- Slots are generated for the next 30 rolling days with at least 24 hours' notice. The viewer's timezone changes display/grouping, not stored UTC timestamps. Confirmation revalidates the active reservation and conflicts for both participants.
- Reservations last 60 minutes, including payment review. Expired holds never block slots, even without cleanup. Optional cron: `python backend/manage.py expire_reservations`. Repeating cleanup is safe.
- Every booking transition locks both participant User rows by ascending ID, then locks the booking. Creation and confirmation check both roles for both participants. Profile mutations lock the owner user, so they serialize with reservations. Existing booking snapshots ignore later price edits.
- Snapshot fields are immutable through model saves and all application/admin paths. Do not bypass services with direct SQL or `QuerySet.update()` in future application code.
- Prices are whole UZS using Decimal. Fee = total × 0.20 rounded half-up to whole UZS; mentor net = total − fee. The learner pays only the displayed total. Price, rate, fee, net, UTC times, participants, deadline and currency are snapshotted.
- A late/invalid reservation with independently verified funds becomes `refund_required`, never confirmed. The admin operation returns 409 after persisting this flag. An expired or cancelled submitted claim does not imply money was received; admin must still check the bank.
- Earnings include only completed, verified, undisputed sessions. Cancelled, expired, refunded, unpaid and disputed sessions are excluded. Pending reservations and confirmed-but-not-completed lessons are not earnings. Transfer history remains on each booking even if a dispute is raised later.
- Avatars: verified JPEG/PNG/WebP, <=2 MB and <=16 MP; re-encoded to a small JPEG with a generated filename. No SVG or arbitrary uploaded filenames. Public mentor APIs intentionally omit email, goals, payment details, meeting links and earnings.

## API map

All paths have a trailing slash under `/api/`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | auth/csrf/ | Set CSRF cookie |
| POST | auth/register/, auth/login/, auth/logout/ | Session authentication |
| GET, PATCH | me/ | Private profile; PATCH supports multipart avatars |
| GET | subjects/, mentors/ | Directory: search, subject, language (uz/en/ru), min_price, max_price, ordering (name/price_asc/price_desc), page |
| GET | mentors/{user_id}/ | Approved, active public profile |
| GET | mentors/{user_id}/slots/?timezone=Asia/Tashkent | UTC slots + viewer-local date/time |
| GET, PUT | mentor/settings/ | Apply/edit/pause own mentor profile |
| GET | mentor/availability/ | Current always_available mode; PUT is disabled |
| GET, POST | bookings/ | Own learning/teaching sessions; create reservation |
| GET | bookings/{id}/ | Participant-only details |
| POST | bookings/{id}/payment/ | Student's payment claim `{}` or optional `{reference}` |
| POST | bookings/{id}/cancel/ | Disabled (405); admin handles support cases |
| POST | bookings/{id}/complete/ | Student confirms after end |
| POST | bookings/{id}/meeting/ | Mentor submits `{meeting_url}` |
| POST | bookings/{id}/issue/ | Participant submits `{note}` after start |
| GET | payment-info/, earnings/ | Signed-in payment instructions / own mentor totals |

409 means the reservation/transition is no longer valid; refresh slots or details. Unknown privilege fields supplied by clients are ignored. Approval, verification, commission and payout state are never client-writable.

## Production setup still required

Configure real payment instructions/support, PostgreSQL credentials, secret key, public host and trusted HTTPS origin. Set `DJANGO_DEBUG=0`; secure cookies are then enabled. Serve Next.js and Django behind one HTTPS origin (route `/api/` and `/admin/` to Django, or keep the provided Next API rewrite). Set `DJANGO_API_ORIGIN` before the Next build and restart after changing it. Use `TRUST_PROXY_HTTPS=1` only behind a trusted proxy that overwrites the HTTPS header. Run Django with Gunicorn (`cd backend && gunicorn config.wsgi:application`), run `collectstatic`, and serve `/static/` and `/media/` through your web server with no executable upload handlers. Keep database/media backups.

No payment processor, Google calendar/Meet integration, email delivery, reviews, chat, wallet, subscriptions or automated payout is included. Password reset/email verification is outside this explicitly scoped MVP.

Design references: Makon.ai was inspected for broad visual inspiration (violet panels, large typography, rounded cards). PeerMentor branding, content and components are original. Calendly was accessible during initial research; Peerpillar could not be retrieved.


Pricing update: new mentor prices must be 30,000–60,000 UZS inclusive. New bookings use a 20% platform fee and 80% mentor net. Migration 0002 clamps existing mentor listing prices into this range; existing booking snapshots remain untouched. Session duration remains 60 minutes.

Directory filters are combined on the backend before pagination. Price bounds are inclusive. Language matching recognizes common Uzbek/English/Russian labels in the existing free-text teaching_languages field. Only approved, active listings appear. The browser URL retains the selected filters, sorting and page; active filters can be removed individually.

Mentor onboarding uses one combined bio (up to 3,000 characters), multiple selectable teaching languages, and price choices from 30k to 60k in 5k increments. Legacy custom prices within the allowed range and language labels are retained as choices. Migration 0003 merges bio/experience, removes exact repeated content, preserves distinct text and approval, and leaves financial snapshots unchanged. The legacy experience column/input remains for compatibility but is not exposed as a separate profile field.
