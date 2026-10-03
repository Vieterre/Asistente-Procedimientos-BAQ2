GRANT SELECT (code, name, active) ON public.processes TO asistente_app_test;
GRANT SELECT (user_id, process_code) ON public.user_processes TO asistente_app_test;
GRANT INSERT (user_id, process_code) ON public.user_processes TO asistente_app_test;
GRANT DELETE ON public.user_processes TO asistente_app_test;
GRANT SELECT (id, display_name, role, active, must_change_password) ON public.app_users TO asistente_app_test;

GRANT SELECT (
  id, code, name, process_code, version, status, revision, updated_at,
  current_payload, created_by_user_id, assigned_evaluator_id
) ON public.procedures TO asistente_app_test;

GRANT INSERT (
  id, name, process_code, status, created_by_user_id, current_payload
) ON public.procedures TO asistente_app_test;

GRANT UPDATE (
  name, current_payload, revision, updated_at, status, assigned_evaluator_id
) ON public.procedures TO asistente_app_test;

GRANT SELECT (id, procedure_id, evaluator_id, created_at) ON public.evaluations TO asistente_app_test;
GRANT INSERT (id, procedure_id, evaluator_id, status, criteria_payload) ON public.evaluations TO asistente_app_test;
GRANT UPDATE (status, updated_at) ON public.evaluations TO asistente_app_test;
GRANT INSERT (id, actor_user_id, event_type, entity_type, entity_id, metadata)
  ON public.audit_events TO asistente_app_test;
GRANT SELECT (actor_user_id, event_type, entity_type, entity_id, created_at)
  ON public.audit_events TO asistente_app_test;
GRANT SELECT (id, recipient_user_id, procedure_id, event_type, title, message, created_at, read_at),
      INSERT (id, recipient_user_id, procedure_id, event_type, title, message),
      UPDATE (read_at)
  ON public.user_notifications TO asistente_app_test;

