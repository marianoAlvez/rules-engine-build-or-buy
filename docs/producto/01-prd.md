# Precio pactado
Un revisor técnico puede ejecutar una venta y decidir si es seguro reemplazar su motor de precios. La tienda ficticia promete el importe al aceptar el pedido. Fecha comercial de la simulación: medianoche del 23/11/2026, Argentina.

| Requisito | Evidencia observable |
| --- | --- |
| P1. Respetar el compromiso | El pedido de $100 aceptado con cupón a las 23:55 queda en $90. Confirmar a las 00:05 y reintentar conserva un único cobro de $90. |
| P2. Impedir una migración incompatible | El candidato en sombra propone $100. La API mantiene activo el motor original y explica qué caso falló. |
| P3. Corregir con evidencia | El candidato corregido pasa el corpus, se habilita para pedidos nuevos y el pedido anterior conserva su versión. El pedido posterior cuesta $100. |
| P4. Explicar el costo | Se pueden cambiar supuestos y comparar costos sintéticos en 36 meses. |

El cobro es un registro ficticio. Los motores son implementaciones locales del laboratorio. La sesión usa datos aislados por pestaña y se puede reiniciar.
