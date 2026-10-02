# Recuperacion del servicio de prueba

Este procedimiento es para una instalacion nueva y aislada. No restaura sobre
`asistente_procedimientos` mientras el servicio activo siga en uso. No publique
el dominio durante la recuperacion.

## Material necesario

- Codigo de la misma version que produjo el respaldo y PostgreSQL 18.
- `asistente-db-YYYY-MM-DD.dump.gpg`: esquema y datos de una base.
- `asistente-service-secrets-YYYY-MM-DD.tar.gpg`: `mfa.key` y `pg.password`.
- Frase GPG guardada fuera del VPS, clave del administrador y acceso a su
  autenticador. Ninguna de estas claves debe entrar en Git, el chat o capturas.
- Huellas SHA-256 anotadas fuera del VPS para verificar cada archivo despues
  de recuperarlo de Drive.

`pg_dump -Fc` no incluye los roles globales. El respaldo probado usa
`asistente_user` como propietario de la base y sus objetos, y
`asistente_app_test` como usuario restringido del servicio. Ambos deben existir
antes de ejecutar `pg_restore`; los permisos de las tablas se restauran desde
el archivo de la base.

## Restaurar en un servidor nuevo

1. Verifique las huellas SHA-256 de ambos archivos cifrados. Instale PostgreSQL
   18 y compruebe que esta disponible el superusuario local `postgres`.
2. Compruebe que los roles y la base destino no existen. En un cluster nuevo,
   cree `asistente_user` y `asistente_app_test` inicialmente con `NOLOGIN`:

   ```bash
   runuser -u postgres -- psql -w -h /var/run/postgresql -U postgres -d postgres -v ON_ERROR_STOP=1 -c 'CREATE ROLE asistente_user NOLOGIN;'
   runuser -u postgres -- psql -w -h /var/run/postgresql -U postgres -d postgres -v ON_ERROR_STOP=1 -c 'CREATE ROLE asistente_app_test NOLOGIN;'
   runuser -u postgres -- createdb -w -h /var/run/postgresql -U postgres -O asistente_user -T template0 asistente_procedimientos
   ```

3. Restaure el archivo de base con el superusuario `postgres`. Lea la frase
   GPG de forma oculta y use `--single-transaction --exit-on-error`. Mantenga
   la lectura de la frase y la restauracion en la misma sesion de consola;
   Hostinger puede reconectarla y borrar variables de shell. Compruebe el
   codigo de salida antes de avanzar. No use `--clean` ni `--create` contra
   una base activa. En la consola del VPS, para el respaldo fechado el 2 de
   octubre y la base temporal vacia del ensayo, se probo este comando completo:

   ```bash
   set -o pipefail; read -r -s -p 'Frase de respaldo: ' BACKUP_PASSPHRASE; printf '\n'; gpg --batch --pinentry-mode loopback --passphrase-fd 3 --no-symkey-cache --decrypt /root/asistente-db-2026-10-02.dump.gpg 3<<<"$BACKUP_PASSPHRASE" | runuser -u postgres -- pg_restore -w -h /var/run/postgresql -U postgres -d asistente_restore_20261002 --exit-on-error --single-transaction; rc=$?; unset BACKUP_PASSPHRASE; echo RESTORE_EXIT=$rc
   ```

   Use este comando solo despues de comprobar que la base destino esta vacia.
   En una recuperacion real, cambie el nombre de destino por el de la base
   nueva. En un ensayo posterior, elija otro nombre temporal nuevo.
4. Descifre el archivo de credenciales solo en un directorio root con permisos
   `700`, y deje `mfa.key` y `pg.password` con propietario root y permisos
   `600`. No imprima su contenido. Compruebe que el archivo tar contiene solo
   esos dos nombres antes de extraerlo. La clave de MFA debe ser la misma que
   protegio los secretos MFA de la base; una clave nueva no los descifra.
5. En una consola privada de `psql`, use `\password asistente_app_test` para
   asignar a ese rol el valor guardado en `pg.password`; despues habilite
   `LOGIN`. Si la clave no esta disponible, genere otra, actualice
   `pg.password` y vuelva a cifrar y guardar el respaldo de credenciales.
   Mantenga `asistente_user` sin login salvo que una tarea de migracion lo
   requiera y tenga credenciales propias. Conceda `CONNECT` sobre la base al
   rol `asistente_app_test` si no quedo concedido en el nuevo cluster.
6. Compruebe las tablas y las migraciones con `backend/src/tools/check-db.js`
   usando `PGDATABASE=asistente_procedimientos` y la cuenta del servicio.
   Compare el numero de usuarios, administradores activos, migraciones y
   eventos de auditoria con el inventario del respaldo. Una prueba local de
   inicio de sesion tambien debe usar esa misma base destino, la clave MFA
   restaurada, la contrasena del administrador y un codigo actual del
   autenticador. La herramienta actual puede mostrar el codigo temporal en
   pantalla; no comparta capturas ni registros de esa prueba.
7. Instale `deploy/asistente-procedimientos-test.service` con sus rutas de
   credenciales, cargue systemd y arranque el servicio. Verifique que escucha
   solo en `127.0.0.1:3000`, que `/health/db` responde correctamente y que
   `admin:check-service-login` valida inicio, consulta y cierre de sesion.
   Si el telefono autenticador se perdio, detenga la puesta en servicio: aun
   no existe un flujo de recuperacion de MFA. Solo despues de completar estas
   pruebas debe evaluarse la exposicion del dominio por separado.

Documentacion de PostgreSQL: [pg_dumpall y roles globales](https://www.postgresql.org/docs/18/app-pg-dumpall.html),
[pg_restore y transaccion unica](https://www.postgresql.org/docs/18/app-pgrestore.html).

## Ensayo realizado el 2 de octubre de 2026

Se restauro `asistente-db-2026-10-02.dump.gpg` en
`asistente_restore_20261002`, una base temporal distinta de la activa.
`pg_restore` termino con codigo 0. La base activa y la restaurada mostraron,
respectivamente, los mismos conteos: 1 usuario, 1 administrador activo con
MFA, 4 migraciones, 3 eventos de auditoria y 9 tablas publicas. La cuenta
`asistente_app_test` completo `check-db.js` contra la base restaurada.
El inicio, la consulta y el cierre de sesion del administrador tambien
terminaron con `ACCESO_VALIDADO` contra la copia. El servicio original siguio
activo y `/health/db` respondio `{"ok":true}`. Este ensayo no sustituyo la
base activa; la creacion de roles en un cluster nuevo aun no se ha ensayado.
