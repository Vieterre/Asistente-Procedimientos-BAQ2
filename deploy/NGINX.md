# Publicacion por Nginx (pendiente de dominio)

El servicio de prueba escucha solamente en `127.0.0.1:3000`. El VPS ya usa
Nginx para otros sitios; no modificar sus bloques existentes para publicar
este servicio.

Antes de exponer la aplicacion:

1. Confirmar con el propietario el subdominio exacto y verificar que su DNS
   apunte al VPS.
2. Crear un bloque Nginx independiente con HTTPS y certificado valido. En la
   ubicacion que envia trafico a `http://127.0.0.1:3000`, establecer:

   ```nginx
   proxy_set_header Host $host;
   proxy_set_header X-Real-IP $remote_addr;
   proxy_pass http://127.0.0.1:3000;
   ```

   `X-Real-IP` debe **reemplazar** cualquier cabecera que aporte el visitante.
   No usar `$proxy_add_x_forwarded_for` como identidad para el limite de login.
3. Solo despues de verificar el bloque, activar `TRUST_LOOPBACK_PROXY=1` en
   `asistente-procedimientos-test.service` y reiniciar el servicio. La app
   acepta `X-Real-IP` solo si la conexion llega desde loopback y la cabecera
   contiene una sola direccion IP valida.
4. Ejecutar `nginx -t` antes de recargar Nginx. Verificar HTTPS, login/MFA,
   cierre de sesion, `/health/db` y que los otros sitios sigan respondiendo.

No habilitar la confianza en el proxy si la cabecera no se reemplaza en Nginx.
