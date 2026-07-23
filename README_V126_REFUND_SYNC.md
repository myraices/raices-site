# Raíces v12.6 — Protección de estados de reembolso

- El webhook de Square ignora `payment.updated` posteriores a un reembolso.
- Evita que un pedido reembolsado vuelva a aparecer como pagado en NURAI.
- Incluye `supabase/refund_state_guard_v12.6.sql`; debe ejecutarse una vez.
