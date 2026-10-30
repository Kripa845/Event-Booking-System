# Deploying EventHub

Backend (Django API + PostgreSQL) on **Render**, frontend (React) on **Vercel**. Both have free plans.
You need a GitHub account with this repo pushed to it.

## 1. Backend on Render

1. Sign in at <https://render.com> with GitHub.
2. **New → Blueprint**, pick this repo. Render reads `render.yaml` and creates:
   - `eventhub-db`, a PostgreSQL database
   - `eventhub-api`, the Django web service (runs `backend/build.sh`, then `gunicorn`)
3. Render asks for the values marked `sync: false`. For now use your Render URL and a placeholder
   for the frontend; you'll update them after step 2.

   | Variable | Example |
   |---|---|
   | `DJANGO_ALLOWED_HOSTS` | `eventhub-api.onrender.com` |
   | `CSRF_TRUSTED_ORIGINS` | `https://eventhub-api.onrender.com` |
   | `CORS_ALLOWED_ORIGINS` | `https://eventhub.vercel.app` |
   | `FRONTEND_URL` | `https://eventhub.vercel.app` |
   | `ANTHROPIC_API_KEY` | optional, for plain-English search |

   `DJANGO_SECRET_KEY` is generated for you, and `DJANGO_DEBUG` is already `false`.
4. When the deploy finishes, open the service's **Shell** tab and create the admin:
   ```
   python manage.py seed_admin
   ```
   Then **change the admin password** in Django admin (`/admin/`), because the seeded one is public in this repo.
5. Check `https://<your-api>.onrender.com/api/events/`. It should return JSON.

## 2. Frontend on Vercel

1. Sign in at <https://vercel.com> with GitHub, **Add New → Project**, pick this repo.
2. Set **Root Directory** to `frontend`. Vercel detects Vite.
3. Add the environment variable `VITE_API_URL` = `https://<your-api>.onrender.com`.
4. Deploy. `frontend/vercel.json` sends every path to `index.html`, so links like `/my-tickets/5` work.
5. Go back to Render and set `CORS_ALLOWED_ORIGINS` and `FRONTEND_URL` to your real Vercel URL. Render redeploys.

## 3. Daily tasks

`python manage.py daily_tasks` marks past events completed, sends "see you tomorrow" reminders,
and releases unpaid orders. On Render, add a **Cron Job** with the same repo and environment, root directory
`backend`, schedule `0 1 * * *` (07:45 Nepal time), command `python manage.py daily_tasks`.
Cron jobs are a paid Render feature; without one, reminders don't go out, but everything else still works
(unpaid orders are also released whenever someone books that event).

## 4. Payments (eSewa)

The defaults are eSewa's **test** merchant, so no real money moves. eSewa test login:
eSewa ID `9806800001` (or `9806800002`…`9806800005`), password `Nepal@123`, MPIN `1122`, token `123456`.

To accept real payments you need an eSewa merchant account, then set on Render:
`ESEWA_PRODUCT_CODE`, `ESEWA_SECRET_KEY`, and
`ESEWA_FORM_URL=https://epay.esewa.com.np/api/epay/main/v2/form`.
For real money, also add eSewa's transaction status check before confirming (see `payments/services.py`).

## Things to know

- **Uploaded files** (event images, ticket QR codes) are saved on the server's disk. On Render's free plan
  that disk is wiped on every deploy, so old images and QR files disappear (tickets still work by number).
  Add a Render persistent disk mounted at `backend/media`, or use cloud storage, to keep them.
- **Free Render services sleep** after 15 minutes without traffic; the first request then takes ~30 seconds.
- **Emails** print to the server log (console backend). Configure a real email provider in
  `EMAIL_BACKEND` settings to send them.
- Camera check-in works on the deployed site because both Render and Vercel use HTTPS.
