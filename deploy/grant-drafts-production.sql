GRANT SELECT (code, name, active) ON public.processes TO asistente_app_prod;
GRANT SELECT (user_id, process_code) ON public.user_processes TO asistente_app_prod;
GRANT INSERT (user_id, process_code) ON public.user_processes TO asistente_app_prod;
GRANT DELETE ON public.user_processes TO asistente_app_prod;
-- Authentication, session lifecycle, and the health endpoint require these tables.
-- The migration history remains read-only for the application role.
GRANT SELECT ON public.schema_migrations TO asistente_app_prod;
GRANT SELECT, INSERT, UPDATE ON public.app_sessions TO asistente_app_prod;
GRANT SELECT, INSERT, UPDATE ON public.app_users TO asistente_app_prod;

GRANT SELECT (
  id, code, name, process_code, version, status, revision, updated_at,
  current_payload, created_by_user_id, assigned_evaluator_id,
  admin_approval_observation, admin_approval_by_user_id, admin_approval_at,
  submitted_for_review_at, technical_reviewed_at, approved_at
) ON public.procedures TO asistente_app_prod;

GRANT INSERT (
  id, name, code, process_code, status, created_by_user_id, current_payload
) ON public.procedures TO asistente_app_prod;

GRANT UPDATE (
  name, code, current_payload, approved_payload, revision, updated_at, status, assigned_evaluator_id,
  admin_approval_observation, admin_approval_by_user_id, admin_approval_at,
  submitted_for_review_at, technical_reviewed_at, approved_at
) ON public.procedures TO asistente_app_prod;

GRANT SELECT (id, procedure_id, evaluator_id, status, score, critical_failures,
  open_findings, concept, criteria_payload, created_at, updated_at)
  ON public.evaluations TO asistente_app_prod;
GRANT INSERT (id, procedure_id, evaluator_id, status, criteria_payload) ON public.evaluations TO asistente_app_prod;
GRANT UPDATE (status, score, critical_failures, open_findings, concept,
  criteria_payload, updated_at) ON public.evaluations TO asistente_app_prod;
GRANT INSERT (id, actor_user_id, event_type, entity_type, entity_id, reason, metadata)
  ON public.audit_events TO asistente_app_prod;
GRANT SELECT (actor_user_id, event_type, entity_type, entity_id, reason, created_at)
  ON public.audit_events TO asistente_app_prod;
GRANT SELECT (id, recipient_user_id, procedure_id, event_type, title, message, created_at, read_at),
      INSERT (id, recipient_user_id, procedure_id, event_type, title, message),
      UPDATE (read_at)
  ON public.user_notifications TO asistente_app_prod;
