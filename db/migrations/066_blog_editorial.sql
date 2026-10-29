CREATE TABLE blog_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','rejected')),
  content jsonb NOT NULL,
  evidence jsonb NOT NULL,
  revision integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  human_reviewed_at timestamptz,
  CHECK (status <> 'published' OR published_at IS NOT NULL)
);
CREATE INDEX blog_articles_public ON blog_articles(published_at DESC) WHERE status='published';
CREATE TABLE blog_generation_runs (
  slot date PRIMARY KEY,
  status text NOT NULL CHECK (status IN ('running','completed','failed')),
  lease uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  attempts integer NOT NULL DEFAULT 1,
  article_id uuid REFERENCES blog_articles(id),
  error text
);
