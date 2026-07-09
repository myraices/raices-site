Raíces v97 - Brevo emails por API

Cambios:
- Brevo deja de depender de automatizaciones por filtros diarios.
- Newsletter / usuario confirmado: envía bienvenida por plantilla Brevo si el contacto es nuevo.
- Waitlist: envía la plantilla Raíces Waitlist Template directamente desde la función Netlify.
- Sigue guardando y actualizando contactos en Raíces Community.
- Usa atributos SOURCE, WAITLIST, CUSTOMER, CITY, ZIP y LAST_CART.

Variables usadas en Netlify:
- BREVO_API_KEY
- BREVO_WELCOME_TEMPLATE_ID (opcional, default 1)
- BREVO_WAITLIST_TEMPLATE_ID (opcional, default 3)
- BREVO_LIST_ID (opcional, default 2)

Importante:
- Desactiva la automatización Welcome - Raíces Community para evitar emails duplicados.
- A partir de esta versión los emails automáticos salen desde la app/API.
