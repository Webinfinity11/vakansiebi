-- Complete snapshots are replaced in one worker transaction, including zero counts.
CREATE TABLE landing_counts (
  category text,
  city text,
  trait text,
  role text,
  count integer NOT NULL CHECK (count >= 0),
  computed_at timestamptz NOT NULL,
  CHECK (category IS NOT NULL OR city IS NOT NULL OR trait IS NOT NULL OR role IS NOT NULL)
);
CREATE UNIQUE INDEX landing_counts_choice ON landing_counts
  (COALESCE(category, ''), COALESCE(city, ''), COALESCE(trait, ''), COALESCE(role, ''));
