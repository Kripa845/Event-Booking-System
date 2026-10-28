# EventHub — Project Context

This document describes the EventHub codebase so an AI assistant can understand it fully before helping with it. Paths are relative to the repo root.

## 1. What it is

EventHub is a full-stack event booking and ticketing platform aimed at Nepal (prices in NPR, Bikram Sambat dates shown alongside Gregorian, Nepali public holidays, Kathmandu-valley locations).

- **Backend:** Django 6 + Django REST Framework, SimpleJWT auth, SQLite (`backend/db.sqlite3`), media in `backend/media/`. Extra libs: `qrcode`, `pillow`, `scikit-learn`, `numpy`, `anthropic`, `django-cors-headers`.
- **Frontend:** React 19 + Vite 8, `react-router-dom` 7, `axios`, `nepali-date-converter`. Plain CSS (no UI framework). Lint with `oxlint`.
- **External services:** Claude API (smart search, model `claude-opus-5-5`, needs `ANTHROPIC_API_KEY`), Open-Meteo (weather + geocoding, no key).
- Backend runs at `http://127.0.0.1:8000` (hardcoded in `frontend/src/services/api.js`), frontend via `npm run dev`.

### Running it
```
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_admin        # admin@eventhub.com / Admin@1234
python manage.py runserver

cd frontend
npm install
npm run dev
```
Tests: `python manage.py test` (test files exist in every app).

## 2. Repository layout

```
backend/
  config/            settings.py, urls.py (all API under /api/)
  users/             custom User, register/login/profile, admin_views.py (admin APIs), seed_admin command
  events/            Event + Holiday models, EventViewSet, pricing.py, calendar.py, weather.py,
                     smart_search.py, turnout.py, dashboard_views.py (organizer APIs)
  bookings/          Booking model + BookingViewSet (book, cancel)
  tickets/           Ticket model (+QR), signals.py (auto-create ticket), checkin.py, transfer.py, sky.py
  waitlist/          WaitlistEntry + services.promote_next_user
  recommendations/   services.py (TF-IDF recommender), no models
  feedback/          EventFeedback (1–5 rating) + postcard views
frontend/src/
  App.jsx            routes
  context/AuthContext.jsx   user/session state
  services/api.js    axios instance, JWT header + auto refresh
  services/offlineCheckin.js  offline door check-in (localStorage)
  utils/format.js    time/date helpers, BS date (fmtBs), fromNow, greeting
  components/        Navbar, PrivateRoute, AdminLayout, EventCard, WeatherCard, MemoryPostcards,
                     NightSky, SkyBand, SiteFooter, BackButton, AuthBrand, TicketIcon
  pages/             Home, EventDetails, Login, Register, MyTickets, MySky, Waitlist, CheckIn,
                     OrganizeDashboard, CreateEvent, EventAttendees, customer/CustomerDashboard,
                     admin/{AdminOverview, AdminOrganizers, AdminCustomers, AdminEvents, AdminProfile, AdminSettings}
                     (AdminDashboard.jsx is unused/dead)
```

## 3. Data model

**User** (`users/models.py`, extends AbstractUser, `AUTH_USER_MODEL = users.User`)
- `email` unique, `USERNAME_FIELD = "email"`; username auto-derived from email prefix.
- `role`: `CUSTOMER` (default) | `ORGANIZER` | `ADMIN`.
- `is_approved`: organizers register with `False` and can't log in until an admin approves.
- Profile: `phone`, `bio`, `avatar`, `dob`, `address`.

**Event** (`events/models.py`)
- `organizer` FK User, `title`, `description`, `category` (WORKSHOP, SEMINAR, HACKATHON, CONCERT, CONFERENCE, SPORTS, FESTIVAL, COMPETITION, MEETUP, OTHER), `tags` (comma-separated string).
- `location`, `venue`, `date`, `start_time`, `end_time`, `capacity`, `price` (Decimal, NPR).
- `early_bird_discount` (percent, 0 = none), `early_bird_seats`, `is_outdoor`.
- `status`: DRAFT (default) | PUBLISHED | SOLD_OUT | STARTED | COMPLETED | CANCELLED. Status is only changed manually by the organizer; nothing auto-sets SOLD_OUT/COMPLETED.
- `banner`, `image`, `created_at`, `updated_at`. Default ordering `-created_at`.

