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
