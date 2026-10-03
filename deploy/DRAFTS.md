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
hasta que exista una API de evaluacion independiente. Para un Elaborador, el
catalogo y los borradores propios se filtran por la asignacion actual en
`user_processes`; creacion y edicion vuelven a comprobarla en la base. Sin
asignacion no podra abrir ni crear borradores. El Administrador conserva acceso
al catalogo completo. Esta pantalla sigue siendo solo de pruebas.

Antes de reiniciar el servicio actualizado, compruebe que la cuenta de prueba
`planeacionprueba` tenga asignado el proceso del borrador de prueba. Aplique
de nuevo `grant-drafts-test.sql` para conceder lectura de `user_processes` al
rol del servicio. Una asignacion faltante debe realizarla un administrador de
PostgreSQL de forma explicita; no se crean asignaciones automaticamente.

La pantalla de prueba edita nombre, proceso, objetivo, alcance, definiciones y
condiciones generales. Los cuatro campos de texto usan las mismas claves de
`payload.fields` del prototipo; al actualizar conserva las otras secciones del
`payload` sin mostrarlas. Tambien permite agregar y eliminar varias normas con
los seis campos de `payload.norms` usados por el prototipo. La seccion
Actividades permite agregar y editar actividades ordinarias (nombre,
descripcion, responsable, evidencia y sistema) en `payload.activities`.
Las decisiones permiten registrar pregunta, responsable y rutas Si/No por
identificador de actividad. No se puede eliminar un destino mientras otra
ruta lo referencie. Los conectores reciben un identificador automatico y
permiten elegir un destino; sus identificadores existentes no se editan en
esta pantalla. Las actividades ordinarias pueden marcarse como puntos de
control y registrar responsable, periodicidad, proposito, ejecucion,
desviaciones y evidencia. Los borradores nuevos incluyen Inicio y Fin con
nombre y descripcion editables; los borradores anteriores pueden completarlos
sin duplicar los nodos existentes. Inicio y Fin no se eliminan desde esta
pantalla. El formulario completo sigue sin conectarse; no usar estas
rutas ni los controles como validacion de un flujo publicable.
El boton Revisar flujo comprueba Inicio, Fin, identificadores y destinos de
decisiones y conectores, exige rutas Si/No diferentes y revisa la continuidad
segun el orden de actividades y los destinos explicitados. Senala elementos
inalcanzables, rutas sin salida hacia Fin y ciclos cerrados. Usa los cambios
en pantalla, sin guardar ni impedir que se conserve un borrador incompleto.
Tambien senala rutas No que van directamente a un punto de control, controles
con atributos obligatorios incompletos e identificadores de conector ausentes
o duplicados.
Todavia no sustituye las reglas completas ni el flujograma del prototipo.

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
