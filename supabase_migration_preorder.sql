-- ============================================================
-- SharpShop — Pre-order / "Drop" support. Safe to run multiple times.
-- Paste into the Supabase SQL Editor and Run.
--
-- Model: for a drop, stock_quantity is the REMAINING SLOTS
-- (initialized to max_capacity). The existing confirm_order_paid
-- function already decrements it atomically per paid order, so
-- slot counting and oversell protection need no new machinery.
-- ============================================================

ALTER TABLE products ADD COLUMN IF NOT EXISTS is_preorder BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS order_deadline TIMESTAMPTZ;
ALTER TABLE products ADD COLUMN IF NOT EXISTS max_capacity INTEGER;

-- Helps the Drops feed (live drops sorted by soonest deadline)
CREATE INDEX IF NOT EXISTS products_preorder_deadline_idx
  ON products (order_deadline) WHERE is_preorder;
