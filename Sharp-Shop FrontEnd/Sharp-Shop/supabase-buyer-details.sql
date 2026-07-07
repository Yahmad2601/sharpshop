-- Buyer contact + default delivery details, prefilled into checkout so the
-- seller can fulfil orders placed through the "Buy" button.
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS address text;
