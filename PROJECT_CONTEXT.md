# EventHub — Project Context

This document describes the EventHub codebase so an AI assistant can understand it fully before helping with it. Paths are relative to the repo root.

## 1. What it is

EventHub is a full-stack event booking and ticketing platform aimed at Nepal (prices in NPR, Bikram Sambat dates shown alongside Gregorian, Nepali public holidays, Kathmandu-valley locations, eSewa payments, English/Nepali UI toggle).

- **Backend:** Django 6 + Django REST Framework, SimpleJWT auth, SQLite locally (`backend/db.sqlite3`) or PostgreSQL via `DATABASE_URL`, media in `backend/media/`. Extra libs: `qrcode`, `pillow`, `scikit-learn`, `numpy`, `anthropic`, `django-cors-headers`, `psycopg`, `gunicorn` + `whitenoise` (production).
- **Frontend:** React 19 + Vite 8, `react-router-dom` 7, `axios`, `nepali-date-converter`, `@yudiel/react-qr-scanner` (camera check-in), `html-to-image` + `jspdf` (ticket download, lazy-loaded). Plain CSS (no UI framework). Lint with `oxlint`. Installable PWA (`public/manifest.webmanifest`, `public/sw.js`).
- **External services:** Claude API (smart search, model `claude-opus-5-5`, needs `ANTHROPIC_API_KEY`), Open-Meteo (weather + geocoding, no key), eSewa ePay v2 (test merchant by default), OpenStreetMap embed (event map).
- Backend runs at `http://127.0.0.1:8000` by default; override with `VITE_API_URL` in `frontend/.env.local`. Frontend via `npm run dev` (port 5173).

### Running it
```
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_admin        # admin@eventhub.com / Admin@1234
python manage.py runserver
python manage.py daily_tasks       # once a day: complete past events, reminders, release unpaid orders

cd frontend
npm install
npm run dev                        # service worker only in: npm run build && npm run preview
```
Tests: `python manage.py test` (≈120 tests across all apps; takes ~10 min because tickets render QR images). Deployment: see `DEPLOY.md` (Render + Vercel, `render.yaml`, `backend/build.sh`, `frontend/vercel.json`).

## 2. Repository layout

```
backend/
  config/            settings.py (env-driven: DJANGO_SECRET_KEY, DJANGO_DEBUG, DJANGO_ALLOWED_HOSTS, DATABASE_URL,
                     CORS_ALLOWED_ORIGINS, CSRF_TRUSTED_ORIGINS, FRONTEND_URL, ESEWA_*), urls.py (all API under /api/)
  users/             custom User (+ organizer status), register/login/profile, permissions.py, organizers.py
                     (approve/reject/suspend/create), emails.py, admin_views.py (admin APIs), seed_admin command
  events/            Event, Holiday, PromoCode, EventStaff models; EventViewSet; pricing.py, promos.py, status.py
                     (auto SOLD_OUT/COMPLETED, held_seats), announcements.py, calendar.py, weather.py, smart_search.py,
                     turnout.py, dashboard_views.py (organizer + check-in APIs), management/commands/daily_tasks.py
  bookings/          Booking model, booking.py (all booking rules: friends, promo, payment), BookingViewSet (list/retrieve/create/cancel)
  payments/          Payment model, esewa.py (sign form / verify reply), services.py (confirm/cancel/expire), views
  tickets/           Ticket + Attendance models, signals.py (ticket on CONFIRMED + email), checkin.py, attendance.py,
                     emails.py, transfer.py, sky.py
  waitlist/          WaitlistEntry + services.promote_next_user; WaitlistViewSet (list/retrieve/create)
  notifications/     Notification + Follow models, services.notify / notify_followers, list/read/follow views
  recommendations/   services.py (TF-IDF recommender), no models
  feedback/          EventFeedback (1–5 rating + comment), postcard + public reviews views
frontend/src/
  App.jsx            routes
  main.jsx           LanguageProvider > AuthProvider > App; registers service worker in production
  context/           AuthContext.jsx (session, forced logout), LanguageContext.jsx (EN/NP dictionary, toggle)
  services/api.js    axios instance, JWT header + auto refresh, forceLogout on organizer_* 403
  services/offlineCheckin.js  offline door check-in (localStorage)
  utils/             format.js (dates, BS), download.js (CSV, .ics), offlineTickets.js (tickets saved on device)
  components/        Navbar, NotificationBell, PrivateRoute, AdminLayout, EventCard, EventBrowser (shared events
                     section), EventExtras (map, follow, reviews), EventCharts, OrganizerTools (promo codes, door staff),
                     CameraScanner, WeatherCard, MemoryPostcards, NightSky, SkyBand, SiteFooter, BackButton, AuthBrand, TicketIcon
  pages/             Home, EventDetails, Login, Register, MyTickets, TicketView, PaymentResult, MySky, Waitlist, CheckIn,
                     OrganizeDashboard, CreateEvent, EventAttendees, customer/CustomerDashboard,
                     admin/{AdminOverview, AdminOrganizers, AdminCustomers, AdminEvents, AdminProfile, AdminSettings}
                     (AdminDashboard.jsx is unused/dead)
```

