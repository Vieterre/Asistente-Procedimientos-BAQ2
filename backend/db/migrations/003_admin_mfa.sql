ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS mfa_secret_ciphertext TEXT;
