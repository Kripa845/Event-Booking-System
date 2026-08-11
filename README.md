# 🎟️ EventHub — Event Booking & Ticketing Platform

A full-stack event booking system built with Django REST Framework and React, featuring organizer dashboards, QR ticketing, waitlists, and admin panel.

---

## 🚀 Quick Start

### Backend (Django)

```bash
cd backend
python -m venv venv
.\venv\Scripts\activate          # Windows
python -m pip install --upgrade pip
pip install django djangorestframework djangorestframework-simplejwt django-cors-headers Pillow qrcode

python manage.py migrate
python manage.py seed_admin
python manage.py runserver
```

**Backend runs on:** `http://127.0.0.1:8000`

### Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

**Frontend runs on:** `http://localhost:5173`

---

## 🔑 Login Credentials

### Admin Account
- **Username:** `admin`
- **Password:** `Admin@1234`
- **Email:** `admin@eventhub.com`

You can create organizer/customer accounts by registering at `/register`.

---

## 🎯 Features

### 👤 **Customer**
- Browse published events
- Search events by name, location, keyword
- View event details (date, time, location, organizer, capacity)
- Book tickets (with overbooking prevention)
- Cancel bookings
- Join waitlist when sold out
- View tickets with QR codes
- Automatic waitlist promotion

### 🎤 **Organizer**
- Create and manage events
- Draft/publish events
- Track bookings, revenue, check-ins
- View attendee list
- Check-in attendees via QR scan
- Cancel events
- View waitlist

### 🛡️ **Admin**
- Platform-wide statistics
- Manage all users (customers, organizers)
- View all events with detailed analytics
- Monitor total revenue, bookings, check-ins
- Track waitlist metrics

---

## 📂 Project Structure

```
Event Booking/
├── backend/                # Django REST API
│   ├── users/             # Auth, roles, admin endpoints
│   ├── events/            # Event CRUD, dashboard views
│   ├── bookings/          # Booking logic with concurrency safety
│   ├── tickets/           # QR ticket generation & check-in
│   ├── waitlist/          # Waitlist + auto-promotion
│   └── config/            # Settings, URLs
│
└── frontend/              # React + Vite
    ├── src/
    │   ├── components/    # Navbar, EventCard, PrivateRoute
    │   ├── pages/         # Home, EventDetails, Dashboards
    │   ├── context/       # AuthContext (JWT + user profile)
    │   └── services/      # Axios API client
    └── index.css          # Complete design system
```

---

## 🔧 Backend Highlights

- **Overbooking Prevention:** Uses `select_for_update()` database locks
- **Waitlist Auto-Promotion:** When a booking is cancelled, the first person in the waitlist is automatically promoted
- **QR Code Generation:** Auto-generated on ticket creation using `qrcode` + `Pillow`
- **Role-Based Access:** Customer, Organizer, Admin with proper permission checks
- **Search:** Full-text search on events (title, description, location)

---

## 🎨 Frontend Highlights

- **Design System:** Custom CSS with consistent variables, responsive grid
- **Authentication:** JWT stored in `localStorage`, with user profile fetching
- **Role-Based UI:** Navbar and routes adapt based on user role
- **Route Protection:** `PrivateRoute` component guards customer/organizer/admin pages
- **Real-Time Updates:** Booking confirmation updates available seats immediately

---

## 📊 API Endpoints

### Public
- `GET  /api/events/` — List all published events
- `GET  /api/events/:id/` — Event details

### Customer
- `POST /api/bookings/` — Book an event
- `POST /api/bookings/:id/cancel/` — Cancel booking
- `GET  /api/tickets/` — My tickets
- `POST /api/waitlist/` — Join waitlist

### Organizer
- `POST /api/events/` — Create event
- `GET  /api/organizer/events/` — My events with stats
- `GET  /api/organizer/events/:id/stats/` — Detailed event stats
- `GET  /api/organizer/events/:id/attendees/` — Attendee list
- `POST /api/tickets/check-in/` — Check-in a ticket