## 3. Data model

**User** (`users/models.py`, extends AbstractUser, `AUTH_USER_MODEL = users.User`)
- `email` unique, `USERNAME_FIELD = "email"`; username auto-derived from email prefix.
- `role`: `CUSTOMER` (default) | `ORGANIZER` | `ADMIN`.
- `organizer_status`: PENDING | APPROVED (default) | REJECTED | SUSPENDED, plus `status_reason`. Only meaningful for organizers. Change it only via `set_organizer_status()`, which keeps the older `is_approved` boolean in sync. `organizer_block()` returns `(code, message)` when an organizer may not act.
- Organizer application: `organization_name`, `organizer_about` (+ `phone`).
- Profile: `phone`, `bio`, `avatar`, `dob`, `address`.

**Event** (`events/models.py`)
- `organizer` FK User, `title`, `description`, `category` (WORKSHOP, SEMINAR, HACKATHON, CONCERT, CONFERENCE, SPORTS, FESTIVAL, COMPETITION, MEETUP, OTHER), `tags` (comma-separated string).
- `location`, `venue`, `date`, `start_time`, `end_time`, `capacity`, `price` (Decimal, NPR).
- `early_bird_discount` (percent, 0 = none), `early_bird_seats`, `is_outdoor`.
- `status`: DRAFT (default) | PUBLISHED | SOLD_OUT | STARTED | COMPLETED | CANCELLED. PUBLISHED ↔ SOLD_OUT is automatic (`events/status.refresh_sold_out`); past events become COMPLETED via `daily_tasks`.
- `banner`, `image`, `created_at`, `updated_at`.

**PromoCode** (`events/models.py`): `event`, `code` (upper-case, unique per event), `percent_off` 1–100, `max_uses` (null = unlimited), `uses`, `active`.

**EventStaff** (`events/models.py`): `event`, `user` (a CUSTOMER), unique together. Door helpers allowed to check in tickets for that event.

**Holiday** (`events/models.py`): `name`, `name_np`, `start_date`, `end_date`, `major`. Seeded with BS 2083 holidays by migration `events/0004`.

**Booking** (`bookings/models.py`)
- `user`, `event`, `status` PENDING (waiting for payment) | CONFIRMED | CANCELLED, `booked_at`, `cancelled_at`.
- `price_paid`, `promo_code`, `payment` FK Payment (null for free orders), `transferred_from` FK self.
- Partial unique constraint: one CONFIRMED booking per (user, event). Cancelled rows are kept as history.

**Payment** (`payments/models.py`): `transaction_uuid` (unique), `user`, `event`, `amount`, `promo_code`, `status` INITIATED | COMPLETE | FAILED | EXPIRED, `ref_id` (eSewa transaction code), `created_at`, `completed_at`. One payment per order (buyer + friends).

