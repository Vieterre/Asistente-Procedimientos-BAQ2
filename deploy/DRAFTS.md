# Borradores en el entorno de pruebas

La pantalla privada `/drafts` usa la sesion real para crear, listar, abrir y actualizar borradores propios. La API se activa solo despues de aplicar la migracion
`006_user_notifications` y los permisos de `grant-drafts-test.sql`. La consola de
cuentas no cambia y el prototipo publico continua guardando localmente.

## Contrato

- `GET /api/processes`: lista codigo y nombre de los procesos activos para el formulario.
- `GET /api/procedures`: lista los procedimientos propios sin el contenido.
- `POST /api/procedures`: crea un borrador con `name`, `processCode` y `payload`.
- `GET /api/procedures/:id`: devuelve un borrador propio con su contenido.
- `PUT /api/procedures/:id`: actualiza `name` y `payload` de un borrador propio;
  exige `revision` y devuelve `409 draft_conflict` si otra edicion gano antes.
- `GET /api/evaluators?processCode=PD`: devuelve evaluadores activos asignados al proceso.
- `POST /api/procedures/:id/submit`: valida el contenido, asigna evaluador, cambia
  a `enviado_a_evaluacion`, crea el registro de evaluacion y audita el envio.
- `GET /api/evaluator/inbox` y `GET /api/evaluator/procedures/:id`: bandeja y
  lectura de procedimientos asignados al evaluador.
- `POST /api/evaluator/procedures/:id/start`: cambia el estado a `en_evaluacion`.
- `GET /api/notifications`: lista solo avisos del usuario autenticado.
- `POST /api/notifications/:id/read` y `POST /api/notifications/read-all`:
  marcan avisos propios como leidos y requieren CSRF.
- `GET /api/admin/analytics`: entrega agregados por periodo, proceso y rol;
  solo Administracion puede consultarlos.

Todas las rutas requieren una sesion activa y una contrasena ya cambiada. Las
escrituras requieren `X-CSRF-Token`. El envio valida los campos metodologicos,
las rutas, controles, anexos y aprobaciones; bloquea la edicion del autor hasta
que se agreguen las transiciones de respuesta del evaluador. Esta entrega no
incluye la matriz de criterios, devolucion de hallazgos ni emision de concepto.
Para un Elaborador, el catalogo y los borradores propios se filtran por la asignacion actual en
`user_processes`; creacion y edicion vuelven a comprobarla en la base. Sin
asignacion no podra abrir ni crear borradores. El Administrador conserva acceso
al catalogo activo completo. Los 13 codigos, nombres, agrupaciones y orden se
contrastan con `processGroups` del formulario original.
Esta pantalla sigue siendo solo de pruebas.

Antes de reiniciar el servicio actualizado, compruebe que la cuenta de prueba
`planeacionprueba` tenga asignado el proceso del borrador de prueba y exista un
Evaluador activo asignado a ese mismo proceso en `user_processes`. Aplique de
nuevo `grant-drafts-test.sql` para conceder las lecturas y escrituras de
procedimientos, evaluaciones, auditoria y notificaciones al rol del servicio.
Las asignaciones
faltantes las debe realizar un administrador de PostgreSQL de forma explicita;
no se crean automaticamente.

La pantalla de prueba edita nombre, proceso, objetivo, alcance, definiciones y
condiciones generales. Los cuatro campos de texto usan las mismas claves de
`payload.fields` del prototipo; al actualizar conserva las secciones del
`payload` aun no conectadas. Tambien permite agregar y eliminar varias normas con
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
Los pasos interiores pueden subir y bajar sin modificar sus identificadores
ni las rutas que los referencian; Inicio y Fin permanecen fijos. Tambien
senala rutas No que van directamente a un punto de control, controles
con atributos obligatorios incompletos e identificadores de conector ausentes
o duplicados. Los retornos que aun pueden llegar a Fin y las bifurcaciones
que no reconvergen antes de Fin se muestran como avisos, no como errores.
La respuesta muestra por separado campos por completar: descripcion de Inicio
y Fin, nombre y descripcion de actividades, pregunta de decisiones y
responsables de actividades y decisiones. No modifica el borrador ni bloquea
su guardado; sirve para distinguir coherencia de rutas de completitud previa
a publicacion.
Todavia no sustituye las reglas completas ni el flujograma del prototipo.
La vista Flujograma de pruebas dibuja el orden actual por responsable, las
rutas Si/No, los destinos de conectores y los puntos de control. La opcion
Mostrar evidencias dibuja el registro o evidencia asociado sin cambiar el
borrador. Los controles de escala permiten alejar, acercar, ajustar al ancho
y volver a 100%, entre 35% y 180%; tampoco cambian el borrador. Es una vista
de comparacion, no la exportacion final del prototipo.

El componente 06 de pruebas permite registrar documentos anexos (documento,
tipo, codigo/referencia y observacion), confirmar No aplica, y anotar cambios
por version, fecha y razon. Usa `payload.annexes`, `payload.changes` y
`payload.settings.annexesNotApplicable` como el prototipo; los cargos y nombres
de Elaboro, Reviso y Aprobo usan sus claves originales de `payload.fields`.
No aplica borra los anexos visibles solo tras confirmacion. Los campos tienen
ayudas metodologicas desplegables. Responsable de actividad, decision y control
usa el catalogo original de 30 cargos agrupados por nivel, con opcion Otro;
los valores personalizados ya guardados se conservan. Elaboro y Reviso son
selectores del catalogo completo; Aprobo solo ofrece cargos Directivos. Los
valores historicos fuera del catalogo se conservan en una opcion identificada.
Los tres cargos deben ser distintos para enviar a evaluacion. Cada nuevo cambio
sugiere el decimal siguiente a la mayor version registrada, conserva la fecha
del dia y requiere razon antes del envio; el usuario asigna versiones mayores
segun la guia y no se aceptan versiones repetidas. El catalogo es de interfaz y
no requiere una migracion de base de datos.

