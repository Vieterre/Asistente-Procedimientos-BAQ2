ALTER TABLE app_users ADD COLUMN username TEXT;
ALTER TABLE app_users ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE app_users ALTER COLUMN email DROP NOT NULL;

ALTER TABLE app_users ADD CONSTRAINT app_users_identity_required
  CHECK (username IS NOT NULL OR email IS NOT NULL);
ALTER TABLE app_users ADD CONSTRAINT app_users_username_format
  CHECK (username IS NULL OR username ~ '^[a-z][a-z0-9]{3,31}$');
CREATE UNIQUE INDEX app_users_username_unique ON app_users (username);
