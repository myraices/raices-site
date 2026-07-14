# Raíces v113 — Waitlist bilingüe

La plantilla de lista de espera se selecciona según `LOCALE`/idioma:

- `en` → `BREVO_WAITLIST_TEMPLATE_ID_EN`
- cualquier otro valor → `BREVO_WAITLIST_TEMPLATE_ID_ES`

## Variables requeridas en Netlify

- `BREVO_WAITLIST_TEMPLATE_ID_ES`: ID numérico de **RAICES - Waitlist - ES**
- `BREVO_WAITLIST_TEMPLATE_ID_EN`: ID numérico de **RAICES - Waitlist - EN**

La variable antigua `BREVO_WAITLIST_TEMPLATE_ID` se conserva como respaldo para español.
No incluya claves ni credenciales dentro del repositorio.


## v114 — Community subscription fix
- Existing community contacts are not sent another Welcome email.
- Newsletter submissions no longer reset CUSTOMER or WAITLIST attributes.
- Welcome is sent only by the Brevo automation when a contact is newly added to the community list.
- The form reports when an email is already subscribed.
- Removed duplicate newsletter event handler and added submit guards.