La consola de pruebas incluye una Vista preliminar de solo lectura con los
cambios actuales del formulario (incluidos los no guardados). Presenta las
nueve secciones numeradas del procedimiento, encabezado con proceso, codigo,
version y estado, tablas de normatividad, actividades, controles, anexos y
cambios, responsables y flujograma. Permite imprimir desde el navegador. El
editor usa la paleta azul y verde y los encabezados del prototipo para mantener
continuidad visual; la preliminar no equivale aun a la exportacion PDF oficial.

La seccion Actividades incluye las cuatro reglas metodologicas del modelado del
formulario original: actividad y punto de control, decision, independencia entre
decision y control, y correccion previa al retorno desde la ruta No. Las tarjetas
permiten contraer y expandir cada actividad, decision o conector de forma
independiente, mostrando responsable y estado Completa/Pendiente sin alterar el
borrador. Ese estado aplica las reglas del prototipo: campos obligatorios,
responsables personalizados no ambiguos, destinos Si/No diferentes y los cinco
datos requeridos del punto de control. Una leyenda de color distingue actividades,
decisiones, conectores y puntos de control. El control de
cambios contiene la tabla completa de la Guia para clasificar el cambio y
asignar la version (cuatro cambios menores y cuatro mayores, con ejemplos de
1.1 a 1.4 y de 2.0 a 4.0).

La campana persiste avisos por destinatario: el Evaluador recibe uno al llegar
un procedimiento a su bandeja y el Elaborador recibe otro cuando comienza la
evaluacion. Cada aviso se guarda en la misma transaccion que el cambio de estado;
no puede leerse ni marcarse desde otra cuenta.

`D1 · Analitica` es exclusivo de Administracion. Presenta borradores creados,
ediciones guardadas, envios a revision y evaluaciones iniciadas, con filtros de
7, 30, 90 o 365 dias, proceso y rol. Usa eventos reales de `audit_events`; no
importa metricas locales del prototipo ni representa sesiones, accesos o eventos
que el backend aun no registra. Los conteos empiezan con eventos del backend y
no reconstruyen actividad historica del navegador.

## Contraste del modulo central

El revisor de pruebas y `analyzeFlowGraph` del prototipo comparten el mismo
criterio basico de aristas: Inicio y actividades siguen al elemento siguiente;
decisiones siguen sus rutas Si/No; conectores siguen su destino; Fin no tiene
salida. Ambos identifican elementos inalcanzables, ciclos sin salida,
identificadores de conector repetidos y rutas No directas a un control.
El revisor de pruebas tambien rechaza tipos de elemento desconocidos.

La prueba manual de un borrador ficticio cubrio guardado, reordenamiento,
eliminacion protegida, rutas, correccion de ciclos, comparacion visual y
persistencia tras cerrar sesion. Esto no certifica equivalencia completa:

- El prototipo exige ademas otras reglas de calidad metodologica que la
  pantalla de pruebas todavia no implementa por completo. La revision de
  campos de la pantalla de pruebas no equivale a autorizacion para publicar.
- El prototipo tambien incluye avisos de redaccion, especificidad de roles
  y otros criterios metodologicos que no son parte de Revisar flujo.
- El flujograma del prototipo permite exportar PDF. La vista de pruebas permite
  imprimir la preliminar desde el navegador; aun requiere comparacion manual
  frente al PDF oficial. El zoom y las evidencias tambien requieren esa
  comparacion.
- Falta verificar visualmente casos con varios responsables por actividad,
  bifurcaciones largas, rutas cruzadas y etiquetas extensas en escritorio y
  movil antes de declarar equivalencia del flujograma.

## Activacion

1. Respalde la base activa y verifique el respaldo antes de la migracion.
2. Actualice el checkout del servicio y ejecute `npm test`.
3. Desde `/opt/asistente-backend-test`, aplique las migraciones y registre sus
   checksums usando la cuenta local de PostgreSQL:
   `runuser -u postgres -- env DATABASE_URL='postgresql://postgres@localhost/asistente_procedimientos?host=/var/run/postgresql' node backend/src/tools/migrate.js`
4. Aplique los permisos de la version actualizada:
   `runuser -u postgres -- psql -w -h /var/run/postgresql -U postgres -d asistente_procedimientos -v ON_ERROR_STOP=1 -f deploy/grant-drafts-test.sql`
5. Reinicie solo `asistente-procedimientos-test.service` y verifique
   `/health/db`, la consola de cuentas, y los rechazos `401` sin sesion y
   `403` sin CSRF para las escrituras.
6. Abra `/drafts`: confirme que `planeacionprueba` ve solo `PD`, que el envio
   genera una notificacion para el Evaluador, que iniciar evaluacion avisa al
   Elaborador y que `D1 · Analitica` solo aparece para Administracion.