### Admin
- `GET /api/admin/stats/` — Platform statistics
- `GET /api/admin/users/` — All users
- `GET /api/admin/events/` — All events with detailed info

---

## ✅ Solved Problems

1. **Overbooking** — Atomic transactions with row-level locks prevent race conditions
2. **Waitlist Management** — Automatic promotion when cancellations happen
3. **Ticket Validation** — QR codes prevent reuse (status: VALID → USED)
4. **Permission Control** — Event organizers can only modify their own events
5. **Event State Lifecycle** — Draft → Published → Sold Out → Completed/Cancelled

---

## 🧪 Testing the System

1. Register as **Organizer** → Create an event → Publish it
2. Register as **Customer** → Browse events → Book a ticket
3. As Customer → Cancel your ticket → Check waitlist gets promoted
4. As Organizer → Check-in the ticket → See stats update
5. Login as **Admin** (`admin` / `Admin@1234`) → View platform analytics

---

## 🛠️ Technologies

**Backend:** Django 6, Django REST Framework, SimpleJWT, CORS Headers, Pillow, QRCode  
**Frontend:** React 19, React Router, Axios, Vite  
**Database:** SQLite (dev), easily swappable to PostgreSQL  
**Auth:** JWT with refresh tokens

---

## 📝 Notes

