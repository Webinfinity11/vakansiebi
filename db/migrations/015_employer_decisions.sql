-- A person's answer to "are these two names one employer?". Only near spellings that the automatic
-- identity cannot prove are asked; 'merge' joins them everywhere, 'separate' stops asking again.
-- Identities are stored, not raw names, so every spelling of either side follows the decision.
CREATE TABLE IF NOT EXISTS employer_decisions (
  a text NOT NULL,
  b text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('merge','separate')),
  decided_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (a, b),
  CHECK (a < b)
);
