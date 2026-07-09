Raíces v96 - Fix confirmación de email

Cambios:
- No se sincroniza Brevo al crear cuenta hasta que el usuario confirme e inicie sesión.
- Si el email no está confirmado, se muestra un mensaje claro.
- Se agrega botón para reenviar correo de confirmación desde el login.
- Se evita disparar bienvenida por intentos de registro no confirmados.

Commit sugerido:
v96 fix confirmacion email
