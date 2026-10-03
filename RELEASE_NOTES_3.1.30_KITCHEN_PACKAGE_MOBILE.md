# MyRaíces 3.1.30 — Presentación de paquetes de Cocina

Las tarjetas muestran debajo del nombre la cantidad del paquete para productos Kitchen con más de una unidad. Se toma de units_per_pack en Supabase, mediante unitsPerPackage del catálogo. No se fija una cantidad común para Arepas y Empanadas.

Visible en móvil y desktop, y también en destacados y búsqueda móvil. Texto ES: Paquete de N unidades. Texto EN: Pack of N units. Sin cambios en NURAI, SQL, precios o checkout. Conserva las correcciones de Shipping de 3.1.29.

Desplegar este proyecto en el mismo sitio Netlify con el build existente (python3 scripts/build.py). No ejecutar SQL. Verificar las cantidades reales de los productos en NURAI.
