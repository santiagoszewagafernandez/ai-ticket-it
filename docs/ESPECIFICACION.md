# AI Ticket It: especificación acordada

Fecha de consolidación: 13/11/2026.

Este documento reúne decisiones de la conversación. Distingue requisitos de la consigna, acuerdos propios del TP y cuestiones técnicas pendientes. Las indicaciones posteriores del estudiante prevalecen y deben registrarse.

## 1. Requisitos de la consigna

- Backend con Node y Express; frontend con React Native.
- Ejecución local en un dispositivo móvil y almacenamiento en memoria.
- Crear eventos con descripción, categoría, fecha, material multimedia y tipos de entrada con precio y cupo.
- Buscar por texto y categoría; ordenar por precio, fecha y puntaje del organizador.
- Comprar un tipo de entrada de un evento, eligiendo cantidad sin superar el disponible.
- Mostrar compras del comprador, estados y días restantes cuando estén confirmadas.
- Mostrar al organizador las compras de su evento y la disponibilidad por tipo.
- Mensajes entre comprador y organizador, asociados a la compra y accesibles en cualquier momento.
- Cancelación y reembolso sujetos a las condiciones del TP.
- Puntaje numérico y comentario después de utilizar una entrada. El contexto también pide que el evento haya finalizado.
- Mostrar reseñas anteriores del organizador en sus eventos.
- Incluir favoritos, presentes en el contexto general.
- Entrega: video individual de 5 a 10 minutos sobre un flujo implementado, backend, frontend, demostración y reflexión sobre el uso de IA.

Demostrar un flujo en el video no reemplaza implementar el resto de las funcionalidades. La consigna no exige una herramienta de IA paga, MongoDB, despliegue ni una pasarela de pago real.

Fuente: [consigna original](CONSIGNA.md).

## 2. Arquitectura acordada

Cada clase de dominio tendrá su propio controller, service y repository. Este requisito fue indicado explícitamente por el estudiante; prevalece sobre sugerencias genéricas de skills que no impongan un repositorio por entidad.

| Parte | Responsabilidad |
| --- | --- |
| Controller | Interpretar la entrada del transporte, delegar y construir la respuesta. |
| Service | Recuperar objetos, comprobar existencia y participación, y coordinar el caso de uso. |
| Repository | Guardar y recuperar objetos en memoria durante la vida del proceso. |
| Dominio | Ejecutar su comportamiento y proteger sus reglas e invariantes. |

La lógica propia de las entidades permanece en el dominio. Los servicios coordinan operaciones entre entidades. Cada controller ofrece las operaciones necesarias para sus casos de uso; las cuatro capas no implican agregar un CRUD completo a todas las clases.

Las clases acordadas son:

| Clase | Responsabilidad principal |
| --- | --- |
| Usuario | Identidad de demostración, participación como comprador u organizador y favoritos. |
| Evento | Datos del evento, organizador, categoría, fechas, multimedia y tipos ofrecidos. |
| TipoEntrada | Oferta con nombre, descripción, precio y control del cupo. |
| Compra | Comprador, evento, un tipo, entradas individuales, precio acordado, pago, operaciones y estado calculado. |
| Entrada | Identidad de cada entrada concreta y su utilización o cancelación. |
| Mensaje | Texto, emisor, compra, identificación y fecha del mensaje registrado. |
| Reseña | Valoración del comprador para un evento. |
| Categoria | Categoría compartida para clasificar y filtrar eventos. |
| CambioEstadoCompra | Registro de un estado alcanzado, fecha y quién originó el cambio. |

Los datos del pago forman parte de Compra. Los favoritos forman parte de Usuario.

Compra contiene los objetos Entrada. EntradaRepository encuentra esas mismas instancias por identificador; no mantiene copias independientes que puedan desactualizarse. CompraRepository y EntradaRepository deben observar la misma entrada.

Los repositorios duran durante la ejecución del backend. Reiniciar pierde cambios y repone los datos iniciales definidos. Las respuestas de la API usan datos explícitos que eviten ciclos o exposición de referencias mutables internas.

## 3. Identidad y participación

- Una sola clase Usuario: la misma persona puede comprar y organizar eventos.
- Se usa un selector de usuarios de demostración precargados.
- La identidad es simulada. El backend comprueba que el usuario seleccionado corresponda a la operación.
- El comprador opera sobre sus compras y favoritos. El organizador consulta las compras de su evento y confirma ingresos de ese evento.
- El chat se limita a comprador y organizador de esa compra.

La consigna no exige registro o inicio de sesión. No se acordaron restricciones adicionales sobre comprar eventos propios ni una jerarquía de roles exclusivos.

