# Preparacion de produccion controlada

Esta guia prepara `civicflow-assistants1.vieterre.tech` para ejecutar el
backend completo sin mezclarlo con el servicio ni la base de datos de pruebas.
No modifique DNS ni habilite el sitio HTTPS hasta completar la verificacion
controlada y autorizar el corte final.

## Aislamiento requerido

- Checkout: `/opt/asistente-backend-production`.
- Servicio: `asistente-procedimientos-production.service`, en `127.0.0.1:3001`.
- Base: `asistente_procedimientos_prod`.
- Rol de aplicacion: `asistente_app_prod`.
- Credenciales solo en `/etc/asistente-procedimientos-production/`, con
  propietario `root` y permisos `600`.
- Dominio: `civicflow-assistants1.vieterre.tech`.

La aplicacion de produccion no comparte base, usuario de PostgreSQL, puerto,
directorios ni secretos con las pruebas. El administrador inicial se crea
solamente en la nueva base y debe completar MFA antes de operar.

## Preparacion sin corte publico

1. Respaldar y verificar el respaldo de la base de produccion vacia o de la
   base que se vaya a sustituir. No restaurar ni ejecutar comandos destructivos
   sobre la base de pruebas.
2. Crear el rol `asistente_app_prod` y la base `asistente_procedimientos_prod`.
   Conservar la contrasena solo en `pg.password`; crear una clave MFA diferente
   en `mfa.key`. No registrar ni copiar los secretos a Git, al chat o a capturas.
3. Publicar el checkout validado en `/opt/asistente-backend-production`, aplicar
   todas las migraciones contra la base nueva y ejecutar
   `grant-drafts-production.sql` con PostgreSQL.
4. Instalar la unidad de systemd de produccion y confirmar que escucha solo en
   `127.0.0.1:3001`, que no se reinicia y que `/health/db` responde correctamente.
5. Instalar primero `civicflow-http.nginx.conf`. Con el dominio aun apuntando a
   GitHub Pages, validar Nginx localmente con `nginx -t`; no recargar ni cambiar
   DNS como parte de esta preparacion.

## Verificacion acotada y controlada

Use cuentas ficticias separadas para Administracion, Elaboracion y Evaluacion,
asignadas a un proceso de prueba. No abra, edite ni evalúe procedimientos reales.

1. Confirmar HTTPS, redireccion a `/accounts`, encabezados de seguridad y salud
   de la base.
2. Iniciar sesion con las tres cuentas y comprobar que cada rol ve solo sus
   funciones autorizadas.
3. Crear un borrador ficticio, guardar una modificacion, enviarlo a un Evaluador
   ficticio y comprobar la notificacion.
4. Iniciar una evaluacion, devolver un hallazgo, responderlo como Elaborador y
   reenviarlo; comprobar la trazabilidad y la nueva iteracion.
5. Abrir la vista preliminar y generar el reporte estandar. Para un procedimiento
   ficticio favorable, confirmar que solo Administracion puede abrir el reporte
   institucional con marca.
6. Comprobar que el flujograma, tablas y saltos de pagina se ven correctamente
   en escritorio y movil. Conservar el registro ficticio como evidencia de la
   verificacion; no eliminar datos de produccion durante el corte.

## Corte final

Solo despues de completar la verificacion, confirmar manualmente que el registro
DNS del dominio apunta al VPS, emitir o renovar el certificado, sustituir el
sitio Nginx HTTP por `civicflow-https.nginx.conf`, ejecutar `nginx -t` y recargar
Nginx. Repetir los pasos 1 y 2 de la verificacion desde la URL publica. Tener
disponible el cambio de DNS inverso a GitHub Pages como plan de retorno.
