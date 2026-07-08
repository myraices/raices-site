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