## 4. Reserva, precio, pago y cupo

- La compra se crea PENDIENTE y reserva cupo inmediatamente.
- Selecciona un único TipoEntrada y una cantidad positiva entera. Cada unidad genera una Entrada identificable.
- El precio unitario se fija al crear la reserva y se conserva en Compra.
- El vencimiento es el menor entre creación + 5 minutos e inicio programado del evento.
- Las nuevas reservas y los pagos cierran al inicio. Al llegar al vencimiento, una compra sin pagar deja de admitir pago y libera su cupo una sola vez.
- El vencimiento automático solo afecta reservas pendientes, no compras ya pagadas.
- El comprador simula el pago aprobado. Se conservan el importe efectivamente pagado y su fecha.
- Se paga lo correspondiente a las entradas que no se hayan cancelado antes del pago.
- Confirmar el pago conserva el cupo ya reservado; no lo descuenta otra vez.
- Un reintento de pago recupera el pago registrado, preservando importe, fecha e historial. No fuerza una compra posteriormente utilizada o reembolsada a volver a CONFIRMADA.
- Los precios e importes definitivos se calculan en el backend.

Validar y reservar cupo debe ser consistente ante pedidos concurrentes. La creación completa no debe dejar cupo retenido sin compra ni entradas huérfanas si se rechaza la operación.

Ejemplo de importes: tres entradas a $10.000, pagadas por $30.000, y una cancelada después: pago original $30.000, reembolso $10.000, neto $20.000.

También debe ser consistente cancelar antes de pagar: si se reserva tres y se cancela una, se pagan las otras dos; una cancelación posterior devuelve solamente lo que corresponda a una entrada pagada. Conservar el pago original permite distinguir los importes.

## 5. Estados individuales y de la compra

Entrada tiene tres estados:

| Estado | Significado |
| --- | --- |
| SIN_UTILIZAR | Todavía no se utilizó ni se canceló. Puede pertenecer a una compra pendiente. |
| UTILIZADA | El organizador confirmó el ingreso. |
| CANCELADA | Se anuló y se liberó su cupo. |

El pago se consulta en Compra: SIN_UTILIZAR por sí solo no habilita el ingreso.

Compra calcula su estado a partir del pago y de sus entradas:

| Situación | Estado |
| --- | --- |
| Todas canceladas, sin pago | CANCELADA |
| Todas canceladas, con pago y devolución correspondiente | REEMBOLSADA |
| Sin pago y con entradas pendientes vigentes | PENDIENTE |
| Con pago y al menos una entrada sin utilizar ni cancelar | CONFIRMADA |
| Al menos una utilizada y todas las no canceladas utilizadas | UTILIZADA |

Ejemplos: una utilizada, una cancelada y una sin usar implica CONFIRMADA; dos utilizadas y una cancelada implica UTILIZADA. La cancelación parcial se ve en el detalle; no se agregó PARCIALMENTE_CANCELADA.

Las entradas canceladas permanecen identificables con su estado. Pasar la fecha del evento no transforma automáticamente una entrada sin usar en utilizada ni genera un reembolso.

CambioEstadoCompra conserva el registro inicial PENDIENTE y los cambios reales de estado agregado, con fecha y actor. Un vencimiento se identifica como automático. Los reintentos no duplican registros; un movimiento que deja igual el estado agregado no inventa una transición.

## 6. Cancelación parcial y reembolso

- El comprador elige qué entradas cancelar.
- Solo se cancelan entradas SIN_UTILIZAR y pertenecientes a esa compra.
- El límite es una hora antes del inicio programado, inclusive: evento a las 21:00 permite cancelar hasta las 20:00.
- Se admite cancelación parcial aunque otras entradas de la compra se hayan utilizado, siempre que las seleccionadas y el plazo cumplan las condiciones.
- Si estaban pagadas, cancelación, reembolso simulado y devolución de cupo ocurren en la misma operación.
- Si no estaban pagadas, se libera el cupo sin devolución de dinero.
- Se valida toda la selección antes de modificar. Si alguna entrada dejó de ser cancelable, se rechaza la solicitud completa y se informa el problema.
- Repetir o rechazar una solicitud no vuelve a devolver cupo o dinero.

Comprar durante la última hora implica que la compra ya queda fuera del plazo de cancelación solicitada por el comprador. La expiración automática de una reserva sin pagar conserva su regla propia.

## 7. QR y utilización

