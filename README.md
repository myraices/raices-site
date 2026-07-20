# Raíces Web — v125

Release candidate de preapertura. Esta versión limpia la estructura, unifica la configuración del delivery, prepara los modos PREOPENING/SALES y agrega la base visual del checkout sin pagos.

## Cambio de modo
Editar `js/site-config.js` y cambiar `STORE_MODE`. Mantener `PREOPENING` hasta completar Square, impuestos y validaciones operativas.


## v125 — Carrito definitivo previo a Square
- Drawer simplificado: productos, cantidades, ZIP y total estimado.
- Datos completos de contacto y entrega trasladados al checkout.
- Límite de cantidades según stock publicado.
- Avisos cuando un producto deja de estar disponible.
- Checkout persistente con validación de zona y fee estimado.
- Impuestos y pago reservados para validación final mediante Square.
