# Recorrido de revisión
1. Aceptar pedido. La matriz vigente fija $90 y el registro conserva PROMO10 y tienda/1.
2. Confirmar a las 00:05. OrderConfirmed usa el precio guardado. El observador registra $100 con BASE porque candidato/1 elige la hora de confirmación. Reintentar conserva el único cobro.
3. Intentar migración. El servidor comprueba las pruebas críticas y la observación del pedido real de la sesión. MigrationBlocked mantiene tienda/1. Abrir Matriz y pruebas para localizar la primera divergencia.
4. Corregir la matriz. CandidateCorrected selecciona candidato/2 y el observador vuelve a evaluar el pedido. El historial conserva ambas evaluaciones.
5. Validar y activar. MigrationActivated habilita el candidato corregido para pedidos futuros. Aceptar otro pedido y confirmarlo muestra $100. El original continúa en $90.
6. Recargar conserva la sesión. Reiniciar abre una independiente. Si falta el resultado en sombra tras una interrupción, la API responde 409. El consumidor recupera su checkpoint y la validación puede reintentarse.
