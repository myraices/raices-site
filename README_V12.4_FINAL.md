# Raíces v12.4

## Pagos
- Webhook resuelve el pedido primero mediante `payment.order_id` contra `orders.square_order_id`.
- Incluye compatibilidad por ID interno y respaldo mediante `reference_id` recuperado desde Square Orders.
- Un pago `COMPLETED` actualiza automáticamente `status = paid`, `payment_status = completed`, `square_payment_id` y `paid_at`.

## Checkout
- Botón visible: `CONTINUAR AL PAGO`.
- Mensaje: “Serás dirigido a una página de pago segura para completar tu compra.”
- Sin mensajes de Sandbox o pruebas visibles para clientes.

## Productos digitales
- En carrito exclusivamente digital solo se solicitan nombre y correo.
- Se ocultan teléfono y el bloque completo de dirección/entrega.
- Delivery aparece como `No aplica` y su costo es $0.

## Carritos mixtos
- La presencia de cualquier producto físico restaura todos los campos de entrega.
- La cobertura y el costo de delivery se calculan normalmente sobre los productos físicos.
