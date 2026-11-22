# Datos y contrato HTTP
POST /api/runs abre una sesión. GET /api/runs/:id devuelve su estado. POST /api/runs/:id/:command acepta accept, confirm, migrate, correct, accept-new y confirm-new. El servidor decide hora simulada, importe y versión. Operación desconocida 400, sesión inexistente 404 y transición prematura 409. Un bloqueo por divergencia es un resultado del negocio visible en gate=blocked.

runs guarda un UUID de sesión y el checkpoint del consumidor. events contiene una fila por (run_id, seq) con tipo y cuerpo JSON. Los tipos TypeScript están en api/src/domain/run.ts. El estado se reconstruye desde esos hechos y cada pedido acepta una única cotización y confirmación. La API expone centavos enteros. Aplicar el descuento redondea el importe final al centavo más cercano, con mitades hacia arriba.

Las versiones de la matriz se seleccionan por identificador. Las filas se evalúan por prioridad y la última representa el precio de lista. La fecha de vencimiento es exclusiva. El puerto se enlaza a loopback; la ruta del archivo SQLite se configura con RULES_DB. Cada pestaña conserva solo el identificador de sesión. El diseño local presupone un operador de confianza.