**Holiday** (`events/models.py`): `name`, `name_np`, `start_date`, `end_date`, `major`. Seeded with BS 2083 Nepali holidays by migration `events/0004`; edited in Django admin.

**Booking** (`bookings/models.py`)
- `user`, `event`, `status` CONFIRMED | CANCELLED, `booked_at`, `cancelled_at`.
- `price_paid` (what was actually paid; null on old rows → fall back to event.price).
- `transferred_from` FK self (set when the seat came from a transfer).
- Partial unique constraint: one CONFIRMED booking per (user, event). Cancelled rows are kept as history.

**Ticket** (`tickets/models.py`)
- OneToOne `booking` (related_name `ticket`), `ticket_number` `EVT-XXXXXXXXXX` (10 hex chars, generated in `save()`), `qr_code` PNG of the ticket number in `media/tickets/qr/`, `status` VALID | USED | CANCELLED, `checked_in_at`, `created_at`.
- Created automatically by a `post_save` signal on Booking (`tickets/signals.py`, registered in `TicketsConfig.ready`). Every new Booking row (direct booking, waitlist promotion, transfer) gets a new ticket.

**WaitlistEntry** (`waitlist/models.py`): `user`, `event`, `position`, `status` WAITING | PROMOTED | CANCELLED, `joined_at`. Unique (user, event); rejoining reuses the row.

**EventFeedback** (`feedback/models.py`): `user`, `event`, `rating` 1–5, unique (user, event).

## 4. Auth & permissions

- SimpleJWT: access token 1 day, refresh 7 days. Default auth class is JWT only; default pagination `PageNumberPagination`, `PAGE_SIZE = 20` (ViewSet list endpoints return `{count, next, previous, results}`; frontend handles both shapes).
- Login `POST /api/auth/login/` (email + password) → `{access, refresh, user{id,email,username,role}}`. Unapproved organizers are rejected. Registration rejects `role=ADMIN`.
- Frontend stores tokens in localStorage (`access_token`, `refresh_token`). `api.js` adds the Bearer header; on 401 it refreshes once (queuing concurrent requests), and on refresh failure clears tokens and redirects to `/login`.
- `AuthContext` exposes `user, accessToken, profileLoading, login, logout, refreshProfile, isAuthenticated, isOrganizer, isAdmin, isCustomer`.
- `PrivateRoute` props: `requireOrganizer` (note: checks role === ORGANIZER only), `requireAdmin`.
- Backend permission patterns: `IsAuthenticated`, `IsAuthenticatedOrReadOnly`, `users.permissions.IsOrganizerOrAdmin`, ad-hoc `role` checks inside views, `admin_only(request)` helper in `users/admin_views.py`. Ownership check pattern: `role == "ADMIN" or event.organizer == request.user`.

## 5. API reference (all prefixed `/api/`)

