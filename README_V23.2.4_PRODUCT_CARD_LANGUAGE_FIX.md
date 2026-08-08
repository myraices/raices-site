# MyRaices v23.2.4 — Product card language refresh

- Las tarjetas conservan la fuente bilingüe recibida desde Supabase y se relocalizan al cambiar ES/EN.
- `card_description_en` se usa inmediatamente al cambiar a inglés, con fallback al español solo si el campo EN está vacío.
- Se mantiene intacta la carga del catálogo, stock, precio, imágenes, carrito y ficha individual.
- Se actualizan query strings de scripts para evitar que el navegador reutilice JavaScript anterior.
