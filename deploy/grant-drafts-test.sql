GRANT SELECT (code, name, active) ON public.processes TO asistente_app_test;
GRANT SELECT (user_id, process_code) ON public.user_processes TO asistente_app_test;

GRANT SELECT (
  id, code, name, process_code, version, status, revision, updated_at,
  current_payload, created_by_user_id
) ON public.procedures TO asistente_app_test;

GRANT INSERT (
  id, name, process_code, status, created_by_user_id, current_payload
) ON public.procedures TO asistente_app_test;

GRANT UPDATE (
  name, current_payload, revision, updated_at
) ON public.procedures TO asistente_app_test;