| Method & path | Who | Purpose |
|---|---|---|
| POST `auth/register/` | anyone | Register (email, username, password, password2, role) |
| POST `auth/login/` | anyone | JWT login |
| POST `auth/refresh/` | anyone | Refresh access token |
| GET/PATCH `auth/profile/` | auth | Own profile (multipart allowed for avatar) |
| GET `events/` | public | List; public sees PUBLISHED only, organizers/admins see all. `?search=`, `?category=`, `?ordering=` |
| GET `events/{id}/` | public | Detail |
| POST/PATCH/DELETE `events/…` | organizer/admin (owner) | CRUD |
| GET `events/{id}/weather/` | public | Forecast for event day |
| GET `events/date-check/?date=&location=&category=&exclude=` | organizer/admin | Holidays + clashing events on a date |
| POST `events/smart-search/ {query}` | public, throttled 30/hour | Plain-English search via Claude |
| GET/POST `bookings/` | auth | Own bookings / book `{event}` |
| POST `bookings/{id}/cancel/` | owner | Cancel + promote waitlist |
| GET `tickets/` , `tickets/{id}/` | auth | Own tickets |
| POST `tickets/{id}/transfer/ {email}` | owner | Transfer ticket to another user |
| GET `tickets/sky/` | auth | "Night sky" of attended events |
| POST `tickets/check-in/ {ticket_number}` | organizer/admin | Live check-in |
| POST `tickets/check-in/sync/ {event_id, scans:[{ticket_number, scanned_at}]}` | organizer/admin | Upload offline scans (max 500) |
| GET/POST `waitlist/` | auth | Own entries / join `{event}` |
| GET `recommendations/?limit=5` | auth | Personalized events, each with `similarity` |
| GET `postcards/` | auth | Attended events with own rating |
| POST `postcards/{event_id}/rate/ {rating}` | attendee only | Rate 1–5 |
| GET `organizer/events/` | organizer/admin | Own events with sold, checked_in, waitlist, revenue, avg_rating (not paginated) |
| GET `organizer/events/{id}/stats/` | owner/admin | Totals incl. cancelled, no_show, revenue, rating |
| GET `organizer/events/{id}/attendees/` | owner/admin | Bookings + ticket info |
| GET `organizer/events/{id}/turnout/` | owner/admin | No-show prediction |
| GET `organizer/events/{id}/checkin-manifest/` | owner/admin | All tickets for offline check-in |
| GET `admin/stats/` | admin | Platform totals |
| GET `admin/organizers/pending/`, `admin/organizers/approved/` | admin | Organizer lists |
| PATCH `admin/organizers/{id}/approve/` | admin | Approve organizer |
| DELETE `admin/organizers/{id}/decline/` | admin | Delete pending organizer |
| GET `admin/customers/`, `admin/events/` | admin | Read-only lists |

Errors are returned as `{"error": "..."}` (sometimes `detail` from DRF).

`EventSerializer` adds: `organizer_name`, `organizer_email`, `category_display`, `available_seats` (capacity − confirmed), `pricing` (from `current_price`), `holidays` (names on the event date).
`TicketSerializer` adds: `booking_id`, `booking_status`, `username`, `event_id`, `event_title`, `event_date`, `event_start_time`, `is_outdoor`, `location`, `transferred_from`, `transferred_to`.

## 6. Feature flows

### Registration & approval
Register as CUSTOMER (approved immediately) or ORGANIZER (`is_approved=False`). Admin sees pending organizers in `/admin/organizers` (sidebar badge shows count), approves (can now log in) or declines (account deleted). Login redirects: ADMIN → `/admin/dashboard`, ORGANIZER → `/organizer/dashboard`, CUSTOMER → `/customer/dashboard` (or back to the protected page that sent them to login).

### Event creation
`CreateEvent.jsx` form (status defaults DRAFT) → multipart `POST events/`. While typing, a debounced (400 ms) `events/date-check/` call warns about holidays and same-day events at the same location/venue or in the same category. Shows BS date and live early-bird price. Validation: discount ≤ 90, seats required if discount, seats ≤ capacity. Organizer publishes/cancels/deletes from the dashboard via `PATCH {status}` / `DELETE`.

### Early-bird pricing (`events/pricing.py`)
`current_price(event, confirmed=None)`: if price > 0, discount > 0, and confirmed < early_bird_seats → price × (100 − discount)/100 rounded to whole rupees, tier `EARLY_BIRD`, `left_at_price`; else regular price, tier `REGULAR`. `revenue(bookings)` sums `price_paid` (fallback `event.price`) over confirmed bookings.

### Booking (`bookings/views.py`)
Inside `transaction.atomic()`: lock event row (`select_for_update`) → must be PUBLISHED → user must not already have a confirmed booking → confirmed < capacity else "Event is sold out." → create Booking with `price_paid = current_price(...)` → signal creates Ticket + QR. IntegrityError → "already booked".

### Cancellation
`POST bookings/{id}/cancel/`: lock booking, set CANCELLED + `cancelled_at`, ticket → CANCELLED, then `promote_next_user(event)`.

### Waitlist (`waitlist/`)
Join only when full (`confirmed >= capacity`); position = count + 1; rejoin goes to the back. `place_in_line` computed live. `promote_next_user`: walk WAITING entries by position; skip (mark CANCELLED) anyone who already has a confirmed booking; otherwise create a confirmed Booking at the current price and mark the entry PROMOTED. Runs only on cancellation. No notifications (email backend is console).

