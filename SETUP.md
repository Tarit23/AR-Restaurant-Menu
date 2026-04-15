# 🚀 AR Menu Platform — Quick Setup (5 Steps)

## Prerequisites: What you need open
- [Supabase Dashboard](https://supabase.com/dashboard/org/ujecuijeychusljwxdkf)
- [Razorpay Dashboard](https://dashboard.razorpay.com)
- This project folder

---

## Step 1 — Get Supabase Credentials (2 min)

1. Open [your Supabase org](https://supabase.com/dashboard/org/ujecuijeychusljwxdkf)
2. Click your project
3. Left sidebar → **Settings** (gear) → **API**
4. Copy:

| Field | Where to find it |
|-------|-----------------|
| `Project URL` | "Project URL" section |
| `anon` key | "Project API keys" → anon/public |
| `service_role` key | "Project API keys" → service_role |
| `Reference ID` | Browser URL: `/dashboard/project/`**THIS_PART**`/settings/api` |

---

## Step 2 — Configure the App (1 min)

Open `js/supabase-config.js` and fill in:

```js
const SUPABASE_URL      = 'https://YOUR_REFERENCE_ID.supabase.co';
const SUPABASE_ANON_KEY = 'eyJ...your-anon-key...';
const RAZORPAY_KEY_ID   = 'rzp_test_...'; // from Razorpay dashboard
const APP_CONFIG = {
  domain: 'http://localhost:3000', // update after Vercel deploy
  ...
};
```

> **Tip:** Open `http://localhost:3000/setup.html` — it auto-generates this file for you!

---

## Step 3 — Run Database Schema (2 min)

1. Go to your Supabase project → **SQL Editor** → **New query**
2. Open `supabase/schema.sql` from this project
3. Copy ALL the content and paste it into the SQL editor
4. Click **Run** (or Ctrl+Enter)
5. You should see: ✅ Success

---

## Step 4 — Create Storage Buckets (1 min)

In Supabase → **Storage** → **New bucket**:

| Bucket name | Public? |
|-------------|---------|
| `menu-images` | ✅ Yes |
| `menu-models` | ✅ Yes |

---

## Step 5 — Create Super Admin (2 min)

### Option A: Via Supabase Dashboard
1. Supabase → **Authentication** → **Users** → **Add user** → **Create new user**
2. Email: `admin@armenu.app` · Password: `ARMenu@2026!` · ✅ Auto confirm
3. Copy the UUID shown for the user
4. Go to **SQL Editor** → run:
```sql
INSERT INTO users (id, email, role)
VALUES ('PASTE-UUID-HERE', 'admin@armenu.app', 'super_admin');
```

### Option B: Via Setup Script (automated)
```powershell
# Set your credentials
$env:SUPABASE_URL="https://YOUR_REF_ID.supabase.co"
$env:SUPABASE_SERVICE_KEY="eyJ...service-role-key..."
$env:ADMIN_EMAIL="admin@armenu.app"
$env:ADMIN_PASSWORD="ARMenu@2026!"

# Run the script
node setup-db.js
```

---

## Step 6 — Test Locally

```powershell
node server.js
```

Open: **http://localhost:3000/login.html**

Login with:
- Email: `admin@armenu.app`
- Password: `ARMenu@2026!`

You should land on the **Admin Dashboard** ✅

---

## Step 7 — Deploy to Vercel

```powershell
# Push to GitHub first
git remote add origin https://github.com/Tarit23/ar-menu-platform.git
git push -u origin main

# Then deploy
npx vercel --prod
```

Or: Go to [Vercel](https://vercel.com/tarit23s-projects) → **Add New Project** → Import from GitHub.

After deploy, update `APP_CONFIG.domain` in `supabase-config.js` with your Vercel URL.

---

## Step 8 — Set Up Razorpay

1. [Razorpay Dashboard](https://dashboard.razorpay.com) → **Settings** → **API Keys** → Generate
2. Copy **Key ID** → paste in `supabase-config.js` as `RAZORPAY_KEY_ID`
3. **Settings** → **Webhooks** → Add webhook:
   - URL: `https://YOUR_REF.supabase.co/functions/v1/razorpay-webhook`
   - Secret: (any string) → save it
4. Deploy Edge Function:
   ```bash
   npx supabase functions deploy razorpay-webhook --project-ref YOUR_REF
   npx supabase secrets set RAZORPAY_WEBHOOK_SECRET=your_secret --project-ref YOUR_REF
   ```

---

## ✅ Checklist

- [ ] `js/supabase-config.js` filled in with real credentials
- [ ] `supabase/schema.sql` run in SQL Editor
- [ ] `menu-images` and `menu-models` storage buckets created (public)
- [ ] Super admin user created + inserted into `users` table
- [ ] Local server running (`node server.js`)
- [ ] Can login at `http://localhost:3000/login`
- [ ] Admin dashboard loads
- [ ] (After deploy) Vercel URL updated in config
- [ ] Razorpay keys added

---

## 🔗 Quick Links

| Resource | URL |
|----------|-----|
| Supabase Org | https://supabase.com/dashboard/org/ujecuijeychusljwxdkf |
| Razorpay | https://dashboard.razorpay.com |
| Vercel | https://vercel.com/tarit23s-projects |
| GitHub | https://github.com/Tarit23 |
| Local App | http://localhost:3000 |
| Setup Wizard | http://localhost:3000/setup.html |
