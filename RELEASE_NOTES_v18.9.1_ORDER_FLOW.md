# MyRaices v18.9.1 — Flujo de pedido y pago

- El checkout consulta precio, stock y estado directamente desde Supabase.
- El carrito se limpia al confirmarse el pago y la página espera hasta 100 segundos la confirmación segura.
- Se envía un único correo de pedido recibido + pago confirmado mediante Brevo.
- Se crea una notificación interna de NURAI para el pedido pagado.
- Se agregan logs internos por etapa del checkout y webhook.

## SQL obligatorio

Ejecutar `supabase/order_confirmation_email_idempotency_v18.9.1.sql` antes del despliegue.
