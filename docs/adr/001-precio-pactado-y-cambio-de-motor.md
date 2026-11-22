# Decisión 001 · Conservar el precio aceptado y ensayar el cambio de motor
**Estado:** implementada.

La tienda se compromete con el cliente cuando acepta el pedido. Recalcular el precio al confirmar permite que un vencimiento posterior modifique ese compromiso. Se guarda el importe en centavos, la regla ganadora y la versión junto con el hecho de aceptación. El comando de confirmación toma ese snapshot. La reconstrucción del agregado impide una segunda confirmación para el mismo pedido.

El candidato recibe OrderConfirmed y emite ShadowEvaluated con su propio resultado. Separar este observador permite que falle o se retrase sin invalidar el cobro. Se paga el costo de evaluar cada pedido dos veces y conservar el historial. La secuencia por sesión y el checkpoint durable permiten retomar una entrega; los cambios de proyección y de checkpoint comparten commit. La matriz de cada versión tiene un reloj explícito y filas prioritarias con una regla por defecto.

Cambiar directamente el motor convertiría el primer pedido que cruza medianoche en una prueba sobre un cliente. Comparar únicamente los motores podría aprobar un error compartido. La puerta de migración exige la observación compatible de la versión que se va a activar y el cumplimiento de cada importe y regla esperados por la tienda. Se conserva el historial de intentos bloqueados. El nuevo motor solo cotiza pedidos futuros.

**Cuándo reconsiderar.** Si el negocio cambia el momento del compromiso, Producto debe definir una nueva política y sus casos esperados. Si se incorporan varios consumidores externos o la relectura del historial se vuelve costosa, medir atraso y volumen antes de separar procesos o introducir proyecciones materializadas. Este laboratorio usa sesiones acotadas y versiones locales de un evaluador; una migración de proveedor real debe probar también su adaptador con los mismos casos.
