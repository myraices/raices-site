# MyRaices v23.7.12 — Tax checkout (Sandbox)

- Usa tax_status de NURAI: food_exempt, physical_taxable, digital_review.
- Lee tax_rate desde la zona de delivery administrada en NURAI.
- Aplica tax Square LINE_ITEM solo a physical_taxable.
- Si existe un artículo taxable, el delivery también recibe el tax de la zona.
- Square calcula el monto del tax y el total final del Order.
- Supabase se actualiza con tax_amount/tax_cents/total_amount/total_cents devueltos por Square.
- El webhook vuelve a sincronizar tax y total al confirmar el pago.
- El email de confirmación muestra Sales tax.
- Bloquea artículos digitales en Production mientras sigan digital_review.
- No activa Production ni crea tasas automáticas.
