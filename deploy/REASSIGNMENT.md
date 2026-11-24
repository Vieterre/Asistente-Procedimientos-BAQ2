# Reasignación de elaborador

Base de implementación: `4370aecbd880966bd470d139b20d7ac3637110c3`
(`fix/version-vigente-reportes-20261123`).

## Comportamiento

En **Consulta de procedimientos**, Administración puede elegir **Reasignar
elaborador** para un borrador o un procedimiento devuelto para ajustes. La cuenta
destino debe estar activa, tener rol Elaborador y pertenecer al proceso. El motivo
es obligatorio. Si la cuenta exige cambio de contraseña, deberá completarlo antes
de trabajar, conforme al control de acceso existente.

El responsable actual determina bandeja, lectura, edición, respuestas de hallazgos,
envío y reportes. El creador original permanece en `created_by_user_id`. El nuevo
campo `responsible_user_id` es opcional: su valor nulo equivale al creador original.
Los nombres y cargos escritos dentro del documento no se sustituyen automáticamente.

Cada reasignación incrementa la revisión técnica para invalidar formularios
desactualizados; no cambia la versión documental, el código, el estado, el
contenido, la evaluación ni sus fechas. Registra administrador, motivo y ambos
responsables en auditoría, y notifica a las dos cuentas. La operación completa es
transaccional. Requiere sesión administrativa y token CSRF.

## Validación

- `npm test`: regresiones, permisos, API, conflictos y formulario administrativo.
- `CIVICFLOW_TEST_DATABASE_URL=... npm test`: además ejecuta un ciclo completo en
  PostgreSQL, con esquema/rol temporales y los permisos restringidos del servicio.
  Usar exclusivamente una base de pruebas desechable con permisos para crearlos.
- El workflow `reassignment-tests.yml` ejecuta todas las pruebas con PostgreSQL
  aislado en GitHub Actions. No publica en GitHub Pages ni actualiza el VPS.

## Publicación controlada

1. Confirmar la revisión instalada en `/opt/asistente-backend-production` y
   comparar con esta base. Integrar diferencias si producción contiene cambios
   posteriores. No reemplazar otras mejoras con una copia antigua.
2. Comprobar los resultados de las pruebas y respaldar/verificar la base antes
   del mantenimiento. Registrar revisión anterior y migraciones aplicadas.
3. Aplicar la migración nueva `014_procedure_responsibility` mediante el runner
   de migraciones con la cuenta autorizada para administrar el esquema. Limitar
   la espera por bloqueos durante la ventana; si no se puede adquirir el bloqueo,
   cancelar y reintentar después de revisar las transacciones activas.
4. Aplicar `deploy/grant-drafts-production.sql` a la misma base con un usuario
   autorizado para conceder permisos. La cuenta del servicio no debe migrar.
5. Instalar la revisión validada y reiniciar solo el servicio de la aplicación.
   Verificar `/health/db`, inicio de sesión, bandejas y consulta administrativa.
6. Comprobar con cuentas y un procedimiento ficticios: reasignar, pérdida de
   acceso del anterior, guardado del nuevo, respuesta a hallazgos y notificaciones.
   Conservar el registro ficticio como evidencia. No reasignar documentos reales
   como prueba sin una instrucción específica.

## Reversión

Antes de la primera reasignación, puede restaurarse la revisión anterior del
servicio conservando la columna adicional y la migración. No eliminar la columna
ni los eventos de auditoría.

Después de una reasignación real, no volver directamente al código anterior:
volvería a tratar al creador original como responsable. Registrar primero las
reasignaciones y determinar si deben revertirse, de forma auditada, o publicar
una corrección que mantenga el nuevo modelo de acceso. No restaurar un respaldo
sobre datos posteriores al mantenimiento sin evaluar las modificaciones que se
perderían.

La preparación de esta rama no aplica migraciones ni cambios sobre el VPS.
