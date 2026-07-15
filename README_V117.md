# Raíces v117 — Turnstile y validación de registros

Incluye:

- Cloudflare Turnstile en Crear cuenta.
- Cloudflare Turnstile en recuperación de contraseña.
- Validación del token mediante `netlify/functions/verify-turnstile.js`.
- Validación reforzada del nombre antes de crear usuarios.
- Inyección de `TURNSTILE_SITE_KEY` durante el build de Netlify.
- Uso de `TURNSTILE_SECRET_KEY` exclusivamente en la Netlify Function.

Variables requeridas en Netlify:

- `GOOGLE_MAPS_API_KEY`
- `TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`

Flujo de publicación: descomprimir sobre la carpeta local del repositorio, revisar en GitHub Desktop, hacer commit y push.


## v117.1 Netlify deploy fix
- Added TURNSTILE_SITE_KEY to SECRETS_SCAN_OMIT_KEYS because it is a public browser key intentionally injected into the built JavaScript.


## v117.2 — Password recovery redirect fix
- Uses `?mode=reset-password` as a persistent recovery marker.
- Opens the new-password form even when Supabase consumes the token before `auth.js` attaches its listener.
