-- საერთო რიგი ყველა ახალი წერილისთვის; dedupe_key გამორიცხავს გამეორებას.
CREATE TABLE notification_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('applications','deadline','candidate_ack','job_rejected','admin_review')),
  dedupe_key text NOT NULL UNIQUE,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','sent','failed','cancelled')),
  attempts int NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  provider_id text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
CREATE INDEX notification_emails_due ON notification_emails(next_attempt_at) WHERE status IN ('pending','sending');

CREATE TABLE company_notification_settings (
  company_key text PRIMARY KEY REFERENCES company_profiles(company_key) ON DELETE CASCADE,
  application_mode text NOT NULL DEFAULT 'digest' CHECK (application_mode IN ('instant','digest','off')),
  deadline_reminders boolean NOT NULL DEFAULT true,
  auto_reply boolean NOT NULL DEFAULT false,
  auto_reply_template text NOT NULL DEFAULT 'received' CHECK (auto_reply_template IN ('received','interview','information','rejected','accepted')),
  applications_seen_until timestamptz NOT NULL DEFAULT now(),
  auto_reply_since timestamptz,
  last_digest_on date,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO company_notification_settings(company_key) SELECT company_key FROM company_profiles;

-- B: ბოლო უარყოფის მიზეზი თითო ვაკანსიაზე.
CREATE TABLE job_rejections (
  job_id uuid PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('incomplete','no_contact','duplicate','rules','other')),
  note text NOT NULL DEFAULT '' CHECK (length(note) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (reason <> 'other' OR length(btrim(note)) > 0)
);

-- C: სანდო კომპანია და ავტომატური გამოქვეყნების ნიშანი.
ALTER TABLE company_profiles ADD COLUMN trusted_mode text NOT NULL DEFAULT 'auto' CHECK (trusted_mode IN ('auto','on','off'));
ALTER TABLE jobs ADD COLUMN auto_published_at timestamptz, ADD COLUMN auto_publish_reviewed_at timestamptz;
CREATE INDEX jobs_auto_publish_review ON jobs(auto_published_at) WHERE auto_published_at IS NOT NULL AND auto_publish_reviewed_at IS NULL;

CREATE TABLE notification_state (key text PRIMARY KEY, value jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
