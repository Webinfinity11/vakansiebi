-- Other names a company's vacancies appear under ("სს თიბისი ბანკი", "TBC Bank").
-- Vacancies under any of them, now or later, belong to that company's account.
CREATE TABLE company_name_aliases (
  alias_key text PRIMARY KEY CHECK (length(alias_key) BETWEEN 1 AND 300),
  company_key text NOT NULL REFERENCES company_profiles(company_key) ON DELETE CASCADE,
  alias_name text NOT NULL CHECK (length(alias_name) BETWEEN 1 AND 160),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX company_name_aliases_company ON company_name_aliases(company_key);
-- Rollback: DROP TABLE company_name_aliases; ownership rows already made stay.
