ALTER TABLE procedures
  ADD COLUMN IF NOT EXISTS admin_approval_observation TEXT,
  ADD COLUMN IF NOT EXISTS admin_approval_by_user_id UUID REFERENCES app_users(id),
  ADD COLUMN IF NOT EXISTS admin_approval_at TIMESTAMPTZ;
