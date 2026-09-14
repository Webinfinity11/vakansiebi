-- Match the identity expression in resolveCompanyLogos. Avoid scanning and
-- unpacking every published snapshot to find logos for one page of vacancies.
CREATE INDEX IF NOT EXISTS jobs_verified_logo_company_idx ON jobs (
  (regexp_replace(regexp_replace(regexp_replace(
    trim(lower(normalize(COALESCE(published->>'company',''),NFKC))),
    '^(შპს|სსიპ|სს|llc|ltd|jsc)[[:space:]]+',''),
    '[[:space:],.]+(llc|ltd|jsc)[.]?$',''),
    '[^a-z0-9ა-ჰ]','','g'))
) WHERE status='published' AND published IS NOT NULL
  AND COALESCE(published->>'logoUrl','')<>'';
