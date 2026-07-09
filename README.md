# Raíces v94 — Brevo API sync

Esta versión conecta la web con Brevo usando la variable de Netlify `BREVO_API_KEY`.

## Incluye

- Suscríbete → Supabase + Brevo.
- Avisarme cuando abramos → Supabase + Brevo.
- Sign up → Supabase Auth + Brevo.
- Contactos se agregan a la lista Brevo `Raíces Community`.
- Fallback de lista: ID `2`, o usar variable `BREVO_LIST_ID` si se desea.
- Atributos enviados a Brevo: `FIRSTNAME`, `SOURCE`, `WAITLIST`, `CUSTOMER`, `CITY`, `ZIP`, `LAST_CART`.
- Para waitlist se envía confirmación directa por Brevo hasta crear una automatización específica.

## Variables necesarias en Netlify

- `BREVO_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Opcionales:

- `BREVO_LIST_ID` (si no se define, usa `2`)
- `BREVO_SENDER_EMAIL` (default: `info@myraices.com`)
- `BREVO_SENDER_NAME` (default: `Raíces`)

## v95
- Corrige flujo de registro con correo existente.
- Si Supabase detecta email ya registrado, se muestra mensaje para iniciar sesión o recuperar contraseña.
- No sincroniza con Brevo cuando el registro no crea un usuario nuevo.


## v97 - Brevo emails por API

- La app envía directamente las plantillas transaccionales de Brevo.
- Welcome usa template ID 1 por defecto.
- Waitlist usa template ID 3 por defecto.
- Se recomienda desactivar la automatización `Welcome - Raíces Community` para evitar duplicados.