**Ticket** (`tickets/models.py`)
- OneToOne `booking`, `ticket_number` `EVT-XXXXXXXXXX` (10 hex chars from `uuid4`, i.e. `os.urandom`), `qr_code` PNG in `media/tickets/qr/`, `status` VALID | USED | CANCELLED, `checked_in_at`, `created_at`.
- Issued by a `post_save` signal on Booking **when the booking is CONFIRMED** and has no ticket yet (free orders at once, paid orders after payment). The signal also emails the ticket with the QR attached (`transaction.on_commit`).

**Attendance** (`tickets/models.py`): entry log. OneToOne `ticket`, `event`, `attendee`, `attendee_name` (copied at entry), `entered_at` (scan time; offline scans keep their real time), `scanned_by`. Created by `tickets/attendance.record_entry` on each successful check-in.

**Notification** (`notifications/models.py`): `user`, `title`, `message`, `created_at`, `read_at`, `key` (optional dedupe label, e.g. `reminder:<event>:<booking>`). **Follow**: `follower`, `organizer`, unique together.

**WaitlistEntry** (`waitlist/models.py`): `user`, `event`, `position`, `status` WAITING | PROMOTED | CANCELLED, `joined_at`.

**EventFeedback** (`feedback/models.py`): `user`, `event`, `rating` 1–5, `comment` (≤500, optional), unique (user, event).

## 4. Auth & permissions

- SimpleJWT: access 1 day, refresh 7 days; JWT reloads the user from the DB on every request. Default pagination `PAGE_SIZE = 20`.
- Register `POST auth/register/`: role CUSTOMER or ORGANIZER (ADMIN rejected). Organizers must send `organization_name`, `phone`, `organizer_about` and always start PENDING (`is_approved`/`organizer_status` are not writable). Throttled 10/hour per IP (`RegisterThrottle`).
- Login `POST auth/login/` → `{access, refresh, user}`. Pending / rejected (with reason) / suspended organizers get a clear error message.
- `users.permissions.IsOrganizerOrAdmin`: admins, or organizers whose status is APPROVED, checked on every request. A blocked organizer gets `403 {"error", "code": "organizer_pending|organizer_rejected|organizer_suspended"}`. Used on all organizer APIs (dashboard, stats, attendees, attendance, turnout, announce, promos, staff, event create/update/delete, duplicate, date-check).
- `users.permissions.CanCheckIn`: IsOrganizerOrAdmin **or** a customer with at least one EventStaff row. Used on check-in, sync, manifest, `checkin/events/`. Per-ticket access is `tickets.checkin.can_manage` (admin, owner, or staff of that event).
- Frontend: tokens in localStorage. `api.js` refreshes once on 401; on a 403 with an `organizer_*` code it calls `forceLogout(message)` (clears tokens and saved tickets, shows the message on `/login`). `AuthContext` also force-logs-out a non-approved organizer when the profile loads, and exposes `isAuthenticated, isOrganizer, isAdmin, isCustomer, isDoorStaff`.
- `PrivateRoute` props: `requireOrganizer`, `requireAdmin`, `requireCheckIn` (organizer/admin/door staff).
- Ownership pattern in views: `role == "ADMIN" or event.organizer == request.user` (`_owned_event` helper in `events/dashboard_views.py`).

## 5. API reference (all prefixed `/api/`)

