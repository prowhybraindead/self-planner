-- ============================================================
-- SelfPlanner — Supabase SQL Schema (latest)
-- Chạy toàn bộ script này trong Supabase SQL Editor
-- Personal project: 1 user, RLS = auth.uid() = user_id
-- ============================================================

-- Required for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── 0. Utility: updated_at trigger ─────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── 1. recurring_payments ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.recurring_payments (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                   text NOT NULL,
  amount                 numeric NOT NULL CHECK (amount >= 0),
  payment_method         text NOT NULL DEFAULT 'visa'
                         CHECK (payment_method IN ('visa', 'mastercard', 'paypal', 'momo', 'google_play', 'bank_transfer')),
  currency               text NOT NULL DEFAULT 'VND',
  billing_anchor_date    date NOT NULL DEFAULT current_date,
  billing_interval_unit  text NOT NULL DEFAULT 'month'
                         CHECK (billing_interval_unit IN ('day', 'month', 'year')),
  billing_interval_count integer NOT NULL DEFAULT 1 CHECK (billing_interval_count >= 1),
  day_of_month           integer NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
  description            text,
  is_active              boolean NOT NULL DEFAULT true,
  next_due_date          date,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- Backfill for older databases (safe/idempotent)
ALTER TABLE public.recurring_payments ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'visa';
ALTER TABLE public.recurring_payments ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'VND';
ALTER TABLE public.recurring_payments ADD COLUMN IF NOT EXISTS billing_anchor_date date;
ALTER TABLE public.recurring_payments ADD COLUMN IF NOT EXISTS billing_interval_unit text;
ALTER TABLE public.recurring_payments ADD COLUMN IF NOT EXISTS billing_interval_count integer;
ALTER TABLE public.recurring_payments ADD COLUMN IF NOT EXISTS next_due_date date;

UPDATE public.recurring_payments
SET billing_anchor_date = COALESCE(
  next_due_date,
  make_date(
    EXTRACT(YEAR FROM current_date)::int,
    EXTRACT(MONTH FROM current_date)::int,
    LEAST(
      day_of_month,
      EXTRACT(DAY FROM (date_trunc('month', current_date) + interval '1 month - 1 day'))::int
    )
  )
)
WHERE billing_anchor_date IS NULL;

UPDATE public.recurring_payments SET billing_interval_unit = 'month' WHERE billing_interval_unit IS NULL;
UPDATE public.recurring_payments SET billing_interval_count = 1 WHERE billing_interval_count IS NULL;

ALTER TABLE public.recurring_payments ALTER COLUMN billing_anchor_date SET DEFAULT current_date;
ALTER TABLE public.recurring_payments ALTER COLUMN billing_anchor_date SET NOT NULL;
ALTER TABLE public.recurring_payments ALTER COLUMN billing_interval_unit SET DEFAULT 'month';
ALTER TABLE public.recurring_payments ALTER COLUMN billing_interval_unit SET NOT NULL;
ALTER TABLE public.recurring_payments ALTER COLUMN billing_interval_count SET DEFAULT 1;
ALTER TABLE public.recurring_payments ALTER COLUMN billing_interval_count SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'recurring_payments_billing_interval_unit_check'
  ) THEN
    ALTER TABLE public.recurring_payments
      ADD CONSTRAINT recurring_payments_billing_interval_unit_check
      CHECK (billing_interval_unit IN ('day', 'month', 'year'));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'recurring_payments_billing_interval_count_check'
  ) THEN
    ALTER TABLE public.recurring_payments
      ADD CONSTRAINT recurring_payments_billing_interval_count_check
      CHECK (billing_interval_count >= 1);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_recurring_payments_user_id ON public.recurring_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_payments_day_of_month ON public.recurring_payments(day_of_month);
CREATE INDEX IF NOT EXISTS idx_recurring_payments_active
  ON public.recurring_payments(user_id, is_active) WHERE is_active = true;

DROP TRIGGER IF EXISTS trg_recurring_payments_updated_at ON public.recurring_payments;
CREATE TRIGGER trg_recurring_payments_updated_at
  BEFORE UPDATE ON public.recurring_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.recurring_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "recurring_payments: user can manage own rows" ON public.recurring_payments;
