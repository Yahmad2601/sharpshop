-- ============================================================
-- SharpShop — follows feature. Safe to run multiple times.
-- Paste into the Supabase SQL Editor and Run.
-- ============================================================

CREATE TABLE IF NOT EXISTS follows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trader_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT follows_trader_user_unique UNIQUE (trader_id, user_id)
);

CREATE INDEX IF NOT EXISTS follows_trader_id_idx ON follows (trader_id);
CREATE INDEX IF NOT EXISTS follows_user_id_idx ON follows (user_id);

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'follows' AND policyname = 'Allow public insert on follows') THEN
    CREATE POLICY "Allow public insert on follows" ON follows FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'follows' AND policyname = 'Allow public select on follows') THEN
    CREATE POLICY "Allow public select on follows" ON follows FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'follows' AND policyname = 'Allow public delete on follows') THEN
    CREATE POLICY "Allow public delete on follows" ON follows FOR DELETE USING (true);
  END IF;
END $$;