| Method & path | Who | Purpose |
|---|---|---|
| POST `auth/register/` | anyone (throttled) | Register; organizer application fields required for ORGANIZER |
| POST `auth/login/`, `auth/refresh/` | anyone | JWT login / refresh |
| GET/PATCH `auth/profile/` | auth | Own profile (incl. `organizer_status`, `is_door_staff`) |
| GET `events/` | public | Public: PUBLISHED + SOLD_OUT. Organizers: those + their own (any status). Admin: all. `?search=`, `?category=`, `?ordering=` |
| GET `events/{id}/` | public | Detail |
| POST/PATCH/DELETE `events/…` | approved organizer/admin (owner) | CRUD. Cancelling notifies ticket holders; DRAFT→PUBLISHED notifies followers |
| POST `events/{id}/duplicate/` | owner | Copy as new DRAFT |
| POST `events/{id}/promo-check/ {code, seats}` | auth | Discounted price per ticket or error |
| GET `events/{id}/map/` | public | `{available, lat, lon, place}` (town-level geocode) |
| GET `events/{id}/weather/` | public | Forecast |
| GET `events/{id}/reviews/` | public | `avg_rating`, `ratings`, latest written reviews |
| GET `events/date-check/` | organizer/admin | Holidays + clashing events |
| POST `events/smart-search/ {query}` | public, 30/hour | Plain-English search via Claude |
| GET/POST `bookings/` | auth | Own bookings / book `{event, friends?: [emails ≤5], promo_code?}`. Paid orders return `status: PENDING` + `payment: {url, fields}` for eSewa. PUT/PATCH/DELETE → 405 |
| POST `bookings/{id}/cancel/` | owner | Cancel CONFIRMED booking + promote waitlist |
| POST `payments/esewa/verify/ {data}` | buyer | Verify eSewa reply and confirm the order |
| POST `payments/{uuid}/cancel/` | buyer | Release an unpaid order |
| GET `tickets/`, `tickets/{id}/` | auth | Own tickets (incl. `venue`, `event_end_time`, `price_paid`) |
| POST `tickets/{id}/transfer/ {email}` | owner | Transfer ticket (recipient notified) |
| GET `tickets/sky/` | auth | Night sky of attended events |
| POST `tickets/check-in/ {ticket_number, event_id?}` | CanCheckIn | Live check-in; with `event_id` other events → `wrong_event`. Errors include `code`, `attendee`, `checked_in_at` |
| POST `tickets/check-in/sync/` | CanCheckIn | Upload offline scans (max 500) |
| GET `checkin/events/` | CanCheckIn | Events this user may scan (own, staffed, all for admin) |
| GET/POST `waitlist/` | auth (not organizers) | Own entries / join. PUT/PATCH/DELETE → 405 |
| GET `notifications/`, POST `notifications/read/` | auth | Latest 20 + unread count / mark all read |
| GET/POST/DELETE `organizers/{id}/follow/` | auth | Follow state / follow / unfollow |
| GET `recommendations/?limit=5` | auth | Personalized events |
| GET `postcards/`, POST `postcards/{event_id}/rate/ {rating, comment?}` | auth / attendee | Memory postcards + rating/review |
| GET `organizer/events/` | approved organizer/admin | Own events with stats |
| GET `organizer/events/{id}/stats|attendees|attendance|turnout/` | owner/admin | Stats, bookings, entry log, no-show prediction |
| GET `organizer/events/{id}/checkin-manifest/` | CanCheckIn + can_manage | Tickets for offline check-in |
| POST `organizer/events/{id}/announce/ {message}` | owner | Notify all ticket holders |
| GET/POST `organizer/events/{id}/promos/`, PATCH `organizer/promos/{id}/` | owner | Promo codes / toggle active |
| GET/POST `organizer/events/{id}/staff/`, DELETE `…/staff/{user_id}/` | owner | Door staff |
| GET `admin/stats/` | admin | Platform totals |
| GET `admin/organizers/pending|approved|rejected|suspended/` | admin | Organizer lists with application details |
| PATCH `admin/organizers/{id}/approve|reject|suspend/ {reason?}` | admin | Status change + email (approve also notifies) |
| POST `admin/organizers/create/` | admin | Create an organizer, approved immediately |
| GET `admin/customers/`, `admin/events/` | admin | Read-only lists |

Errors are `{"error": "..."}` (sometimes DRF `detail`).

## 6. Feature flows

