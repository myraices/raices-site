# MyRaices v23.7.13 — Sales Tax manual por estado

- Elimina la dependencia de TaxJar y variables TAXJAR/TAX_ORIGIN.
- Lee `nurai_settings.payments.sales_tax` como fuente única de tasas manuales por estado.
- Aplica tax solo a productos `physical_taxable`; `food_exempt` queda exento.
- El delivery recibe tax cuando el pedido contiene artículos físicos gravables.
- Si no existe una regla activa para el estado de entrega, bloquea el checkout con `TAX_RULE_NOT_CONFIGURED`.
- Square Orders API continúa realizando/validando la matemática del impuesto mediante tax LINE_ITEM y CalculateOrder.
- El webhook conserva `tax_amount`, `tax_cents` y total definitivo.
- No activa Square Production.
