# Publicacion de pruebas por Nginx

El servicio de prueba escucha solamente en `127.0.0.1:3000`. El VPS ya usa
Nginx para otros sitios. `civicflow-assistants1.vieterre.tech` sigue en GitHub
Pages; el backend se publica por separado en `asistente-test.vieterre.tech`.

Antes de exponer la aplicacion:

1. Instalar `asistente-test-http.nginx.conf` como sitio independiente. Probar
   con `nginx -t` antes de habilitarlo y recargar. Este bloque solo permite
   el reto ACME; todo lo demas devuelve 404.
2. Crear en Hostinger un registro A `asistente-test` hacia la IP del VPS.
   Verificar DNS y el reto HTTP desde fuera antes de pedir el certificado.
3. Emitir el certificado con `certbot certonly --webroot -w /var/www/html -d
   asistente-test.vieterre.tech`, usando la cuenta Certbot ya registrada.
4. Instalar la unidad systemd actualizada y reiniciar el servicio. Confirmar
   que sigue escuchando solo en loopback y que `/health/db` funciona.
5. Sustituir solo este sitio por `asistente-test-https.nginx.conf`. Ejecutar
   `nginx -t` antes de recargar. Verificar certificado, redireccion a
   `/accounts`, login/MFA, cierre de sesion y los otros sitios.

`X-Real-IP` debe **reemplazar** cualquier cabecera que aporte el visitante.
No usar `$proxy_add_x_forwarded_for` como identidad para el limite de login.
La app acepta `X-Real-IP` solo si la conexion llega desde loopback y la
cabecera contiene una sola direccion IP valida.

No habilitar la confianza en el proxy si la cabecera no se reemplaza en Nginx.