### Ticket transfer (`tickets/transfer.py`)
Requires VALID ticket, CONFIRMED booking, event not past and PUBLISHED/SOLD_OUT, recipient is an active user (by email, case-insensitive), not the sender, without an existing ticket. Cancels the sender's booking and ticket (old QR dies) and creates a new booking for the recipient at the same `price_paid` with `transferred_from` set. Seat count unchanged, so the waitlist is not touched.

### Check-in (`tickets/checkin.py`)
`check_in_ticket(number, user, scanned_at=None, event_id=None)`, run in a transaction with the ticket row locked. Result codes in order: `invalid` → `not_yours` → `wrong_event` (only if event_id given) → `cancelled` → `already_used` (unless re-sent offline scan with identical `checked_in_at`, which counts as success) → `not_confirmed` → `checked_in` (status USED, `checked_in_at = min(scanned_at, now)`). The CheckIn page is a text input (manual entry or a hardware scanner that types); no camera scanning.

### Offline check-in (`frontend/src/services/offlineCheckin.js`, `pages/CheckIn.jsx`)
"Download for offline" saves the event's manifest to localStorage key `eh-checkin:<eventId>` as `{event, generated_at, tickets:{[number]:{attendee,status,checked_in_at}}, queue:[{ticket_number, scanned_at}]}`. When offline (or a request fails with no response), scans are validated locally, marked USED, and queued. When the browser goes online, the queue is uploaded to `tickets/check-in/sync/`; the server sorts scans by time and applies the same rules; conflicts (e.g. used at another door) are shown. Re-downloading keeps unsynced scans. Last selected event is remembered in localStorage.

### Night Sky (`tickets/sky.py`, `pages/MySky.jsx`)
Each attended event (ticket USED, booking CONFIRMED) is a star; brightness from the event's confirmed-booking count. 3+ attended events of one category form a named constellation (Workshop "The Maker", Seminar "The Scholar", Hackathon "The Hacker", Concert "The Lyre", Conference "The Speaker", Sports "The Runner", Festival "The Lantern", Competition "The Champion", Meetup "The Circle", Other "The Wanderer").

### Postcards & ratings (`feedback/`)
Each attended event becomes a "memory postcard" asking "How was it?"; users rate 1–5 (only if they attended; upsert). Ratings feed recommendations and organizer avg_rating.

### Recommendations (`recommendations/services.py`)
Content-based: candidates = upcoming PUBLISHED events not booked by the user. Profile = user's confirmed booked events excluding those rated 1–2. If no profile → most-booked upcoming events (score 0). Otherwise TF-IDF (English stop words) over "title description category tags", cosine similarity profile×candidates, rows weighted by rating (5★ 1.25, 4★ 1.1, else 1.0), candidate score = max over profile events, sort desc, top N. Any exception → popular fallback.

### Smart search (`events/smart_search.py`)
`extract_filters(query)`: Claude call with structured JSON-schema output, `effort: low`, beta `server-side-fallback-2026-07-01` with `fallbacks="default"`, today's date in the prompt. Schema: `keywords[], category, location, date_from, date_to, free_only, max_price, outdoor_only, summary`. Errors map to `SmartSearchUnavailable("not_configured"|"busy"|"unavailable"|"refused")` → HTTP 503 with a friendly message. `run_filters`: published events from `date_from or today`, then date_to, category, location/venue icontains, free/max_price, outdoor; keywords OR-matched on title/description/tags — if none match, keywords are dropped and `relaxed: ["keywords"]` returned. Max 50 results. Frontend (`Home.jsx`) has a smart-mode toggle and falls back to normal `?search=` on error.

### Weather (`events/weather.py`)
Open-Meteo. Past → `past`; ≥16 days away → `too_far` + `available_from`. Geocode (Nepal only) location → venue → Kathmandu, cached 1 week; daily forecast cached 1 hour (Django cache). Returns temps, rain chance, summary (WMO codes), alert (`storm`, `rain` ≥60%, `heat` ≥33°C, `showers` ≥30% or wet codes) and advice text. `WeatherCard` has full and `compact` (alert-only) modes.

