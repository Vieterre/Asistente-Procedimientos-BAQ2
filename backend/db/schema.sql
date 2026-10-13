CREATE TABLE app_users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('administrador', 'elaborador', 'evaluador')),
  password_hash TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deactivated_at TIMESTAMPTZ,
  deactivated_by UUID REFERENCES app_users(id)
);

CREATE TABLE processes (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE user_processes (
  user_id UUID NOT NULL REFERENCES app_users(id),
  process_code TEXT NOT NULL REFERENCES processes(code),
  PRIMARY KEY (user_id, process_code)
);

CREATE TABLE procedures (
  id UUID PRIMARY KEY,
  code TEXT,
  name TEXT NOT NULL,
  process_code TEXT NOT NULL REFERENCES processes(code),
  version TEXT NOT NULL DEFAULT '1.0',
  status TEXT NOT NULL,
  created_by_user_id UUID NOT NULL REFERENCES app_users(id),
  assigned_evaluator_id UUID REFERENCES app_users(id),
  current_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  approved_payload JSONB,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE evaluations (
  id UUID PRIMARY KEY,
  procedure_id UUID NOT NULL REFERENCES procedures(id),
  evaluator_id UUID NOT NULL REFERENCES app_users(id),
  status TEXT NOT NULL,
  score NUMERIC(5,2),
  critical_failures INTEGER NOT NULL DEFAULT 0,
  open_findings INTEGER NOT NULL DEFAULT 0,
  concept TEXT,
  criteria_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_events (
  id UUID PRIMARY KEY,
  actor_user_id UUID REFERENCES app_users(id),
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE analytics_events (
  id UUID PRIMARY KEY,
  actor_user_id UUID REFERENCES app_users(id),
  event_type TEXT NOT NULL,
  process_code TEXT REFERENCES processes(code),
  procedure_id UUID REFERENCES procedures(id),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION prevent_last_admin_deactivation()
RETURNS trigger AS $$
BEGIN
  IF OLD.role = 'administrador' AND OLD.active = TRUE
     AND (NEW.active = FALSE OR NEW.role <> 'administrador') THEN
    PERFORM pg_advisory_xact_lock(5802001, 1);
    IF (
      SELECT count(*)
      FROM app_users
      WHERE role = 'administrador'
        AND active = TRUE
        AND id <> OLD.id
    ) = 0 THEN
      RAISE EXCEPTION 'No se puede desactivar el ultimo administrador activo';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER guard_last_active_admin
BEFORE UPDATE OF active, role ON app_users
FOR EACH ROW
EXECUTE FUNCTION prevent_last_admin_deactivation();

CREATE OR REPLACE FUNCTION prevent_last_admin_deletion()
RETURNS trigger AS $$
BEGIN
  IF OLD.role = 'administrador' AND OLD.active = TRUE THEN
    PERFORM pg_advisory_xact_lock(5802001, 1);
    IF (
      SELECT count(*)
      FROM app_users
      WHERE role = 'administrador'
        AND active = TRUE
        AND id <> OLD.id
    ) = 0 THEN
      RAISE EXCEPTION 'No se puede eliminar el ultimo administrador activo';
    END IF;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER guard_last_active_admin_deletion
BEFORE DELETE ON app_users
FOR EACH ROW
EXECUTE FUNCTION prevent_last_admin_deletion();
