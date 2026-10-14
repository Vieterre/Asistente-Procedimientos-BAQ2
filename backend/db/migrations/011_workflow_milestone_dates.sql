ALTER TABLE procedures
  ADD COLUMN IF NOT EXISTS submitted_for_review_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS technical_reviewed_at TIMESTAMPTZ;
