# MyRaices v121 · Disponibilidad gobernada por stock

- Los productos publicados se consideran disponibles únicamente cuando `products.stock > 0`.
- Los productos digitales o sin control de inventario (`stock = null`) permanecen disponibles.
- `status = sold_out` ya no puede mantener agotado un producto cuyo stock sea positivo.
- Los productos con `stock = 0` muestran “Agotado temporalmente” y el botón “Avisarme”.
- Se actualizaron las versiones de caché de los scripts del catálogo para forzar la carga de la nueva lógica.
- No requiere SQL ni variables nuevas.