CREATE POLICY "recurring_payments: user can manage own rows"
  ON public.recurring_payments
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── 2. calendar_events ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.calendar_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           text NOT NULL,
  description     text,
  start_date      timestamptz NOT NULL,
  end_date        timestamptz,
  is_recurring    boolean NOT NULL DEFAULT false,
  recurrence_rule text,
  color           text NOT NULL DEFAULT '#8b5cf6',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON public.calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_date ON public.calendar_events(user_id, start_date);

DROP TRIGGER IF EXISTS trg_calendar_events_updated_at ON public.calendar_events;
CREATE TRIGGER trg_calendar_events_updated_at
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "calendar_events: user can manage own rows" ON public.calendar_events;
CREATE POLICY "calendar_events: user can manage own rows"
  ON public.calendar_events
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── 3. timeline_events ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.timeline_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text NOT NULL,
  description text,
  date        date NOT NULL,
  time_of_day text,
  status      text NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'done', 'cancelled')),
  category    text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.timeline_events ADD COLUMN IF NOT EXISTS time_of_day text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'timeline_events_time_of_day_check'
  ) THEN
    ALTER TABLE public.timeline_events
      ADD CONSTRAINT timeline_events_time_of_day_check
      CHECK (
        time_of_day IS NULL
        OR time_of_day ~ '^([01][0-9]|2[0-3]):([0-5][0-9])$'
      );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_timeline_events_user_id ON public.timeline_events(user_id);
CREATE INDEX IF NOT EXISTS idx_timeline_events_date ON public.timeline_events(user_id, date);
CREATE INDEX IF NOT EXISTS idx_timeline_events_status ON public.timeline_events(user_id, status);

DROP TRIGGER IF EXISTS trg_timeline_events_updated_at ON public.timeline_events;
CREATE TRIGGER trg_timeline_events_updated_at
  BEFORE UPDATE ON public.timeline_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.timeline_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "timeline_events: user can manage own rows" ON public.timeline_events;
CREATE POLICY "timeline_events: user can manage own rows"
  ON public.timeline_events
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── 4. user_settings ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id                  uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  notify_before_days       integer NOT NULL DEFAULT 3,
  fcm_token                text,
  notification_email       text,
  reminder_offsets_minutes jsonb NOT NULL DEFAULT '[1440]'::jsonb,
  timezone                 text NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS notification_email text;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS reminder_offsets_minutes jsonb;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS timezone text;

UPDATE public.user_settings
SET reminder_offsets_minutes = '[1440]'::jsonb
WHERE reminder_offsets_minutes IS NULL;

UPDATE public.user_settings
SET timezone = 'Asia/Ho_Chi_Minh'
WHERE timezone IS NULL OR btrim(timezone) = '';

ALTER TABLE public.user_settings ALTER COLUMN reminder_offsets_minutes SET DEFAULT '[1440]'::jsonb;
ALTER TABLE public.user_settings ALTER COLUMN reminder_offsets_minutes SET NOT NULL;
ALTER TABLE public.user_settings ALTER COLUMN timezone SET DEFAULT 'Asia/Ho_Chi_Minh';
ALTER TABLE public.user_settings ALTER COLUMN timezone SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_settings_reminder_offsets_minutes_type_check'
  ) THEN
    ALTER TABLE public.user_settings
      ADD CONSTRAINT user_settings_reminder_offsets_minutes_type_check
      CHECK (jsonb_typeof(reminder_offsets_minutes) = 'array');
  END IF;
END
$$;

DROP TRIGGER IF EXISTS trg_user_settings_updated_at ON public.user_settings;
CREATE TRIGGER trg_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_settings: user can manage own row" ON public.user_settings;
CREATE POLICY "user_settings: user can manage own row"
  ON public.user_settings
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── 5. Auto-create user_settings on signup ─────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_user_created ON auth.users;
CREATE TRIGGER on_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Refresh PostgREST schema cache after DDL
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- ✅ Verify:
--   SELECT * FROM public.recurring_payments;
--   SELECT * FROM public.user_settings;
--   SELECT * FROM public.timeline_events;
-- ============================================================
