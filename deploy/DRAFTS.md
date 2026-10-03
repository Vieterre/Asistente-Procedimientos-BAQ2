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
ayudas metodologicas desplegables; los cargos se escriben con sugerencias,
sin implicar una aprobacion real ni bloquear el guardado del borrador incompleto.

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
- El flujograma del prototipo permite exportar PDF. La vista de pruebas aun
  no ofrece esa funcion; el zoom y la visualizacion de evidencias requieren
  comparacion manual adicional con el prototipo.
- Falta verificar visualmente casos con varios responsables por actividad,
  bifurcaciones largas, rutas cruzadas y etiquetas extensas en escritorio y
  movil antes de declarar equivalencia del flujograma.

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
