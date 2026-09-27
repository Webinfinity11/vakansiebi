-- A subcategory landing (category + subcategory, optionally a city) gets its own census row.
-- Additive: existing rows keep subcategory NULL; the unique choice now includes it.
ALTER TABLE landing_counts ADD COLUMN IF NOT EXISTS subcategory text;
DROP INDEX IF EXISTS landing_counts_choice;
CREATE UNIQUE INDEX landing_counts_choice ON landing_counts
  (COALESCE(category, ''), COALESCE(city, ''), COALESCE(trait, ''), COALESCE(role, ''), COALESCE(subcategory, ''));
