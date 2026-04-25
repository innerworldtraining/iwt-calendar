# IWT Calendar

A calendar app for IWT Elites and Plats members, gated by ActiveCampaign tags.

- **Members sign in with their email** — access is granted automatically based on whether they have the `Client - Elites` or `Client - Plats` tag in ActiveCampaign.
- **Admins** (you) can create, edit, and delete events, plus manage other admins from inside the app.
- **No passwords** — email is the credential. (See "Security trade-off" below.)
- **No email sending** — when you onboard a new member, you tell them the URL via your existing AC workflows.

---

## Stack

- **Frontend & API**: Next.js 14 (App Router) + React + TypeScript
- **Database**: Vercel Postgres (free tier, powered by Neon)
- **Auth**: JWT in HTTP-only cookie (no third-party auth service)
- **Deployment**: Vercel (free tier)

---

## Deployment — step by step

You haven't run any code locally yet, so this assumes you're pushing this folder to GitHub and deploying directly from Vercel.

### 1. Push this code to GitHub

If you have Git installed:

```bash
cd iwt-calendar
git init
git add .
git commit -m "Initial commit"
# Create a new repo at https://github.com/new (call it "iwt-calendar")
git remote add origin https://github.com/YOUR_USERNAME/iwt-calendar.git
git branch -M main
git push -u origin main
```

If you don't have Git:
1. Go to <https://github.com/new>
2. Create a new repo called `iwt-calendar` (private is fine)
3. On the repo page, click **uploading an existing file**
4. Drag this entire folder's contents (not the folder itself — the files inside)
5. Commit

### 2. Deploy to Vercel

1. Go to <https://vercel.com/new>
2. Import your `iwt-calendar` GitHub repo
3. Click **Deploy** (Vercel auto-detects Next.js — no settings needed)
4. Wait ~60 seconds. The deploy will succeed but the app won't work yet — we still need a database and env vars.

### 3. Add the database

1. In your Vercel project, go to **Storage** → **Create Database** → **Postgres**
2. Name it `iwt-calendar-db`, accept the defaults, click **Create**
3. Click **Connect to Project** — it auto-injects `POSTGRES_URL` into your environment

### 4. Get your ActiveCampaign API credentials

1. Sign in to ActiveCampaign
2. Go to **Settings** → **Developer**
3. Copy the **API URL** (looks like `https://YOURACCOUNT.api-us1.com`)
4. Copy the **API Key** (long string)

### 5. Add environment variables to Vercel

In your Vercel project: **Settings → Environment Variables**, add these:

| Name | Value | Notes |
|---|---|---|
| `AC_API_URL` | `https://YOURACCOUNT.api-us1.com` | From step 4 |
| `AC_API_KEY` | `your_api_key_from_ac` | From step 4 |
| `AC_TAG_ELITES` | `136` | Already correct for IWT |
| `AC_TAG_PLATS` | `137` | Already correct for IWT |
| `BOOTSTRAP_ADMINS` | `joreymeljumayao.iwt@gmail.com` | Your email — comma-separated for more |
| `JWT_SECRET` | (generate a random 32+ character string — see below) | Keep this secret |

**To generate a `JWT_SECRET`:** Open <https://generate-secret.vercel.app/32> and copy the result. Or in a terminal: `openssl rand -base64 32`.

After adding all variables, **redeploy** by going to **Deployments** → click the `⋯` menu next to the latest → **Redeploy**.

### 6. Sign in

Visit your deployed URL: `iwt-calendar.vercel.app` (or whatever Vercel assigned you).

Enter your email: `joreymeljumayao.iwt@gmail.com`. You'll be signed in as admin and can immediately start creating events.

---

## How access works

| Email source | Result |
|---|---|
| Listed in `BOOTSTRAP_ADMINS` env var | Admin (full access, both calendars) |
| Added via in-app "Admins" panel | Admin (full access, both calendars) |
| Has tag `Client - Elites` (136) in AC | Elites member — can view Elites calendar only |
| Has tag `Client - Plats` (137) in AC | Plats member — can view Plats calendar only |
| Has both tags | Sees both calendars (tab switcher) |
| None of the above | Access denied — friendly error message |

