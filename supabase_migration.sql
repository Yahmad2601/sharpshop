-- ============================================================
-- SharpShop consolidated migration — safe to run multiple times.
-- Paste the WHOLE file into the Supabase SQL Editor and click Run.
-- Covers everything pending from DB_SETUP_INSTRUCTIONS.txt.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Orders table (skipped if it already exists)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trader_id TEXT NOT NULL REFERENCES traders(id),
  product_id UUID NOT NULL REFERENCES products(id),
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'NGN',
  fulfillment_type TEXT CHECK (fulfillment_type IN ('delivery', 'pickup')),
  delivery_details JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'fulfilled')),
  payment_ref TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'Allow public insert on orders') THEN
    CREATE POLICY "Allow public insert on orders" ON orders FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'Allow public select on orders') THEN
    CREATE POLICY "Allow public select on orders" ON orders FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'Allow public update on orders') THEN
    CREATE POLICY "Allow public update on orders" ON orders FOR UPDATE USING (true);
  END IF;
END $$;

-- ------------------------------------------------------------
-- 2. Atomic payment confirmation (REQUIRED)
--    Marks the order paid and decrements stock in one row-locked
--    transaction so two buyers can't both take the last item.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION confirm_order_paid(p_order_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_rows INT;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'order_not_found';
  END IF;
  IF v_order.status = 'paid' THEN
    RETURN 'already_paid';
  END IF;

  UPDATE products
     SET stock_quantity = stock_quantity - 1
   WHERE id = v_order.product_id
     AND stock_quantity > 0;
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  UPDATE orders
     SET status = 'paid',
         payment_ref = 'sharpshop_' || p_order_id::text
   WHERE id = p_order_id;

  IF v_rows = 0 THEN
    RETURN 'paid_out_of_stock';
  END IF;
  RETURN 'paid';
END;
$$;

-- ------------------------------------------------------------
-- 3. Like / favorite deduplication + unique constraints
--    (makes the API's idempotency race-proof)
-- ------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'likes_product_user_unique') THEN
    DELETE FROM likes a USING likes b
    WHERE a.ctid < b.ctid AND a.product_id = b.product_id AND a.user_id = b.user_id;
    ALTER TABLE likes ADD CONSTRAINT likes_product_user_unique UNIQUE (product_id, user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'favorites_product_user_unique') THEN
    DELETE FROM favorites a USING favorites b
    WHERE a.ctid < b.ctid AND a.product_id = b.product_id AND a.user_id = b.user_id;
    ALTER TABLE favorites ADD CONSTRAINT favorites_product_user_unique UNIQUE (product_id, user_id);
  END IF;
END $$;

-- ------------------------------------------------------------
-- 4. created_at TEXT -> timestamptz (only converts columns that
--    are actually text; already-correct tables are skipped)
-- ------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['comments', 'favorites', 'likes', 'users', 'traders'] LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t
        AND column_name = 'created_at' AND data_type = 'text'
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I ALTER COLUMN created_at TYPE timestamptz USING NULLIF(created_at, '''')::timestamptz', t);
      EXECUTE format('ALTER TABLE %I ALTER COLUMN created_at SET DEFAULT now()', t);
    END IF;
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- 5. One-off cleanup: expire stale pending orders older than 24h
--    (rerun manually or schedule with pg_cron later)
-- ------------------------------------------------------------
UPDATE orders SET status = 'failed'
WHERE status = 'pending'
  AND created_at < now() - INTERVAL '24 hours';
