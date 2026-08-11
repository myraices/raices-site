# MyRaices v23.7.12 — Tax por dirección

- Elimina la tasa fiscal fija por delivery zone.
- Mantiene NURAI/Supabase como fuente única de zonas y tarifas de delivery.
- Añade un motor fiscal por dirección preparado para TaxJar (`TAXJAR_API_KEY`).
- Usa dirección completa de origen y destino, líneas del pedido y código Food & Groceries 40030 para alimentos.
- Square valida el importe de tax con Orders Calculate antes de crear el Payment Link.
- Si el tax engine no está configurado, los productos taxable quedan bloqueados en vez de cobrar una tasa inventada.
- Productos exentos pueden continuar con tax $0.
