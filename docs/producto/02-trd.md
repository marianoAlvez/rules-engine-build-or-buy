# Diseño técnico
Angular standalone sirve una única consola. HttpClient transporta comandos y un informe tipado. Signals reflejan el resultado que entrega NestJS. NestJS sirve el bundle Angular y la API desde un único origen, tanto en local como en el servicio público.

El agregado decide qué eventos registrar. SQLite serializa cada decisión en una transacción BEGIN IMMEDIATE y mantiene secuencias independientes por sesión. Al confirmar, se registra el importe aceptado. Un suscriptor independiente evalúa la matriz candidata sobre los hechos del pedido y produce ShadowEvaluated. La notificación en proceso ocurre tras el commit. El registro durable y el checkpoint permiten recuperar notificaciones perdidas al reiniciar. El consumidor guarda su efecto y su avance en una misma transacción.

La activación exige el resultado en sombra de la versión candidata y las pruebas de negocio. Aplicar una sola matriz versionada en un monolito modular permite inspeccionar dónde se elige el reloj sin desplegar infraestructura adicional. Un broker externo tendría sentido con consumidores en procesos independientes y requisitos de volumen distintos. Ver [contratos](05-esquema-backend.md).
