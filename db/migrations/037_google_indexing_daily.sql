-- Pacific calendar days, shared by every publisher using this database.
-- Both URL_UPDATED and URL_DELETED attempts consume the same budget.
CREATE TABLE IF NOT EXISTS google_indexing_daily (
  day date PRIMARY KEY,
  requests integer NOT NULL CHECK (requests >= 0)
);
