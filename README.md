# SelfPlanner

> **Dự án cá nhân • Dark mode only • Background thư giãn**

Personal life planner with recurring payment tracking, calendar, timeline, and a beautiful relaxing dark UI — built with Next.js 16 and Capacitor for Android hybrid deployment.

---

## ✨ Features

- 🔐 **Auth** — Login via Supabase (Email + Password only)
- 📊 **Dashboard** — Overview cards, upcoming payments, streak
- 📅 **Calendar** — FullCalendar with drag & drop, recurring events
- 📋 **Timeline** — Chronological event history with filters
- 💳 **Payments** — Manage recurring payments (add/edit/delete/active toggle)
- ⚙️ **Settings** — Profile, notification prefs, app info
- 🔔 **Native Reminders** — Local notification sync from recurring payments (Capacitor Local Notifications)
- 🌙 **Dark mode ONLY** — No light mode, no toggle. Relaxing dark theme throughout
- 🎨 **Animated Background** — Subtle gradient shift + floating particles + soft orbs
- 📱 **Mobile-first** — Bottom nav on mobile, collapsible sidebar on desktop
- 🪟 **Glassmorphism** — Frosted glass cards & UI elements
- ⚡ **Turbopack** — Lightning-fast dev server (Next.js 16 default)
- 🤖 **Capacitor** — Build as Android hybrid app

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Static Export) |
| Language | TypeScript |
| Styling | Tailwind CSS 4 |
| Icons | Lucide React |
| Animation | Framer Motion |
| Calendar | FullCalendar |
| Auth | Supabase Auth (Email + Password) |
| Forms | React Hook Form + Zod |
| Notifications | Sonner (Toaster) |
| Hybrid | Capacitor (Android) |
| Build | Turbopack |

---

## 📁 Project Structure

```
selfplanner/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout (AuthProvider + Toaster)
│   │   ├── page.tsx                # Root redirect (auth-based)
│   │   ├── globals.css             # Dark theme + animations
│   │   ├── login/
│   │   │   └── page.tsx            # Login page with animated bg
│   │   └── (app)/
│   │       ├── layout.tsx          # Auth layout (sidebar + bottom nav)
│   │       ├── dashboard/page.tsx  # Dashboard overview
│   │       ├── calendar/page.tsx   # FullCalendar
│   │       ├── timeline/page.tsx   # Event timeline
│   │       ├── payments/page.tsx   # Payment management
│   │       └── settings/page.tsx   # App settings
│   ├── components/
│   │   ├── providers/
│   │   │   └── auth-provider.tsx   # Supabase auth context
│   │   ├── layout/
│   │   │   ├── sidebar.tsx         # Desktop sidebar (collapsible)
│   │   │   └── bottom-nav.tsx      # Mobile bottom navigation
│   │   └── ui/
│   │       ├── animated-background.tsx
│   │       ├── badge.tsx
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── dialog.tsx
│   │       └── input.tsx
│   └── lib/
│       ├── api.ts                  # API client (NEXT_PUBLIC_API_URL)
│       ├── supabase.ts             # Supabase browser client
│       ├── types.ts                # TypeScript types & Zod schemas
│       └── utils.ts                # cn(), formatCurrency(), formatDate()
├── capacitor.config.ts
├── next.config.ts
├── supabase-schema.sql            # 📦 Database schema (run in Supabase SQL Editor)
├── .env.example
└── package.json
```

---

## 🚀 Getting Started

### 1. Clone & Install

```bash
cd selfplanner
npm install
```

### 2. Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```env
# Supabase — https://supabase.com/dashboard
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Backend API (local dev default)
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 3. Setup Supabase