To give a new member access: just tag them in ActiveCampaign. They can sign in immediately.
To revoke: remove the tag in AC. Their next session refresh will deny access (current sessions persist for up to 30 days — see "Future improvements").

---

## Security trade-off (read this)

This app uses **email-only authentication with no proof of inbox ownership**. Anyone who knows a member's email could sign in as them and see their calendar.

This is acceptable for IWT's use case because:

- Calendar events are non-sensitive (coaching session times, not financial data)
- Members can't edit anything — only admins can write
- Blast radius of a leaked email is small (someone sees future event titles)

**When you upgrade to a custom domain, switch to magic-link authentication** — the architecture supports adding it as a one-file addition. The email service of choice is [Resend](https://resend.com/) (free tier covers your member count).

---

## Future improvements

These are intentionally out of scope for v1 — flag if you want them later:

- **Magic-link sign-in** — proves inbox ownership; requires email-sending service + verified sender domain
- **Live ICS subscription URL** — `/api/calendar/[user]/ics` that Google/Apple/Outlook auto-refresh from, instead of one-time downloads
- **Session shortening** — currently 30-day cookies; could refresh AC tags every login or every 24 hours
- **Tag ID configuration UI** — currently `AC_TAG_ELITES`/`AC_TAG_PLATS` are env vars, could be admin-editable
- **Per-event RSVP tracking** — log who clicked "Add to Calendar"
- **Multi-event recurring schedule** — currently one row per event

---

## File structure

```
iwt-calendar/
├── src/
│   ├── app/
│   │   ├── layout.tsx          ← root layout
│   │   ├── page.tsx            ← shows login or app based on session
│   │   ├── globals.css         ← shared styles
│   │   └── api/                ← backend API routes
│   │       ├── auth/
│   │       │   ├── login/      ← POST email → check AC + admins → cookie
│   │       │   ├── logout/
│   │       │   └── me/         ← GET current session
│   │       ├── events/         ← list, create, edit, delete
│   │       └── admins/         ← list, add, remove admins
│   ├── lib/
│   │   ├── ac.ts               ← ActiveCampaign client
│   │   ├── auth.ts             ← JWT + role resolution
│   │   ├── db.ts               ← Postgres client + auto-migrations
│   │   ├── types.ts            ← shared types
│   │   └── calendar-utils.ts   ← Google/Outlook URL builders, ICS, date helpers
│   └── components/
│       ├── LoginForm.tsx
│       ├── CalendarApp.tsx     ← main app shell
│       ├── EventDetailModal.tsx
│       ├── EventEditModal.tsx
│       ├── MembersModal.tsx    ← admin management
│       └── Toast.tsx
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.js
├── .env.example                ← copy to .env.local for local dev
└── README.md                   ← this file
```

---

## Adding a custom domain later

1. Buy a domain (Cloudflare or Namecheap, ~$12/year)
2. In Vercel: **Settings → Domains** → add e.g. `calendar.iwt.com`
3. Vercel shows you the DNS records to add at your registrar
4. Wait ~5 min for DNS propagation
5. Done — the app keeps working at both URLs

No code changes needed.

---

## Local development (optional)

If you want to test locally before deploying:

```bash
cd iwt-calendar
npm install
cp .env.example .env.local
# Fill in .env.local with real values (you'll need a Postgres URL — easiest is to deploy to Vercel first, then copy POSTGRES_URL from there)
npm run dev
# Open http://localhost:3000
```

---

## Help

If something doesn't work after deploy:

1. **Check Vercel logs** — Dashboard → your project → **Logs** tab. Errors show up here.
2. **Check env vars** — make sure all 6 are set and `JWT_SECRET` is at least 32 characters.
3. **Check AC API access** — try the API URL in a browser with the API key as a header. You should get JSON.
4. **Database not connecting** — make sure you clicked "Connect to Project" after creating the Postgres database.
