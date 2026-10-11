# Protección contra bots — MyRaíces 3.1.33 y NURAI 23.9.36

Estos paquetes son código fuente para desplegar con los builds existentes de Netlify. No están publicados. No requieren SQL.

## Antes de desplegar

1. En Cloudflare Turnstile, abre el widget que ya usa MyRaíces. Autoriza también el dominio real de NURAI. Conserva los dominios de MyRaíces que ya funcionan. Ambas aplicaciones deben usar el mismo widget: Supabase admite una clave secreta de CAPTCHA para el proyecto.
2. En las variables de Netlify de NURAI añade `VITE_TURNSTILE_SITE_KEY` con la clave **pública** del widget. No pongas la clave secreta en ninguna variable `VITE_`.
3. Conserva en MyRaíces `TURNSTILE_SITE_KEY` (pública) y `TURNSTILE_SECRET_KEY` (secreta), así como las demás variables actuales. No cambies las claves de Supabase ni de Brevo.

## Orden de activación

1. Despliega NURAI 23.9.36 desde su carpeta y comprueba que aparece y se completa la verificación en el inicio de sesión. Comprueba también su recuperación de contraseña.
2. Despliega MyRaíces 3.1.33 desde su carpeta. Comprueba que el inicio de sesión, registro y recuperación muestran la verificación y generan un token sin errores. Newsletter y Avisarme conservan su verificación en el servidor.
3. Con ambas aplicaciones desplegadas, ve a Supabase → Authentication → Attack Protection. Activa **Enable Captcha protection**, selecciona **Turnstile**, introduce la clave **secreta** del mismo widget y guarda. No compartas esa clave en capturas ni en el chat.
4. Prueba en una ventana privada: iniciar sesión en MyRaíces y NURAI; registrar y confirmar una cuenta de prueba; recuperar contraseña; reenviar confirmación si corresponde; suscribirse desde Home y Blog. Revisa una sola fila por email en Marketing. Prueba Avisarme si lo usas.

La protección efectiva del registro directo empieza al completar el paso 3. El despliegue del código por sí solo no activa CAPTCHA en Supabase. Coordina estos pasos en una misma sesión.

Si después de activar aparece un error de CAPTCHA, revisa que la clave pública de ambas aplicaciones corresponde a la clave secreta guardada en Supabase y que los dos dominios están autorizados. Desactivar temporalmente CAPTCHA permite diagnosticar el acceso, pero vuelve a dejar abierta la vía de registro directo; no lo consideres una solución definitiva.

## Cambios

- MyRaíces envía `captchaToken` directamente a Supabase en registro, inicio de sesión, recuperación y reenvío. Evita consumirlo previamente en una segunda verificación: los tokens de Turnstile son de un solo uso.
- Añade CAPTCHA al inicio de sesión de NURAI y su recuperación de contraseña.
- Rechaza solicitudes de interés con un origen ausente o desconocido. Todos los orígenes admitidos exigen Turnstile en el servidor, además del campo trampa y validación del nombre cuando corresponde.
- Rechaza la falta de consentimiento de newsletter antes de guardar datos.
- Hace que la sincronización de Brevo exija autenticación interna para todos los orígenes y rechace los desconocidos.
- La sincronización de perfil requiere un email confirmado antes de activar una suscripción de marketing.

## Validación y límites

Se probaron los flujos con servicios simulados y se ejecutaron los builds. No se crearon usuarios ni contactos en producción. La comprobación completa de CAPTCHA, claves, dominios, correo y Supabase requiere las pruebas de activación anteriores. No se dispone de logs que permitan atribuir los registros anteriores a una vía concreta.

Bases utilizadas: MyRaices-3.1.32.zip y NURAI 23.9.35 del paquete MyRaices-3.1.31_NURAI-23.9.35.zip. Si tienes modificaciones posteriores a esas versiones, hay que incorporarlas antes de sustituir el código publicado.