- Cada Entrada tiene un QR individual que permite identificarla; el backend decide su validez actual.
- El organizador abre el lector para un evento propio.
- Escanear consulta: no marca automáticamente la entrada como utilizada.
- Se comprueban organizador, evento correspondiente, pago aprobado y estado SIN_UTILIZAR.
- La app muestra la entrada y solicita Confirmar ingreso.
- Esa confirmación vuelve a comprobar las condiciones y registra una sola utilización.
- Si dos dispositivos consultaron la misma entrada, solo la primera confirmación puede registrar su uso. La otra informa que ya fue utilizada.
- Un QR capturado antes de cancelar o utilizar una entrada también debe rechazarse cuando se presente después.

No se acordó una ventana horaria adicional para la admisión. No se debe inventar una apertura 30 minutos antes ni otro plazo como si fuera un requisito del usuario.

## 8. Reseñas y reputación

- Requieren evento finalizado y al menos una entrada utilizada del comprador para ese evento.
- La elegibilidad se evalúa por comprador y evento, considerando sus compras; no exige que toda una compra figure UTILIZADA.
- Una única reseña por comprador y evento, aunque haga varias compras.
- Puntaje entero de 1 a 5 estrellas y comentario.
- El organizador tiene el promedio de todas las reseñas recibidas en sus eventos, con igual peso por reseña. No es un promedio de promedios por evento.
- En otros eventos del organizador se muestran reseñas anteriores indicando a qué evento pertenecen.
- Sin reseñas se muestra Sin calificaciones y se ubica al final al ordenar por puntaje.

Editar o borrar reseñas no fue incluido como funcionalidad acordada.

## 9. Mensajes y WebSocket

- Conversación por compra, entre su comprador y organizador, accesible en cualquier estado y antes o después del evento.
- Historial por HTTP; mensajes nuevos enviados y recibidos por WebSocket.
- La conexión identifica al usuario seleccionado y queda ligada a la compra; no se difunde a todos los clientes del servidor.
- El backend registra el mensaje en memoria, le asigna identificación y fecha, y lo distribuye a las conexiones autorizadas de esa conversación, incluida la del emisor.
- La app muestra Enviando hasta la confirmación del backend y después Enviado.
- Cada intento tiene idEnvio. Un reintento del mismo mensaje conserva ese identificador y recupera el mensaje registrado, sin duplicarlo.
- Al abrir o reconectar se recupera el historial. Se debe evitar perder o duplicar mensajes al combinar historial y eventos en vivo.
- La conexión se abre al entrar al chat y se cierra al salir o cambiar de contexto.

Se eligió WebSocket, reemplazando la propuesta anterior de consultar cada cinco segundos. La biblioteca y los nombres exactos de los mensajes de protocolo se elegirán y documentarán al implementar. El ejemplo de Clase 10 usa ws.

## 10. Catálogo, favoritos y fechas

- El catálogo principal muestra eventos que todavía no comenzaron.
- Los próximos eventos agotados siguen visibles con Agotado y la compra deshabilitada.
- Eventos que ya comenzaron conservan acceso desde compras, favoritos y gestión del organizador.
- La búsqueda combina texto en título y descripción con categoría.
- Orden inicial por fecha: próximos primero.
- Por precio: mínimo entre tipos con cupo, menor primero; agotados al final. Ejemplo: General agotada y VIP disponible a $20.000 implica Desde $20.000.
- Por puntaje: promedio del organizador, mayor primero; sin reseñas al final.
- Favoritos: colección de Usuario. Agregar repetido mantiene un favorito; quitar repetido lo mantiene fuera.
- Días restantes por calendario, no por bloques completos de 24 horas: hoy 23:00 y evento mañana 01:00 implica Mañana.
- Para un evento de hoy se muestra Hoy; comenzado o finalizado se comunica esa situación, sin días negativos ni nuevos estados de Compra.
- Evento contiene inicio y fin programados; su finalización habilita reseñas.
- Multimedia mediante una lista de URLs de imágenes y videos.

## 11. Contratos acordados

Los nombres exactos de los DTO restantes, códigos de error y convención para transportar la identidad simulada se completarán coherentemente al implementar. Las rutas y efectos conversados son:

