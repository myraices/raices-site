# MyRaices v123 — Newsletter protegido y estabilidad móvil

## Cambios
- Cloudflare Turnstile en el formulario Newsletter.
- Honeypot y validación de nombre en cliente y servidor.
- Newsletter, Avisarme y avisos de stock solo llegan a Brevo después de superar Turnstile.
- `brevo-subscribe` bloquea llamadas públicas para esos formularios protegidos.
- El menú móvil se inicia independientemente de la carga del catálogo/Supabase.
- Menú móvil más robusto: cierre por fondo, enlace, Escape y cambio a escritorio.
- Ajustes de ancho para Turnstile en pantallas pequeñas.
- Versionado de CSS/JS actualizado para evitar caché móvil antigua.

## Variables existentes requeridas en Netlify
- TURNSTILE_SITE_KEY
- TURNSTILE_SECRET_KEY
- SUPABASE_SERVICE_ROLE_KEY
- BREVO_API_KEY

No requiere SQL adicional.
