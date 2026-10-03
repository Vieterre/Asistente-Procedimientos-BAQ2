# Borradores en el entorno de pruebas

La pantalla privada `/drafts` usa la sesion real para crear, listar, abrir y actualizar borradores propios. La API se activa solo despues de aplicar la migracion
`005_draft_revision` y los permisos de `grant-drafts-test.sql`. La consola de
cuentas no cambia y el prototipo publico continua guardando localmente.

## Contrato

- `GET /api/processes`: lista codigo y nombre de los procesos activos para el formulario.
- `GET /api/procedures`: lista los procedimientos propios sin el contenido.
- `POST /api/procedures`: crea un borrador con `name`, `processCode` y `payload`.
- `GET /api/procedures/:id`: devuelve un borrador propio con su contenido.
- `PUT /api/procedures/:id`: actualiza `name` y `payload` de un borrador propio;
  exige `revision` y devuelve `409 draft_conflict` si otra edicion gano antes.

Todas las rutas requieren una sesion activa y una contrasena ya cambiada. Las
escrituras requieren `X-CSRF-Token`. La API no cambia estados de evaluacion ni
interpreta `payload` como una aprobacion. No usarla para el flujo de conceptos
hasta que exista una API de evaluacion independiente. El catalogo no filtra asignaciones de `user_processes`, por lo que esta pantalla no debe usarse con datos reales ni como control de acceso a procesos.

La pantalla de prueba edita nombre, proceso, objetivo, alcance, definiciones y
condiciones generales. Los cuatro campos de texto usan las mismas claves de
`payload.fields` del prototipo; al actualizar conserva las otras secciones del
`payload` sin mostrarlas. El formulario completo sigue sin conectarse.

## Activacion

1. Respalde la base activa y verifique el respaldo antes de la migracion.
2. Actualice el checkout del servicio, ejecute `npm test` y aplique
   `npm run db:migrate` con una cuenta propietaria de la base.
3. Con el administrador local de PostgreSQL, aplique
   `deploy/grant-drafts-test.sql` a `asistente_procedimientos`.
4. Reinicie solo `asistente-procedimientos-test.service` y verifique
   `/health/db`, la consola de cuentas, y los rechazos `401` sin sesion y
   `403` sin CSRF para `POST /api/procedures`.
5. Abra `/drafts` e inicie sesion con un Elaborador de prueba. Pruebe crear,
   abrir y actualizar un borrador. No use datos reales hasta validar el flujo.