### Organizer approval (`users/organizers.py`)
Allowed changes: PENDING → APPROVED/REJECTED, APPROVED → SUSPENDED, REJECTED/SUSPENDED → APPROVED. Each sends an email (`users/emails.py`, console backend). Accounts are never deleted. Admin › Organizers shows pending applications, approved table (Suspend), suspended & rejected (Re-approve), and "+ Add organizer".

### Booking (`bookings/booking.py`)
One transaction with the event row locked: release expired unpaid orders and the buyer's own unpaid order for this event → event must be PUBLISHED (SOLD_OUT → "Event is sold out.") → nobody in the order may already hold or be paying for a ticket → `held_seats + people ≤ capacity` → optional promo (locked, uses reserved) → each seat priced in turn (`current_price`, then `apply_promo`). Total 0 → CONFIRMED now (tickets + emails, friends notified). Total > 0 → PENDING bookings + an INITIATED Payment. Organizers can't book. `held_seats` = CONFIRMED + PENDING younger than `PENDING_MINUTES` (15); used for capacity, "seats left", early-bird count, auto SOLD_OUT and the waitlist check.

### eSewa payment (`payments/`)
Frontend posts the signed form (`payment_form`: HMAC-SHA256 over `total_amount,transaction_uuid,product_code`) to eSewa. eSewa redirects to `/payment/esewa/success?data=<base64 JSON>`; `PaymentResult` posts it to `payments/esewa/verify/`, which checks the signature, `status == COMPLETE`, amount, owner and that the order hasn't expired, then confirms the bookings (tickets issued by the signal). Failure URL `/payment/esewa/failure?uuid=` releases the order. Expired orders release seats and promo uses (`release_expired`, called on booking and in `daily_tasks`). Defaults: test merchant `EPAYTEST`.

### Cancellation & waitlist
`bookings/{id}/cancel/` (CONFIRMED only): booking + ticket CANCELLED → `promote_next_user(event)` → `refresh_sold_out`. Promotion creates a CONFIRMED booking at the current price (no payment step) and notifies "You got a seat! 🎟️". Joining the waitlist requires `held_seats >= capacity`.

### Ticket transfer (`tickets/transfer.py`)
Same rules as before (VALID ticket, open event, existing recipient without a ticket); old booking/ticket cancelled, new booking at the same `price_paid`; recipient notified.

### Check-in (`tickets/checkin.py`, `pages/CheckIn.jsx`)
`check_in_ticket(number, user, scanned_at=None, event_id=None)`: `invalid` → `not_yours` → `wrong_event` → `cancelled` → `already_used` → `not_confirmed` → `checked_in` (USED, then `record_entry` saves Attendance and notifies the attendee "You're in! 🎉"). The page has a Camera/Manual toggle (`CameraScanner`: rear camera, 2 s pause per read, friendly camera errors), both calling `submitNumber()`, sends `event_id` live, shows "Welcome!" with name and entry time, and a live "N / M inside" counter (stats every 10 s; offline from the pack). Event list from `checkin/events/`. Camera needs HTTPS or localhost.

### Offline check-in (`services/offlineCheckin.js`)
Unchanged: manifest saved per event in localStorage, local validation + queue, sync to `check-in/sync/` when online.

### Notifications
`notify(user, title, message, key="")` (keyed = once only). Sent on: check-in, waitlist promotion, ticket transfer, friend booked you, event cancelled, organizer announcement, day-before reminder (`daily_tasks`), organizer approved, door staff added, new event from a followed organizer. `NotificationBell` polls every 30 s and on focus.

### Events section (`components/EventBrowser.jsx`)
Shared by Home and the organizer dashboard: keyword / plain-English search, category chips, `EventCard` grid. On `EventDetails`: map (`EventMap`), Follow button, reviews, Add to calendar (.ics), promo code box, "Book for friends too", eSewa checkout. Organizers see "Organizer accounts can't book tickets."

### Tickets (`pages/TicketView.jsx`, `MyTickets.jsx`)
`/my-tickets/:id`: night-sky ticket design, Save as image (html-to-image) / PDF (jspdf) / Add to calendar. Valid tickets and their QR images are saved on the device (`utils/offlineTickets.js`) and shown offline; cleared on logout. Service worker caches the app shell (production build only).

