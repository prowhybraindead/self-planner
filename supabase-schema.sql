-- ============================================================
-- SelfPlanner — Supabase SQL Schema
-- Chạy toàn bộ script này trong Supabase SQL Editor
-- Personal project: 1 user, RLS = auth.uid() = user_id
-- ============================================================

-- ─── 0. Utility: updated_at trigger ─────────────────────────
-- Tự động set updated_at = now() mỗi khi UPDATE

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── 1. recurring_payments ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.recurring_payments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          text    NOT NULL,
  amount        numeric NOT NULL CHECK (amount >= 0),
  payment_method text   NOT NULL DEFAULT 'visa'
              CHECK (payment_method IN ('visa', 'mastercard', 'paypal', 'momo', 'google_play', 'bank_transfer')),
  currency      text    NOT NULL DEFAULT 'VND',
  day_of_month  integer NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
  description   text,
  is_active     boolean NOT NULL DEFAULT true,
  next_due_date date,                        -- backend sẽ cập nhật
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Backfill columns for existing projects (safe to run many times)
ALTER TABLE public.recurring_payments
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'visa';
ALTER TABLE public.recurring_payments
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'VND';
ALTER TABLE public.recurring_payments
  ADD COLUMN IF NOT EXISTS next_due_date date;

-- If PostgREST schema cache is stale, ask Supabase to reload it after DDL.
NOTIFY pgrst, 'reload schema';

-- Index
CREATE INDEX IF NOT EXISTS idx_recurring_payments_user_id
  ON public.recurring_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_payments_day_of_month
  ON public.recurring_payments(day_of_month);
CREATE INDEX IF NOT EXISTS idx_recurring_payments_active
  ON public.recurring_payments(user_id, is_active) WHERE is_active = true;

-- Trigger: auto updated_at
CREATE TRIGGER trg_recurring_payments_updated_at
  BEFORE UPDATE ON public.recurring_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.recurring_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recurring_payments: user can manage own rows"
  ON public.recurring_payments
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── 2. calendar_events ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.calendar_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           text        NOT NULL,
  description     text,
  start_date      timestamptz NOT NULL,
  end_date        timestamptz,
  is_recurring    boolean     NOT NULL DEFAULT false,
  recurrence_rule text,                                -- rrule string (RFC 5545)
  color           text        NOT NULL DEFAULT '#8b5cf6',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id
  ON public.calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_date
  ON public.calendar_events(user_id, start_date);

-- Trigger: auto updated_at
CREATE TRIGGER trg_calendar_events_updated_at
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calendar_events: user can manage own rows"
  ON public.calendar_events
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── 3. timeline_events ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.timeline_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid   NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text   NOT NULL,
  description text,
  date        date   NOT NULL,
  status      text   NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'done', 'cancelled')),
  category    text,                          -- work, personal, finance, …
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_timeline_events_user_id
  ON public.timeline_events(user_id);
CREATE INDEX IF NOT EXISTS idx_timeline_events_date
  ON public.timeline_events(user_id, date);
CREATE INDEX IF NOT EXISTS idx_timeline_events_status
  ON public.timeline_events(user_id, status);

-- Trigger: auto updated_at
CREATE TRIGGER trg_timeline_events_updated_at
  BEFORE UPDATE ON public.timeline_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.timeline_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "timeline_events: user can manage own rows"
  ON public.timeline_events
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── 4. user_settings ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  notify_before_days integer NOT NULL DEFAULT 3,
  fcm_token          text,                  -- push notification Android (Capacitor)
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- Trigger: auto updated_at
CREATE TRIGGER trg_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_settings: user can manage own row"
  ON public.user_settings
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── 5. Auto-create user_settings on signup ──────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Tạo trigger trên auth.users (idempotent nhờ DROP IF EXISTS)
DROP TRIGGER IF EXISTS on_user_created ON auth.users;
CREATE TRIGGER on_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- ✅ Xong! Verify bằng cách chạy:
--   SELECT * FROM recurring_payments;
--   SELECT * FROM user_settings;
-- ============================================================
