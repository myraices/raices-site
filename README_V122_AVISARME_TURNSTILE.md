# Raíces v122 — Protección de Avisarme

- Cloudflare Turnstile en el modal Avisarme.
- Validación obligatoria del token dentro de `save-interest`.
- Validación de nombre en navegador y servidor.
- Campo honeypot invisible.
- El registro en Supabase solo ocurre después de superar la validación.
- Usa las variables existentes `TURNSTILE_SITE_KEY` y `TURNSTILE_SECRET_KEY` en Netlify.

No requiere ejecutar SQL.