### Turnout / no-show prediction (`events/turnout.py`)
History = confirmed bookings of past, non-cancelled events (excluding this event). Smoothed rates with `PRIOR_STRENGTH = 4`: global rate → toward 0.8 default; category rate → toward global; each attendee's rate → toward category. Per attendee: show probability, risk (HIGH < 0.5, MEDIUM < 0.75, LOW), reason text. Returns expected attendees/no-shows, rates, and `suggested_overbook` (largest extra seats such that mean + 1.645·sd ≤ capacity) only when platform history ≥ 20 bookings. Advisory only; booking never exceeds capacity.

### Organizer dashboard (`pages/OrganizeDashboard.jsx`)
Groups events into upcoming / drafts / past; summary totals (sold, revenue, past check-in rate); turnout for the next event; "needs attention" items: drafts, sold out with waitlist, ≤14 days away and <30% sold. Attendees page (`EventAttendees.jsx`) combines stats, attendee list and turnout forecast.

### Customer dashboard (`pages/customer/CustomerDashboard.jsx`)
Loads tickets, waitlist, recommendations, sky and postcards in parallel (`Promise.allSettled`); shows next event, upcoming list, waiting entries, recommendations, sky stats, unrated postcards.

### Admin
`AdminLayout` sidebar shell. Overview (`admin/stats/`), Organizers (approve/decline), Customers, Events (read-only), Profile, Settings. Holidays are managed in Django admin (`/admin/`).

## 7. Frontend routes (`App.jsx`)

Public: `/`, `/events/:id`, `/login`, `/register`.
Customer (PrivateRoute): `/customer/dashboard`, `/my-tickets`, `/my-sky`, `/events/:id/waitlist`.
Organizer (requireOrganizer): `/organizer/dashboard`, `/organizer/create-event`, `/organizer/events/:id/attendees`, `/check-in`.
Admin (requireAdmin + AdminLayout): `/admin/dashboard`, `/admin/organizers`, `/admin/customers`, `/admin/events`, `/admin/profile`, `/admin/settings`.
Layout: `Navbar` always (role-specific links); night-sky `SkyBand` on public pages except home/auth; `SiteFooter` except admin/auth. Visual theme: night sky, stars, constellations, paper planes, postcards.

## 8. Code conventions

- Backend: business logic lives in plain modules (`pricing.py`, `checkin.py`, `transfer.py`, `services.py`, `turnout.py`), views stay thin. Atomic transactions + `select_for_update` for anything touching seats/tickets. Status values via `TextChoices`. Short docstrings explaining intent. Error responses `{"error": msg}`.
- Frontend: function components + hooks, `api` from `services/api.js`, `getImageUrl()` for media paths, helpers from `utils/format.js`, global CSS classes (`btn`, `badge`, `alert`, `spinner-wrap`, `container page`), page-specific CSS files (`Home.css`, `Dashboard.css`, `MySky.css`).

## 9. Known issues / limitations

1. `BookingViewSet` and `WaitlistViewSet` are full `ModelViewSet`s and `event` is writable: `PATCH bookings/{id}/ {"event": X}` moves a booking to another event bypassing capacity/status checks; `DELETE` hard-deletes a booking (and ticket) without promoting the waitlist. Same for waitlist entries.
2. Live check-in (`tickets/check-in/`) doesn't receive `event_id`, so an organizer can check in a ticket for a different event they own; only the offline sync checks the event.
3. `GET events/` shows organizers every event in every status, including other organizers' drafts.
4. Event status never changes automatically (no auto SOLD_OUT/COMPLETED). Booking requires PUBLISHED, so a manual SOLD_OUT blocks booking even with free seats; waitlist join only checks capacity.
5. No notifications (email backend is console) for waitlist promotion, transfers, approvals.
6. N+1 queries in organizer/admin list views and in `EventSerializer` (seat count + pricing count per event).
7. Dev-only settings: hardcoded `SECRET_KEY`, `DEBUG=True`, `ALLOWED_HOSTS=[]`, `CORS_ALLOW_ALL_ORIGINS=True`, hardcoded backend URL in frontend, public seeded admin password. `db.sqlite3`, `media/`, and `__pycache__/` are committed; no root `.gitignore`.
8. `frontend/src/pages/AdminDashboard.jsx` is unused and calls a non-existent `admin/users/` endpoint.
9. No payment integration: bookings are confirmed instantly; `price_paid` is recorded but nothing is charged.