| Operación | Datos y resultado principal |
| --- | --- |
| POST /compras | compradorId, eventoId, tipoEntradaId, cantidad. Crea reserva, entradas y estado inicial; devuelve identificación, precio, total y vencimiento. |
| POST /compras/:id/pago | Usuario comprador; pendiente vigente. Registra pago y devuelve compra y pago. Un reintento recupera el pago existente. |
| POST /compras/:id/cancelaciones | Identificadores de entradas seleccionadas. Valida conjunto, cancela, devuelve cupo y reembolsa si corresponde. |
| GET /entradas/:id/validacion | Incluye evento elegido en el lector y actor. Consulta condiciones y devuelve datos o motivo del rechazo. |
| POST /entradas/:id/uso | Confirmación del organizador; repite verificaciones y registra uso individual. |
| GET /compras?compradorId=... | Compras propias; filtro opcional por estado, detalle de entradas y datos temporales correspondientes. |
| GET /eventos/:id/compras | Organizador del evento; compras con comprador, tipo, cantidad y estado. Filtro opcional por estado. |
| GET /eventos/:id/tipos-entrada | Tipos, precios y disponibilidad; reutilizable por comprador y organizador. |
| GET /eventos | texto, categoriaId, orden opcionales. Soporta las reglas del catálogo. |
| POST /eventos | Organizador, datos del evento, categoría, fechas, URLs y tipos con nombre, descripción, precio y cupo; creación conjunta. |
| POST /eventos/:id/resenas | Comprador, puntaje y comentario; verifica asistencia, fin y unicidad. |
| GET /resenas?organizadorId=... | Reseñas recibidas, identificando el evento al que pertenecen. |
| GET /usuarios/:id/favoritos | Eventos favoritos del usuario seleccionado. |
| PUT /usuarios/:id/favoritos/:eventoId | Agrega una única relación de favorito. |
| DELETE /usuarios/:id/favoritos/:eventoId | Quita la relación de favorito. |
| GET /compras/:id/mensajes | Historial; solo los participantes de la compra. |
| WebSocket /compras/:id/chat | Identificación del usuario y conversación en vivo, texto e idEnvio. |

Se requieren además consultas de apoyo para selector de usuarios, categorías, detalle de evento, detalle de compra, eventos propios e historial. Sus rutas exactas no se conversaron: como propuestas técnicas pueden usarse GET /usuarios, GET /categorias, GET /eventos/:id, GET /compras/:id, GET /usuarios/:id/eventos y GET /compras/:id/historial. Deben documentarse al adoptarlas.

La consulta de eventos propios conserva los eventos pasados para gestionarlos; no debe heredar accidentalmente el filtro temporal del catálogo principal.

## 12. Pantallas acordadas

| Pantalla o recorrido | Diseño |
| --- | --- |
| Navegación principal | Cuatro pestañas: Catálogo, Favoritos, Mis compras y Mis eventos. Usuario seleccionado arriba y acción para cambiarlo. |
| Catálogo | Lista, una tarjeta por fila. Se eligió Lista frente a Cuadrícula en el boceto. |
| Detalle de evento | Descripción, multimedia, organizador, reputación y reseñas; Elegir entradas abre otra pantalla. |
| Elegir entradas | Tipos como opciones visibles con selector, nombre, descripción, precio y cupo. Cantidad con −/+, inicialmente una; total y Reservar. Agotados identificados. Reservando durante el envío y conservación de selección ante error. |
| Compra pendiente | Resultado de Reservar; detalle reutilizado desde Mis compras. Precio fijado, entradas, estado y plazo para pagar. |
| Detalle de compra | Evento, estado, importes, entradas individuales y acciones según condiciones: pago, cancelación, QR, reseña y conversación. |
| Visor de QR | Pantalla propia con un QR por vez, evento, tipo, número de entrada dentro de la compra y controles para cambiar de entrada. |
| Cancelación | Modo de selección dentro del detalle; entradas utilizadas o canceladas identificadas y no seleccionables. Resumen de selección e importe y Confirmar cancelación. Para pendiente, explica liberación sin devolución monetaria. |
| Chat | Pantalla propia; estados de envío y conexión coherentes con la sección 9. |
| Reseña | Pantalla propia: nombre del evento, cinco estrellas sin preselección, comentario y Publicar reseña. Después muestra Tu reseña, también reconocido desde otras compras del mismo evento. |
| Mis eventos | Acceso a eventos propios y a la creación; permite gestionar también eventos ya comenzados. |
| Crear evento | Dos pasos: datos y URLs; después tipos con Agregar otro tipo. Volver y Siguiente conservan el formulario en memoria de la app. Crear evento envía todo junto. Reiniciar la app antes de enviarlo pierde ese formulario. |
| Gestión de evento | Encabezado con fechas y Escanear entrada arriba; cupos por tipo; compras y filtro por estado. Reúne las dos consultas independientes de compras y tipos. Desde cada compra se accede al detalle y chat. |
| Lector del organizador | Pausa al detectar QR, revisión, Confirmar ingreso y resultado. Mantiene resultado o motivo hasta Escanear otra. |

El boceto comparativo es solo una referencia visual, no la aplicación React Native ni una prueba de iPhone:
