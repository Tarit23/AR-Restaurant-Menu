# AR Menu Platform

> A full-stack SaaS web application for AR-powered restaurant menus with subscription management.

---

## 🗂 File Structure

```
AR Menu/
├── index.html              ← Root redirect (points to login)
├── login.html              ← Auth page
├── menu.html               ← Public customer-facing menu (via QR)
├── ar.html                 ← AR viewer (model-viewer, markerless)
├── vercel.json             ← Vercel deployment config
│
├── admin/
│   ├── index.html          ← Admin dashboard overview
│   ├── restaurants.html    ← Manage all restaurants
│   ├── menu.html           ← Full menu management + 3D upload
│   ├── qr.html             ← QR code generator for all restaurants
│   └── payments.html       ← Subscription & billing overview
│
├── restaurant/
│   ├── index.html          ← Restaurant dashboard
│   ├── menu.html           ← Restaurant's own menu (restricted edit)
│   ├── subscription.html   ← Plan management + Razorpay payment
│   └── qr.html             ← Restaurant's own QR code
│
├── css/
│   ├── main.css            ← Global design system
│   └── login.css           ← Login page styles
│
├── js/
│   ├── supabase-config.js  ← Supabase + Razorpay keys ← EDIT THIS
│   ├── auth.js             ← Auth manager
│   ├── api.js              ← All data access functions
│   └── utils.js            ← Toast, QR, formatters, etc.
│
└── supabase/
    ├── schema.sql                          ← Full DB schema + RLS
    └── functions/
        └── razorpay-webhook/
            └── index.ts                   ← Webhook handler
```

---

## ⚡ Quick Setup

### Step 1 — Supabase

1. Go to [supabase.com](https://supabase.com) → New Project
2. Open **SQL Editor** → paste & run `supabase/schema.sql`
3. Go to **Storage** → create two public buckets:
   - `menu-images`
   - `menu-models`
4. Go to **Settings → API** → copy **Project URL** and **anon public key**

### Step 2 — Configure credentials

Edit `js/supabase-config.js`:

```js
const SUPABASE_URL      = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY_HERE';
const RAZORPAY_KEY_ID   = 'YOUR_RAZORPAY_KEY_ID';
const APP_CONFIG = {
  domain: 'https://your-domain.vercel.app',
  ...
}
```

### Step 3 — Create Super Admin

1. Go to Supabase **Auth → Users** → Create user
   - Email: `admin@yourdomain.com`
   - Password: (set a strong password)
2. Copy the user's **UUID** from the Auth dashboard
3. Run in SQL Editor:
   ```sql
   INSERT INTO users (id, email, role)
   VALUES ('YOUR-UUID-HERE', 'admin@yourdomain.com', 'super_admin');
   ```

### Step 4 — Razorpay

1. Create account at [razorpay.com](https://razorpay.com)
2. Go to **Settings → API Keys** → Generate Key
3. Set `RAZORPAY_KEY_ID` in `js/supabase-config.js`
4. Create subscription plans in Razorpay dashboard → update plan IDs in config

### Step 5 — Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy from project folder
vercel deploy
```

### Step 6 — Deploy Edge Function (Webhook)

```bash
# Install Supabase CLI
npm install -g supabase

# Link project
supabase link --project-ref YOUR_PROJECT_ID

# Set secrets
supabase secrets set RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# Deploy function
supabase functions deploy razorpay-webhook
```

Then in Razorpay Dashboard → **Settings → Webhooks** → Add webhook URL:
```
https://YOUR_PROJECT_ID.supabase.co/functions/v1/razorpay-webhook
```
Select events: `payment.captured`, `payment.failed`, `subscription.charged`, `subscription.cancelled`

---

## 🔑 Roles

| Role          | Access                                              |
|---------------|-----------------------------------------------------|
| `super_admin` | All admin pages, full CRUD, payment overview        |
| `restaurant`  | Own restaurant dashboard, menu edit (limited), QR   |
| Public        | `menu.html` (read-only), `ar.html` (AR viewer)      |

---

## 💳 Payment Flow

1. Restaurant clicks **Subscribe** on `subscription.html`
2. Razorpay checkout opens
3. On success → `restaurants` table updated (status=active, next_payment_date)
4. Webhook handles autopay renewals → updates status automatically

---

## 📱 AR Technology

- Uses **Google `<model-viewer>`** — zero config AR
- Supports `webxr`, `scene-viewer` (Android), `quick-look` (iOS)
- **No marker required** — surface detection via device camera
- Models stored as `.glb` in Supabase Storage

---

## 🎨 Design

- Dark premium SaaS theme (Stripe-inspired)
- Inter + Plus Jakarta Sans typography
- CSS custom properties design system
- Smooth animations, skeleton loaders, toast notifications
- Fully responsive — mobile-first
