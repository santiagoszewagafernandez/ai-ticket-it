# Funcionalidades y verificaciones

Verificación del código realizada el **15/11/2026**, antes de preparar su publicación en GitHub.

| Área | Implementación | Pruebas automáticas |
| --- | --- | --- |
| Catálogo y organización | Búsqueda, filtros, orden y alta de eventos con tipos de entrada | [HTTP](../backend/test/http.test.js), [eventos](../backend/test/eventos.test.js), [formulario](../frontend/test/formulario-evento.test.mjs) |
| Compras | Reserva, cupo, precio y vencimiento | [Compras](../backend/test/compras.test.js) |
| Pago y cancelación | Pago simulado, selección por entrada, reembolso y devolución de cupo | [Cancelaciones backend](../backend/test/cancelaciones.test.js), [frontend](../frontend/test/cancelacion.test.mjs) |
| Chat por compra | Participación, historial y mensajes WebSocket | [Mensajes](../backend/test/mensajes.test.js), [chat frontend](../frontend/test/chat.test.mjs) |
| QR e ingreso | Entradas individuales, consulta y confirmación de uso | [Ingreso backend](../backend/test/ingreso.test.js), [frontend](../frontend/test/ingreso.test.mjs) |
| Reseñas y reputación | Condición de asistencia, publicación y promedio | [Reseñas backend](../backend/test/resenas.test.js), [frontend](../frontend/test/resena.test.mjs) |
| Favoritos | Colección por usuario, agregado, eliminación y actualización de interfaz | [Favoritos backend](../backend/test/favoritos.test.js), [frontend](../frontend/test/favoritos.test.mjs) |

## Resultados de esta verificación

- Backend: **183 pruebas correctas**, sin fallos, omisiones ni cancelaciones.
- Frontend: **40 pruebas correctas**, sin fallos, omisiones ni cancelaciones.
- `npm run lint`: correcto.
- `npm run typecheck`: correcto.

Los tests del backend usan repositorios en memoria y conexiones HTTP/WebSocket locales controladas. Los del frontend prueban lógica con respuestas controladas; no constituyen una automatización de la interfaz nativa ni una prueba de accesibilidad con VoiceOver.

La aplicación también se utilizó manualmente en iPhone durante el desarrollo. Esta publicación no atribuye una nueva ejecución manual en el dispositivo a las comprobaciones automáticas anteriores. La memoria de ejecución se reinicia con el proceso de Express.