### Organizer tools (`EventAttendees.jsx`, `OrganizeDashboard.jsx`)
Attendees page: stats, turnout forecast, charts (bookings per day, arrivals per 15 min; hover tooltips + table view), promo codes, door staff, announcement box, entry log and bookings with CSV export. Dashboard: KPIs, next event, needs-attention, events table (Publish, Cancel, Duplicate, Delete) and the shared EventBrowser.

### Language (`context/LanguageContext.jsx`)
`ने / EN` toggle in the navbar; `t(key)` with EN/NP dictionaries (falls back to English). Translated: navbar, EventBrowser, EventCard, EventDetails booking card, My Tickets header. BS dates in Nepali digits when NP.

### Other features (unchanged)
Early-bird pricing (`events/pricing.py`), smart search (`events/smart_search.py`, sold-out events included), weather (`events/weather.py`), turnout prediction (`events/turnout.py`), recommendations (`recommendations/services.py`), Night Sky (`tickets/sky.py`), memory postcards (now with an optional review comment).

## 7. Frontend routes (`App.jsx`)

Public: `/`, `/events/:id`, `/login`, `/register`.
Customer (PrivateRoute): `/customer/dashboard`, `/my-tickets`, `/my-tickets/:id`, `/my-sky`, `/events/:id/waitlist`, `/payment/esewa/success`, `/payment/esewa/failure`.
Organizer (requireOrganizer): `/organizer/dashboard`, `/organizer/create-event`, `/organizer/events/:id/attendees`.
Check-in (requireCheckIn): `/check-in`.
Admin (requireAdmin + AdminLayout): `/admin/dashboard`, `/admin/organizers`, `/admin/customers`, `/admin/events`, `/admin/profile`, `/admin/settings`.

## 8. Code conventions

- Backend: business logic in plain modules (`booking.py`, `checkin.py`, `transfer.py`, `organizers.py`, `payments/services.py`, `events/status.py`, `promos.py`, `services.py`), views stay thin. Atomic transactions + `select_for_update` for seats/tickets/payments. `TextChoices` for statuses. Errors `{"error": msg}`. Tests live in each app's `tests.py`; tickets need `@override_settings(MEDIA_ROOT=tempfile.mkdtemp())`.
- Frontend: function components + hooks, `api` from `services/api.js`, `getImageUrl()` for media, helpers in `utils/`, global CSS classes in `index.css` (`btn`, `badge`, `alert`, `card`, `spinner-wrap`, `container page`), page CSS files (`Home.css`, `Dashboard.css`, `TicketView.css`, `MySky.css`). Text shown to users goes through `t()` where the screen is translated.

## 9. Known issues / limitations

1. Waitlist promotions are confirmed without payment, even for paid events.
2. eSewa: only signature verification; real-money use should also call eSewa's transaction status API. Test credentials are the defaults in settings.
3. Live check-in only checks the event when `event_id` is sent (the CheckIn page always sends it; kept optional for backward compatibility). Offline, "invalid" and "other event" show the same message.
4. Door staff don't get the live "inside" counter online (stats endpoint is owner-only); they see the offline pack count if downloaded.
5. Map geocoding is town-level; the venue is only used for the Google Maps link.
6. Nepali translation covers only the main customer screens.
7. N+1 queries in organizer/admin list views and in `EventSerializer` (seat count + pricing per event).
8. Production media is served by Django from local disk (wiped on Render free redeploys); HSTS intentionally off. Seeded admin password is public: change it after deploying.
9. `db.sqlite3`, `media/` and `__pycache__/` were committed before the root `.gitignore` existed; run `git rm -r --cached backend/db.sqlite3 backend/media "**/__pycache__"` once.
10. `frontend/src/pages/AdminDashboard.jsx` is unused and calls a non-existent `admin/users/` endpoint.
11. Notifications use polling (30 s), not WebSockets.
