# Raíces Site v61 — Arquitectura de tienda por colecciones

Esta versión reorganiza la web alrededor de las líneas principales de Raíces:

- Kitchen
- Herbal
- Desserts
- Home
- Wellness
- Naturals queda reservado como próxima línea.

## Incluye

- Nueva home editorial.
- Tienda por categorías y colecciones.
- Productos cargados desde `js/products.js` usando el Master Catalog.
- Carrito local preliminar con subtotal.
- Auth de Supabase preservado.
- Newsletter y WhatsApp preservados.

## Aún no incluye

- Square Checkout final.
- Delivery/taxes automáticos.
- Guardado de pedidos en Supabase.

Es la base visual y de arquitectura antes de conectar checkout y pedidos.


## v80 - Catálogo centralizado

Esta versión agrega `js/catalog.js` como capa única para leer productos, categorías y colecciones.

A partir de esta versión, las próximas fases deben usar `window.RAICES_CATALOG` para:

- Buscar productos por SKU.
- Generar líneas de carrito.
- Filtrar por categoría o colección.
- Preparar checkout con Square.
- Guardar pedidos en Supabase.

La apariencia visual de la web no cambia en esta versión; el cambio es estructural.


## v81
- Carrito lateral completo con miniaturas, variantes, cantidades, eliminar producto y subtotal dinámico.
- Persistencia en localStorage.
- Checkout queda desactivado para la siguiente fase de delivery/Square.

## v82 - Delivery por ZIP Code

- Agregado cálculo de delivery en el carrito lateral.
- No hay pickup.
- Katy / Cinco Ranch: $5.
- Fulshear / Richmond: $8.
- Houston / Sugar Land / Cypress: $15.
- Fuera de zona: mensaje para contactar por WhatsApp.
- Total del carrito ahora suma subtotal + delivery.


## v83 Delivery ZIP fix
- Delivery validates immediately when the 5-digit ZIP is entered.
- Apply button now forces update even when cart is empty.
- Valid ZIP shows zone and cost clearly before checkout.

## v84 — Delivery integrado al carrito
- El ZIP genera un estado de delivery persistente en `localStorage`.
- El costo de delivery se suma al total del carrito cuando hay productos y ZIP válido.
- Se guarda un resumen en `raices_cart_summary` para la próxima fase de checkout/Square.
- Checkout queda preparado, pero el pago real se activará en la siguiente fase.

## v85 - Datos de entrega
- Se agregaron campos de nombre, teléfono, dirección, ciudad, apt/suite e instrucciones de entrega dentro del carrito.
- Los datos se guardan localmente para preparar la integración con Supabase y Square.
- El checkout ahora requiere carrito + ZIP válido + datos obligatorios de entrega.