1. **Create a project** at [supabase.com/dashboard](https://supabase.com/dashboard)
2. Copy **Project URL** and **anon public** key into `.env.local`
3. **Configure Redirect URLs** — Go to Authentication → URL Configuration:
   - **Development**: `http://localhost:3000/**`
   - **Preview deployments**: `https://*.vercel.app/**`
   - **Capacitor (Android)**: `com.selfplanner.app://**`
4. **Create user manually** (no registration page):
   - Go to **Authentication** → **Users** → **"Add user"** → **"Create new user"**
   - Enter your email and password
   - Check **"Auto Confirm User"**
   - Click **"Create user"**
5. Done — now you can login with these credentials

### 4. Database Schema

Run the SQL schema in Supabase to create all tables:

1. Go to **SQL Editor** in your Supabase project dashboard
2. Click **"New query"**
3. Copy the entire contents of [`supabase-schema.sql`](./supabase-schema.sql) and paste it in
4. Click **"Run"** (▶️) — should complete without errors

This creates:

| Table | Purpose |
|-------|---------|
| `recurring_payments` | Recurring bills/subscriptions (amount, day_of_month, is_active) |
| `calendar_events` | Calendar events with optional rrule recurrence |
| `timeline_events` | Timeline entries (pending/done/cancelled, categories) |
| `user_settings` | Notification prefs + FCM token for Android push |

**Features included:**
- ✅ Row Level Security (RLS) on all tables — `auth.uid() = user_id`
- ✅ Auto `updated_at` triggers
- ✅ Indexes on `user_id`, `day_of_month`, `date`, `start_date`, `status`
- ✅ Auto-creates `user_settings` row when a new user signs up

> **Note**: `next_due_date` on `recurring_payments` will be computed & updated by the backend service.

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to `/login`.

---

## 📱 Android Build (Capacitor)

### Setup Android

```bash
# Build the static export first
npm run build

# Add Android platform (first time only)
npm run cap:add:android

# Generate Android icon/splash assets (after android/ exists)
npm run cap:assets

# Sync web assets to Android
npm run cap:sync

# Open in Android Studio
npm run cap:open:android
```

### Quick Build Command

```bash
npm run android
# This runs: build → cap sync → cap open android
```

### Android Optimizations (Current)

- Status bar + splash + keyboard configured for dark Android UX in [`capacitor.config.ts`](./capacitor.config.ts)
- Platform bootstrap auto-detects Android / low-end devices and reduces expensive visual effects
- Safe-area support on top/bottom for notch and gesture navigation

### Widget Preparation (Implemented)

- Dashboard now generates a **widget snapshot payload** whenever key summary data changes
- Snapshot is stored in local storage under key: `selfplanner.widget.snapshot.v1`
- Native bridge helper added at [`src/lib/widget-bridge.ts`](./src/lib/widget-bridge.ts):
  - `publishWidgetSnapshot(snapshot)`
  - `requestWidgetRefresh()`
- Settings page includes **Android Widget (Ready)** card to inspect latest snapshot and trigger refresh request
- Settings page can also **generate widget snapshot manually** (useful before testing native widget UI)

### Branding Assets (New)

- App icon source: `assets/android-icon.svg`
- Splash source: `assets/android-splash.svg`
- Web/app brand icon: `public/brand/selfplanner-icon.svg`
- Brand logo: `public/brand/selfplanner-logo.svg`

Use Android Studio Asset Studio or `npm run cap:assets` (after `android/` exists) to generate launcher resources.

### Native Reminders (Implemented)

- Local reminders are synced from active recurring payments
- Sync window: upcoming 90 days
- Lead time follows `notify_before_days` in settings
- Settings page includes:
  - permission request (`Allow Notifications`)
  - on-demand sync (`Sync Reminders`)
  - sync status text

### APK Release Flow (Recommended)

1. `npm run build`
2. `npm run cap:add:android` (first time only)
3. `npm run cap:assets`
4. `npm run cap:sync`
5. `npm run cap:open:android`
6. In Android Studio:
   - set `minSdk/targetSdk` as needed
   - configure signing (Release keystore)
   - Build APK/AAB
7. On physical Android device, verify:
   - login + navigation
   - recurring payment CRUD
   - notification permission + sync
   - widget snapshot generation + refresh request

> Native Android AppWidget UI is the next step in the `android/` project, but the web-side data contract and sync pipeline are ready.

---

## 🎨 Design System

### Color Palette (Dark Only)

| Token | Color | Usage |
|-------|-------|-------|
| `dark-950` | `#08080f` | Background |
| `dark-900` | `#0d0d1a` | Sidebar / Cards |
| `dark-800` | `#141428` | Today cell |
| `dark-700` | `#1c1c3a` | Borders |
| `accent-purple` | `#8b5cf6` | Primary accent |
| `accent-navy` | `#3b82f6` | Secondary accent |
| `accent-green` | `#10b981` | Success / Money |

### Background Animation
- **Gradient shift**: 20s cycle, 5-stop gradient with purple/navy tones
- **Floating orbs**: 2 radial gradient orbs, 8-10s floating animation
- **Particles**: 20 subtle particles, 8-20s float-up animation
- All CSS-only + minimal JS for particle generation — **zero lag on mobile**

### Glassmorphism
- `.glass` — Light blur (20px) + subtle border
- `.glass-strong` — Heavy blur (30px) for dialogs/modals

---

## 📦 Key Scripts

```json
{
  "dev": "next dev --turbopack",
  "build": "next build",
  "cap:add:android": "npx cap add android",
  "cap:sync": "npx cap sync",
  "cap:open:android": "npx cap open android",
  "android": "npm run build && npx cap sync && npx cap open android"
}
```

---

## 📝 Notes

- **No registration page** — Users are created manually in Supabase Dashboard
- **Static export only** (`output: 'export'`) — No server-side API routes
- **Dark mode forced** — `color-scheme: dark` in CSS, no light mode toggle
- **API calls** go through `lib/api.ts` using `NEXT_PUBLIC_API_URL` to your backend
- **Capacitor config**: appId `com.selfplanner.app`, webDir `out`

---

## 📄 License

Personal use project.