- The admin panel is accessible at `/admin/dashboard` for users with `ADMIN` role
- To reset the admin password, run: `python manage.py seed_admin` (it's idempotent)
- Media files (QR codes, event images) are served from `/media/`
- CORS is configured for `http://localhost:5173` (frontend dev server)

---

## 🔒 Security Features

- Password validation (min 8 chars)
- JWT authentication with refresh tokens
- Role-based access control (RBAC)
- Atomic booking transactions (prevents double-booking)
- Admin-only endpoints protected
- CSRF protection enabled


---

## 🤖 AI Event Recommendation System

An intelligent, machine learning-powered recommendation engine has been integrated into EventHub to suggest relevant upcoming events to users. This system uses a **Content-Based Filtering** approach with **TF-IDF Vectorization** and **Cosine Similarity**.

### 1. Why Add AI to the Project?
Traditional event platforms only show events chronologically or by category. By introducing an AI-powered personalized recommendation section, we enhance user engagement and click-through rates. Users discover events tailored to their interests, improving the user experience and booking volume.

### 2. Architecture & Data Flow Diagram

```text
  +-----------------------------------------------------------+
  |                      React Frontend                       |
  |                (CustomerDashboard component)              |
  +-----------------------------+-----------------------------+
                                |
                                | HTTP GET /api/recommendations/
                                v
  +-----------------------------+-----------------------------+
  |              Django REST Framework Backend                 |
  |               (RecommendationView class)                  |
  +-----------------------------+-----------------------------+
                                |
                                | Call get_recommendations(user)
                                v
  +-----------------------------+-----------------------------+
  |                  Recommendation Service                   |
  |                   (recommendations app)                   |
  +-----------------------------+-----------------------------+
            |                                       |
  Query Confirmed Bookings                Query Upcoming Published Events
            |                                       |
            v                                       v
  +-------------------+                   +-------------------+
  |   Booked Events   |                   |  Candidate Events |
  |   (User profile)  |                   |    (To score)     |
  +---------+---------+                   +---------+---------+
            |                                       |
            +-------------------+-------------------+
                                |
                                v
  Combine Text Fields (title + description + category + tags)
                                |
                                v
  TF-IDF Vectorization (Scikit-Learn TfidfVectorizer)
                                |
                                v
  Cosine Similarity Matrix (Scikit-Learn cosine_similarity)
                                |
                                v
  Score & Rank Candidates (Take max similarity to any booked event)
                                |
                                v
  Exclude Already Booked Events & Filter Out Past/Draft Events
                                |
                                v
  Return Top 5 Recommendations -> Serialized -> React Dashboard
```

### 3. Machine Learning Logic Explained
* **Content-Based Recommendation**: Recommends items similar to the ones the user liked or booked in the past. It focuses entirely on the item's properties (metadata) rather than collaborative user behaviors.
* **TF-IDF (Term Frequency-Inverse Document Frequency)**: A numerical statistic that reflects how important a word is to a document in a collection. 
  * *Term Frequency (TF)*: How often a word appears in a specific event text.
  * *Inverse Document Frequency (IDF)*: Down-weights common words (like "the", "event", "workshop") that appear in almost all events, while highlighting rare, informative words (like "Django", "React", "Football").
* **Cosine Similarity**: Measures the cosine of the angle between two multi-dimensional vectors in a vector space. It determines how close two documents are in their word usage, returning a score between `0.0` (completely different) and `1.0` (identical).
* **Aggregating Similarity**: To recommend events for a user with multiple bookings, we calculate the similarity of each candidate upcoming event to all of the user's previously booked events, and take the **maximum similarity** score. This ensures that if a user has diverse interests (e.g., both Python workshops and football matches), they will receive highly similar matches for both categories.

### 4. Database & Input Data
The recommendation system reuses the existing database models:
* `User` (Authentication/Identity)
* `Booking` (Confirmed bookings determine user interests; cancelled bookings are ignored)
* `Event` (Candidate metadata extracted from `title`, `description`, `category`, and `tags`)

For each event, a text representation is created:
`clean_text = title + " " + description + " " + category + " " + tags (normalized to lowercase)`

### 5. API Endpoint
* **Endpoint**: `GET /api/recommendations/`
* **Headers**: `Authorization: Bearer <JWT_ACCESS_TOKEN>`
* **Query Params**: `limit` (Optional, defaults to 5)

**Example Request:**
```bash
curl -H "Authorization: Bearer <your_jwt_token>" http://127.0.0.1:8000/api/recommendations/
```

**Example Response:**
```json
{
  "recommendations": [
    {
      "id": 12,
      "organizer": 2,
      "organizer_name": "tech_org",
      "organizer_email": "tech@eventhub.com",
      "title": "AI & Machine Learning Workshop",
      "description": "Learn scikit-learn, TF-IDF, and recommendation engines in Python.",
      "category": "WORKSHOP",
      "category_display": "Workshop",
      "tags": "python,ai,ml,recommendations",
      "location": "Lalitpur",
      "venue": "Hall A",
      "date": "2026-08-25",
      "start_time": "09:00:00",
      "end_time": "17:00:00",
      "capacity": 100,
      "price": "0.00",
      "status": "PUBLISHED",
      "banner": "/media/events/banners/ai_workshop.jpg",
      "image": null,
      "available_seats": 95,
      "created_at": "2026-08-10T12:00:00.000Z",
      "updated_at": "2026-08-10T12:00:00.000Z",
      "similarity": 0.89
    }
  ]
}
```

### 6. Edge Cases Handled
1. **New User (No Bookings)**: Instead of showing an empty section or throwing an error, the system automatically falls back to recommending popular upcoming events (ordered by the number of confirmed bookings across the platform).
2. **User has booked all available events**: Returns an empty list gracefully.
3. **Missing/null event fields**: Safely maps empty fields to empty strings to prevent vectorizer failures.
4. **Cancelled bookings**: Filtered out so they do not influence the interest profile.
5. **Past / Draft / Cancelled events**: Excluded from the recommendation pool.

### 7. How to Run & Test
1. Make sure you install the new dependencies inside the virtual environment:
   ```bash
   cd backend
   .\venv\Scripts\activate
   pip install scikit-learn pandas
   ```
2. Run the automated tests to verify the recommendation engine and API edge cases:
   ```bash
   python manage.py test recommendations
   ```
3. Run the development servers:
   * **Backend**: `python manage.py runserver`
   * **Frontend**: `npm run dev`

---

## 🎯 Internship Interview Preparation Q&A

Use this section to prepare for internship questions regarding this feature:

1. **Why did you add AI to the project?**
   To improve user engagement and retention. By automatically displaying a personalized "✨ Recommended For You" section based on their interests, we make it easier for users to discover relevant upcoming events, increasing ticket sales and platform engagement.

2. **What type of recommendation system did you build?**
   A Content-Based Recommendation System. It profiles user interests using the textual attributes (metadata) of events they previously booked and compares them against upcoming events.

3. **What is content-based recommendation?**
   An approach where suggestions are based on the descriptors of the items themselves (e.g., description, category, tags) and a profile of the user's preferences, rather than relying on the opinions of other similar users (collaborative filtering).

4. **Why did you use TF-IDF?**
   Because it converts unstructured text into numerical vectors that capture the importance of words. A simple word count (like Bag-of-Words) would over-emphasize common words like "the", "workshop", or "event". TF-IDF penalizes widely-used words and highlights specific domain-specific keywords like "React", "Python", or "Football".

5. **What is TF-IDF?**
   It stands for **Term Frequency-Inverse Document Frequency**. Term Frequency (TF) measures how frequently a term appears in a document. Inverse Document Frequency (IDF) measures how rare/unique a term is across the entire corpus. Combining them gives a weight that highlights terms that are highly descriptive of a particular event.

6. **Why did you use cosine similarity?**
   Cosine similarity is the standard metric for text similarity because it measures the angle between two vectors, focusing on the direction rather than the magnitude (length) of the vectors. This prevents longer event descriptions from unfairly skewing similarity scores.

7. **What is cosine similarity?**
   Mathematically, it is the dot product of two vectors divided by the product of their magnitudes:
   $$\text{similarity} = \cos(\theta) = \frac{\mathbf{A} \cdot \mathbf{B}}{\|\mathbf{A}\| \|\mathbf{B}\|}$$
   It ranges from `0.0` (perpendicular, completely dissimilar) to `1.0` (collinear, identical text representation).

8. **How do you determine a user's interests?**
   We query the `Booking` model to fetch all events the user has a confirmed booking for. We retrieve the text metadata of those booked events to formulate the user's interest profile.

9. **How does booking history affect recommendations?**
   If a user has booked events with tags like "python" and "django", the TF-IDF representation of their booked events will have high weights for those terms. Upcoming events that contain similar keywords will achieve a high cosine similarity score and appear at the top of their recommendations list.

10. **How does Django communicate with the ML logic?**
    We decoupled the views from the machine learning code. The `views.py` calls the service layer `get_recommendations(user)` located in `services.py`. `services.py` fetches raw data from the database, cleans it, processes it using `scikit-learn`, and returns a sorted list of Python object tuples back to the view for serialization.

11. **How does React receive the recommendations?**
    React makes an authenticated `GET` request using Axios. The request automatically includes the JWT access token in the headers. The component `CustomerDashboard` fetches these recommendations on mount and renders them using the existing `EventCard` component.

12. **What happens for a new user with no booking history?**
    We handle the "cold start" problem by falling back to showing popular upcoming events, determined by the total number of confirmed bookings across the entire platform.

13. **What are the limitations of your recommendation system?**
    * **Cold Start**: New users get generic popular events until they make their first booking.
    * **Overspecialization**: It only recommends things similar to what the user has already booked, so they might not discover new event categories (e.g. recommending only tech workshops and never sports, even if they might like them).
    * **Static Vocabulary**: It computes the vectors in real-time on request, which is fine for small/medium platforms but would need caching/batch vector calculations on a larger scale.

14. **How could you improve it in the future?**
    * Track other interactions like "clicks", "likes", and "searches" to build a richer user profile.
    * Implement a hybrid recommendation system that combines Content-Based Filtering with Collaborative Filtering (recommending what similar users have booked).
    * Use embeddings (e.g. Word2Vec or BERT) for semantic search instead of simple exact word matches (TF-IDF).

---

## 📈 Future Enhancements


- Payment gateway integration (Khalti, eSewa)
- Email notifications (confirmation, reminders, waitlist promotion)
- Event categories and tags
- Organizer verification system
- Advanced analytics (charts, export to CSV)
- Social login (Google, Facebook)
- Mobile app (React Native)

---

Built with ❤️ for learning Django REST Framework and React.
