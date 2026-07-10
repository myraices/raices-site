# Raíces v113 — Waitlist bilingüe

La plantilla de lista de espera se selecciona según `LOCALE`/idioma:

- `en` → `BREVO_WAITLIST_TEMPLATE_ID_EN`
- cualquier otro valor → `BREVO_WAITLIST_TEMPLATE_ID_ES`

## Variables requeridas en Netlify

- `BREVO_WAITLIST_TEMPLATE_ID_ES`: ID numérico de **RAICES - Waitlist - ES**
- `BREVO_WAITLIST_TEMPLATE_ID_EN`: ID numérico de **RAICES - Waitlist - EN**

La variable antigua `BREVO_WAITLIST_TEMPLATE_ID` se conserva como respaldo para español.
No incluya claves ni credenciales dentro del repositorio.
