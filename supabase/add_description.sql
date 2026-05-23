-- Add description column to menu_items (safe, idempotent)
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS description TEXT;

-- Add index for faster text search on descriptions (optional but helpful)
CREATE INDEX IF NOT EXISTS idx_menu_items_name ON menu_items(name);
