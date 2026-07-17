# MyRaices v119 — Inventario vivo

- La web usa `products.stock` como inventario disponible.
- Productos publicados con stock 0 permanecen visibles.
- Stock 0 muestra “Agotado temporalmente” y “Avisarme”.
- Se bloquea agregar productos agotados al carrito.
- Los productos agotados previamente guardados se eliminan del carrito al cargar.
- La solicitud “Avisarme” incluye SKU, ID y nombre del producto.
- Al aumentar el stock desde NURAI/Producción, la siguiente carga de la web habilita automáticamente la compra.
