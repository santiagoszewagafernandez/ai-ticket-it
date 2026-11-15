# Contratos implementados — bloques 2 a 7

API Express en `http://IP-WIFI-PC:3000`. Estado en memoria, en un único proceso. Reiniciar el backend elimina las operaciones de la sesión y vuelve a cargar los ejemplos. No hay registro ni autenticación real.

## Identidad, DTO y errores

- El selector obtiene `GET /usuarios`. Sus identificadores iniciales son `ana`, `bruno` y `lucia`.
- Las operaciones y lecturas de compras requieren `X-Usuario-Id`. La reserva exige que coincida con `compradorId`; el pago, la cancelación y Mis compras siguen limitados al comprador. Detalle, entradas e historial permiten al comprador o al organizador de ese evento. El catálogo y los tipos son públicos.
- `X-Client-Platform` solo permite correlacionar diagnóstico y logs; no concede permisos.
- Una colección devuelve un array JSON; un detalle o mutación devuelve el DTO del recurso. No se devuelven objetos internos del dominio ni referencias circulares.
- Dinero: enteros seguros en **centavos de ARS**. Ejemplo: `precioUnitarioCentavos: 1250000` significa $12.500. El cliente nunca decide el importe definitivo. Los campos extra de precio/total en POST /compras no participan del cálculo.
- Fechas: strings ISO 8601 UTC; la presentación y los días calendario usan `America/Argentina/Buenos_Aires`. Un evento a la 01:00 de mañana está a un día calendario de hoy a las 23:00. Evento comenzado/finalizado: `diasRestantes: null`, con una etiqueta explícita.
- Toda respuesta lleva `Cache-Control: no-store`. Los errores tienen `{ "error": { "code": "...", "message": "..." } }`, sin stack interno.

| HTTP | Casos / códigos |
| --- | --- |
| 400 | `INVALID_DATA`: JSON, cantidad, filtros o campos inválidos, selección vacía/mal formada/repetida. `TYPE_EVENT_MISMATCH`: tipo de otro evento. `TICKET_PURCHASE_MISMATCH`: entrada ajena a la compra o inexistente en ella. |
| 401 | `IDENTITY_REQUIRED`: falta identidad simulada. |
| 403 | `FORBIDDEN`: comprador distinto del actor o compra ajena. |
| 404 | `NOT_FOUND`: usuario, evento, categoría, tipo, compra o ruta inexistentes. |
| 409 | `INSUFFICIENT_CAPACITY`, `EVENT_STARTED`, `RESERVATION_EXPIRED`, `PURCHASE_NOT_PAYABLE`, `TICKET_NOT_CANCELABLE` (utilizada o cancelada), `CANCELLATION_DEADLINE` (pasó el límite). |
| 413 | `PAYLOAD_TOO_LARGE`: cuerpo JSON mayor al límite técnico de 16 KiB. |
| 500 | Falla inesperada o de invariantes; detalle en el servidor. |

Los IDs y filtros deben ser strings no vacíos; parámetros repetidos con forma de array se rechazan. `cantidad` debe ser un número entero seguro y positivo, no un string numérico. Un filtro de categoría inexistente devuelve 404; una combinación válida sin coincidencias devuelve `[]`.

## Consultas

| Ruta | Resultado / filtros |
| --- | --- |
| `GET /health` | Contrato del bloque 1 conservado: status, service y timestamp. |
| `GET /usuarios` | id y nombre, para el selector. |
| `GET /usuarios/:id/favoritos` | Colección propia de eventos completos, incluidos históricos; orden inicio/ID ascendente. |
| `GET /categorias` | id y nombre. |
| `GET /eventos?texto=...&categoriaId=...&orden=fecha` | Próximos eventos. Combina texto de título/descripción y categoría. Texto sin distinción de mayúsculas ni tildes. |
| `GET /eventos/:id` | Detalle, incluso si ya comenzó/finalizó. |
| `GET /eventos/:id/tipos-entrada` | Nombre, descripción, precio, cupo, disponibles y agotado de cada tipo. |
| `GET /usuarios/:id/eventos` | Solo el usuario seleccionado; eventos que organiza, incluidos comenzados y finalizados. Orden: inicio descendente, luego ID. |
| `GET /eventos/:id/compras?estado=...` | Solo el organizador de ese evento; DTO de compras, con comprador, tipo, cantidad, estado, entradas, pago e historial. Estado opcional; mismo orden y estados que Mis compras. |
| `GET /resenas?organizadorId=...` | Reseñas históricas y nuevas, con autor, evento, puntaje, comentario y fecha. Consulta existente reutilizada. |
| `GET /compras?compradorId=...&estado=...` | Solo compras propias; estado opcional. Orden: creación descendente y luego ID. |
| `GET /compras/:id` | DTO de compra, accesible al comprador o al organizador de su evento. |
| `GET /compras/:id/entradas` | Entradas de esa compra; mismos participantes autorizados. |
| `GET /compras/:id/historial` | Cambios de estado agregado en orden de registro; mismos participantes autorizados. |
| `GET /compras/:id/mensajes` | Mensajes en orden de registro; solo comprador u organizador, en cualquier estado de la compra y antes/después del evento. |

`orden`: `fecha` (predeterminado), `precio` o `puntaje`. Por fecha: más próximo primero. Por precio: mínimo de tipos con cupo ascendente; agotados al final, y cero es un precio válido. Por puntaje: promedio de todas las reseñas del organizador descendente, sin calificaciones al final. Desempates: fecha e ID. Los agotados permanecen en el catálogo. Las reseñas iniciales pertenecen a un evento terminado, con compras pagadas y entradas utilizadas; la publicación está implementada en el bloque 6.

El DTO de evento incluye categoría, organizador y reputación `{puntaje, cantidad}`, inicio/fin, lugar, descripción, multimedia `[{tipo, url}]`, `precioDesdeCentavos` (null si agotado), `agotado`, `puedeReservar` y `tiempoEvento`.

## Favoritos dentro de Usuario

| Ruta | Efecto | Respuesta |
| --- | --- | --- |
| `GET /usuarios/:id/favoritos` | Consulta la colección propia. | **200**, array de DTO de evento, vacío si no guardó ninguno. |
| `PUT /usuarios/:id/favoritos/:eventoId` | Incluye el evento una sola vez. Repetir conserva uno. | **200**, colección completa actualizada. |
| `DELETE /usuarios/:id/favoritos/:eventoId` | Excluye el evento. Repetir lo mantiene fuera. | **200**, colección completa actualizada; no 204. |

Las tres requieren `X-Usuario-Id` coincidente con `:id`. Identidad ausente: 401 IDENTITY_REQUIRED; usuario del header inexistente: 404 NOT_FOUND; colección ajena (incluida una URL con otro usuario inexistente): 403 FORBIDDEN. PUT/DELETE comprueban existencia del evento y devuelven 404 si no existe, incluso para quitar; quitar repetido de un evento existente sí es exitoso. No requieren body ni aceptan identidad por body/query. No se restringe a eventos futuros ni se modifica cupo/compra/pago.

Se usan los mismos DTO de detalle de evento, con reputación/disponibilidad/tiempo actualizados al consultar; no se devuelve la colección privada ni objetos mutables. Orden por inicio ascendente, desempate ID. Un evento que comienza desaparece del catálogo pero permanece en favoritos como EN_CURSO; al finalizar figura FINALIZADO. Ambos tienen `puedeReservar: false` y `diasRestantes: null`; detalle sigue accesible. Guardar un agotado no habilita compra. Las reservas y pagos conservan sus validaciones del servidor.

Usuario mantiene IDs en un Set privado, expone una copia y ejecuta agregar/quitar idempotentes. UsuarioService identifica y comprueba propiedad, consulta existencia/DTO de Evento mediante una función inyectada en composición, pide comportamiento a Usuario y lo guarda en UsuarioRepository. Controller adapta HTTP. No hay nueva entidad, service ni repository de Favorito. No hay await entre validación y escritura en este proceso; PUT/DELETE concurrentes repetidos conservan la semántica definida. Un PUT y DELETE distintos se aplican en orden de procesamiento, sin prometer cuál llega primero.

Frontend espera la respuesta completa para confirmar. La coordinación bloquea envíos simultáneos, aborta/descarta consultas anteriores y no mezcla estado al cambiar usuario/URL. Un timeout no se presenta como éxito; se permite consultar/repetir porque PUT/DELETE son idempotentes. Salir/segundo plano detiene solicitudes; volver recupera el estado actual. Reiniciar Express restablece favoritos vacíos.

## Chat por compra: HTTP y WebSocket

Biblioteca backend **ws 8.23.0**, fijada en package.json y package-lock.json; requiere Node >=10, compatible con el Node 24.19.0 del proyecto. Se conservaron Express 5.3.0 y todas las versiones del frontend. El iPhone usa el WebSocket incluido en React Native 0.88.1, sin instalar Socket.IO ni otro paquete. Se revisó Clase 10, PDF pp. 36–39, y la [documentación oficial de ws](https://github.com/websockets/ws/tree/8.23.0). El broadcast académico se reemplazó por distribución por compra y participación.

`GET /compras/:id/mensajes` requiere `X-Usuario-Id` y devuelve un array (vacío si todavía no hay mensajes). Falta de identidad: 401; tercero: 403; usuario/compra inexistentes: 404. Los DTO de mensaje son:

```json
{
  "id": "id asignado por el backend",
  "compraId": "id de la compra",
  "autor": { "id": "ana", "nombre": "Ana Torres" },
  "texto": "Hola",
  "idEnvio": "identificador opaco del envío original",
  "fecha": "2026-11-14T15:40:51.421Z"
}
```

`ws://IP-WIFI-PC:3000/compras/:id/chat` comparte el servidor HTTP y el puerto 3000. Una base HTTPS se convierte a WSS. No hay un puerto de chat adicional. La conexión queda ligada a la compra de la ruta y a la identidad del primer mensaje. El primer mensaje permite usar también clientes WebSocket sin headers personalizados; la identidad no se coloca en la URL. Sigue siendo **identidad simulada**, elegible desde el selector, y no login/autenticación real.

| Dirección | JSON / efecto |
| --- | --- |
| Cliente → servidor, primero | `{"tipo":"identificar","usuarioId":"ana","plataforma":"ios"}`. Plataforma solo diagnostica. Verifica usuario y participación antes de habilitar la suscripción. |
| Servidor → cliente | `{"tipo":"listo","compraId":"...","usuarioId":"ana"}`. La suscripción está activa antes de emitir esta respuesta. |
| Cliente → servidor | `{"tipo":"enviar","texto":"Hola","idEnvio":"..."}`. Autor y compra vienen de la conexión; campos extra no permiten cambiarlos. |
| Servidor → participantes, incluido emisor | `{"tipo":"mensaje","mensaje":{...DTO...}}`. El registro ya existe en memoria. Este mismo evento confirma al emisor. |
| Servidor → solicitante | `{"tipo":"error","idEnvio":"...","fatal":false,"error":{"code":"INVALID_DATA","message":"..."}}`. idEnvio se incluye cuando el pedido lo permite; los errores sin correlación se muestran en la conversación. |
| Rechazo de acceso | Mismo sobre de error, `fatal:true`; luego cierre 1008. No habilita suscripción ni guarda mensajes. |

Mensaje protege texto/idEnvio no vacíos y fecha válida. MensajeService recupera la compra, comprueba participación con CompraService, identifica al autor y coordina el guardado en MensajeRepository. Se revalida al enviar y antes de distribuir a cada destinatario. No se consulta el estado de compra para habilitar chat: PENDIENTE, CONFIRMADA, CANCELADA, REEMBOLSADA y UTILIZADA son válidos, también después del evento.

La clave de reintento es **(compraId, autorId, idEnvio)**. El cliente genera idEnvio una sola vez al tocar Enviar y conserva texto e identificador en memoria hasta confirmar o salir de esa sesión. Dos textos iguales con identificadores nuevos son mensajes distintos. Un reintento devuelve únicamente al solicitante el DTO registrado, con el mismo ID/fecha/texto; no se guarda ni difunde otra fila. Reutilizar el idEnvio con otro texto produce `SEND_ID_CONFLICT`. No hay await entre comprobación y escritura en el proceso único; dos conexiones del mismo autor tampoco pueden registrar dos veces ese envío. Reiniciar Express pierde tanto mensajes como claves de reintento.

**Apertura/reconexión sin huecos:** primero abrir socket, identificar y esperar listo; después consultar el historial HTTP mientras se conservan los eventos en vivo. La respuesta completa, en orden de registro, se combina con los eventos de ese intervalo por `mensaje.id`, y se reconcilian los pendientes propios por autor/idEnvio. Así un mensaje anterior a la suscripción aparece en HTTP y uno posterior en vivo; el que aparece en ambos se muestra una vez. Incluso con fechas iguales se conserva el orden del servidor, sin ordenar por UUID. Una respuesta HTTP de una conexión anterior se aborta/descarta mediante su generación.

La UI muestra Conectando, Sincronizando, Conectado, Reconectando, Desconectado o Acceso rechazado. Enviando se transforma en Enviado al recibir el DTO. Si faltó confirmación durante ocho segundos, conserva el envío y ofrece Reintentar mensaje; nunca cambia su idEnvio. Si reconecta y el historial ya contiene ese envío, se confirma sin retransmitir. Se bloquean envíos nuevos durante sincronización/desconexión. La reconexión automática intenta cinco veces con pausas de 1, 2, 4, 8 y 10 segundos; después permite Reconectar chat. Rechazos de acceso no reintentan automáticamente.

Salir de la pantalla, perder foco o pasar a segundo plano cierra el socket, aborta el HTTP y quita handlers/timers. Volver abre otra conexión y recupera historial. Cambiar usuario, compra o URL crea una sesión nueva: no arrastra mensajes locales, borrador ni estados de envío. Los mensajes guardados del chat accesible al nuevo participante sí se recuperan del backend. `useChat` integra foco/AppState; `ChatCompra` mantiene transporte/estado sin depender del renderer.

Límites técnicos: ocho segundos para identificar/sincronizar; ping/pong de transporte cada 25 segundos para detectar conexiones cortadas; mensajes JSON de texto de hasta 16 KiB (mismo criterio técnico que HTTP, sin límite de negocio de caracteres). Un mensaje de transporte mayor cierra con 1009. JSON inválido, binario, texto/idEnvio ausente o tipo desconocido: INVALID_DATA. No se agregaron presencia, confirmaciones de lectura, push ni sockets globales. Los logs `[chat]` registran suscripción, cierre, ID guardado/reintentado, compra, usuario, origen y plataforma; no el contenido del texto. No prueban por sí solos que se haya visto el mensaje en el teléfono.

## Creación conjunta de evento y tipos

`POST /eventos`, con `Content-Type: application/json` y `X-Usuario-Id: lucia`:

```json
{
  "organizadorId": "lucia",
  "titulo": "Festival creado desde la app",
  "descripcion": "Bandas en vivo y nuevas canciones.",
  "categoriaId": "musica",
  "lugar": "Sala Río",
  "inicio": "2026-11-15T21:00:00.000Z",
  "fin": "2026-11-16T00:00:00.000Z",
  "multimedia": [{ "tipo": "imagen", "url": "https://example.com/foto.jpg" }],
  "tiposEntrada": [
    { "nombre": "General", "descripcion": "Acceso al salón.", "precioCentavos": 1250000, "cupo": 5 },
    { "nombre": "VIP", "descripcion": "Sector elevado.", "precioCentavos": 2000000, "cupo": 2 }
  ]
}
```

Devuelve **201**, `Location: /eventos/:id` y el DTO de evento, más `tiposEntrada` con los DTO completos. El servidor asigna los IDs y relaciona cada tipo con el evento creado; no toma IDs enviados por el cliente.

- `organizadorId` debe coincidir con la identidad seleccionada; categoría existente. Título, descripción, nombre y descripción de cada tipo son textos no vacíos.
- Inicio y fin son fechas ISO UTC (`YYYY-MM-DDTHH:mm:ss[.SSS]Z`); se rechazan fechas inexistentes y fin igual o anterior al inicio. No se agregó una restricción de alta exclusiva de eventos futuros. El catálogo aplica su propia regla temporal.
- `lugar` es opcional. `multimedia` es una lista opcional (por defecto vacía) de `{tipo: "imagen" | "video", url}`. URLs HTTP/HTTPS sin credenciales; se valida su estructura, sin descargar ni garantizar disponibilidad del recurso remoto.
- `tiposEntrada` contiene **al menos un tipo**. Precio en centavos y cupo son enteros seguros no negativos; se conservan las reglas de TipoEntrada del bloque 2, incluido precio/cupo cero.
- EventoController delega en EventoService; este recupera organizador/categoría, construye Evento y coordina `TipoEntradaService.preparar`. Todos los tipos se construyen antes de la primera escritura. Solo entonces se registra el conjunto en los Map síncronos, sin `await`. Un rechazo de validación o permisos no deja eventos incompletos ni tipos huérfanos. La garantía corresponde al único proceso en memoria.
- Sin identidad: 401; actor distinto: 403; usuario/categoría inexistente: 404; datos inválidos: 400. No hay edición, eliminación, borrador de dominio ni publicación por etapas.

El alta no es idempotente: la app bloquea doble toque y no reintenta automáticamente. Si se pierde la respuesta, conserva los campos y pide revisar Mis eventos antes de volver a crear.

En la app, los dos pasos comparten un contexto en memoria por usuario y URL del backend. Siguiente y Volver no registran nada. Se convierte la fecha/hora de Buenos Aires a UTC y el precio escrito en pesos a centavos al preparar el envío completo. El formulario solo se limpia tras éxito, cambio de usuario/servidor o reinicio de la app; los errores conservan los valores para corregirlos.

La gestión reúne consultas independientes de tipos y compras, con sus propios estados de carga/error. Se actualiza al volver, recuperar primer plano o arrastrar para recargar. Las consultas procesan vencimientos y observan los mismos tipos/compras de la reserva y el pago. Abrir conversación lleva al chat de esa compra; Escanear entrada abre el lector del evento.

## Reserva

`POST /compras`, con `Content-Type: application/json` y `X-Usuario-Id: ana`:

```json
{
  "compradorId": "ana",
  "eventoId": "noche-indie",
  "tipoEntradaId": "indie-general",
  "cantidad": 2
}
```

Devuelve **201**, header `Location: /compras/:id` y DTO de compra:

- `id`, comprador, evento y tipo de entrada resumidos.
- `estado: PENDIENTE`, cantidad, `precioUnitarioCentavos`, `totalCentavos`, `importeAPagarCentavos`, moneda ARS.
- Creación y vencimiento: menor entre creación + cinco minutos e inicio del evento.
- Una Entrada por unidad, todas `SIN_UTILIZAR`, `pago: null` e historial inicial `PENDIENTE`.
- `puedePagar`, `vencida`, `tiempoEvento`, `zonaHoraria` y `servidorAhora`.

La validación termina antes de escribir cupo, compra, entradas o historial. Las operaciones de repositorios son síncronas y la sección de reserva no contiene `await`: dos solicitudes concurrentes no pueden reservar el mismo último cupo. Esta garantía corresponde al servidor de un proceso en memoria; no se declara una transacción distribuida.

Crear una reserva no es una operación idempotente. El cliente bloquea doble toque y no reintenta automáticamente: si se perdió la respuesta, pide revisar Mis compras antes de reservar de nuevo.

## Pago y vencimiento

`POST /compras/:id/pago` requiere la identidad del comprador, sin importe enviado por el cliente. Devuelve **200** y el DTO de compra con:

```json
{
  "estado": "CONFIRMADA",
  "pago": {
    "id": "identificador del pago simulado",
    "importeCentavos": 2500000,
    "fecha": "2026-11-13T20:26:36.657Z",
    "entradaIds": ["identificador de cada entrada pagada"]
  }
}
```

El cupo ya estaba reservado: pagar no lo descuenta otra vez. El importe usa el precio fijado y las entradas no canceladas. Un reintento devuelve el registro original, con el mismo ID, importe y fecha, sin duplicar historial ni forzar estados posteriores a CONFIRMADA.

El plazo es estricto: se admite pago antes del vencimiento; en el instante exacto ya no. Las reservas nuevas y pagos sin registrar cierran al inicio del evento. El vencimiento cambia las entradas pendientes a CANCELADA, calcula Compra como CANCELADA, libera su cupo una sola vez y registra la transición con actor `SISTEMA`, motivo `VENCIMIENTO` y fecha del límite vencido.

El backend ejecuta `iniciarVencimientos` cada segundo en el mismo proceso y también procesa vencimientos antes de los endpoints de negocio. La consulta en el límite ya refleja el vencimiento aunque el siguiente tick no haya ocurrido. Las compras pagadas no vencen.

Entrada tiene únicamente SIN_UTILIZAR, UTILIZADA y CANCELADA. Compra calcula PENDIENTE, CONFIRMADA, UTILIZADA, CANCELADA o REEMBOLSADA desde pago y entradas; no guarda un estado agregado mutable independiente. Compra y EntradaRepository conservan las mismas instancias.

## Cancelación parcial y reembolso simulado

`POST /compras/:id/cancelaciones`, `Content-Type: application/json`, `X-Usuario-Id` del comprador:

```json
{
  "entradaIds": ["identificador de la primera entrada elegida", "identificador de otra entrada elegida"]
}
```

Devuelve **200** y el DTO completo actualizado de Compra. No recibe importe, precio, actor en el body ni cantidad de cupos a devolver. El organizador que no sea comprador recibe 403; solo su participación en el evento no habilita esta operación. Compra inexistente: 404; falta de identidad: 401.

- `entradaIds` es un array no vacío de strings no vacíos, sin repetidos. Cada ID debe pertenecer a esa compra y estar SIN_UTILIZAR. Una selección mixta con una utilizada, cancelada, ajena o inexistente rechaza el conjunto sin cancelar ninguna ni modificar pago, reembolso, cupo o historial.
- Se admite hasta `evento.inicio - 1 hora`, inclusive. Inicio a las 21:00: a las 20:00:00.000 se permite; a las 20:00:00.001 se rechaza. No exige que el resto de la compra esté sin usar. El vencimiento de las pendientes conserva su regla propia y se procesa antes de las rutas.
- Se comprueban todas las precondiciones de Compra/Entrada y la capacidad de devolver en TipoEntrada antes de escribir. CompraService coordina la cancelación, reembolso y liberación de cupo sin `await`, y guarda las mismas instancias en los repositorios Map. Esta consistencia corresponde al proceso único en memoria y al reembolso simulado; no describe una transacción de una pasarela externa.
- Con pago, se acumula el precio fijado de las seleccionadas incluidas en `pago.entradaIds`. El pago original conserva ID, importe, fecha y lista de entradas pagadas. Sin pago, se libera cupo sin reembolso. El pago posterior incluye solo las activas; el vencimiento original no se extiende.
- Repetir una cancelación devuelve **409 TICKET_NOT_CANCELABLE**. La comprobación de CANCELADA sucede antes de los cambios: no duplica cupo, reembolso ni historial. Dos solicitudes concurrentes por la misma entrada producen un éxito y un conflicto. No hay reintento automático en la app.
- Todas canceladas sin pago: CANCELADA. Todas canceladas con pago y su devolución: REEMBOLSADA, también si el precio era cero. Una utilizada + una cancelada + una sin usar: CONFIRMADA. Dos utilizadas + una cancelada: UTILIZADA. Solo cambia el historial si cambia ese estado agregado; el motivo es `CANCELACION_COMPRADOR`, actor comprador y fecha del servidor. Las canceladas conservan sus IDs y estado.
- Una cancelación manual total no se etiqueta después como vencimiento. Si se cancela solo una parte sin pagar y luego vence la reserva, el vencimiento libera únicamente las restantes y registra su transición automática una sola vez.

Campos de importes/cantidades del DTO, comunes a detalle, Mis compras y compras de gestión:

| Campo | Significado |
| --- | --- |
| `cantidad`, `totalCentavos` | Cantidad e importe originales de la reserva, conservados. |
| `cantidadActiva`, `cantidadCancelada` | Entradas no canceladas (incluye utilizadas) y canceladas. Suman `cantidad`. |
| `precioUnitarioCentavos` | Precio fijado en la reserva; una modificación posterior del tipo no altera pago/reembolso. |
| `importeAPagarCentavos` | Precio fijado por cantidad activa. Indica el importe del pago cuando aún no hay pago registrado; con pago se conserva el campo como subtotal vigente y no se vuelve a cobrar. |
| `pago.importeCentavos`, `pago.fecha` | Importe efectivamente pagado y fecha originales, inalterados. `pago: null` antes de pagar. |
| `importeReembolsadoCentavos` | Devolución simulada acumulada de las entradas pagadas canceladas; cero sin pago. |
| `importeNetoCentavos` | Pago original menos reembolso acumulado; cero si no hubo pago. |
| `limiteCancelacion` | ISO UTC del inicio menos una hora. |
| `puedeCancelar` | Elegibilidad temporal/de estado de la compra al consultar; el cliente además comprueba ser comprador. La mutación siempre vuelve a validar. |

Ejemplo: reserva tres a $12.500, paga $37.500 y cancela una: `totalCentavos` y `pago.importeCentavos` conservan 3750000; reembolso 1250000, neto 2500000, dos activas y una cancelada. Si cancela una antes de pagar, paga 2500000 por las otras dos; cancelar luego una de esas devuelve 1250000. No se devuelve dinero por la que nunca se pagó. El reintento de pago recupera el original incluso después de REEMBOLSADA.

La selección vive en el detalle, fuera del dato que se reemplaza al consultar. Un error o una recarga no la borra. Entradas utilizadas/canceladas no se pueden seleccionar; si una seleccionada cambió al recargar, se permite desmarcarla y se exige corregir antes de confirmar. Se bloquea el doble envío y la salida durante la operación. Éxito limpia la selección y vuelve a consultar. Mis compras/gestión usan el mismo resumen de importes y recargan al volver, recuperar primer plano o por gesto manual; no se incorporó WebSocket.

## Entradas QR, consulta y confirmación de ingreso

QR de cada Entrada: `ai-ticket-it:entrada:v1:` + `encodeURIComponent(entrada.id)`. Formato canónico versionado; no incluye pago/estado/evento ni una firma de autorización. La app extrae el ID y envía el evento seleccionado en el lector por separado. Un QR no sustituye identidad ni validación actual del backend.

| Ruta | Entrada | Resultado |
| --- | --- | --- |
| `GET /entradas/:id/validacion?eventoId=...` | `X-Usuario-Id` del organizador y evento del lector. | 200 con los datos de revisión; **no modifica** entrada, compra, historial ni cupo. |
| `POST /entradas/:id/uso` | Mismo actor, JSON `{eventoId: "..."}`. | 200 con los datos actualizados; uso individual registrado una sola vez. |

Ambas operaciones comprueban usuario, organizador del evento elegido, existencia de entrada/compra, evento correspondiente, estado SIN_UTILIZAR y entrada incluida en `compra.pago.entradaIds`. No hay ventana horaria de admisión. Una compra gratuita requiere igualmente pago simulado aprobado. Estado/pago/actor enviados por el cliente no reemplazan los datos internos.

DTO común de revisión/confirmación:

```json
{
  "entrada": {"id": "demo-jazz-entrada-1", "compraId": "demo-jazz", "estado": "SIN_UTILIZAR", "uso": null},
  "compraId": "demo-jazz",
  "comprador": {"id": "bruno", "nombre": "Bruno Díaz"},
  "evento": {"id": "jazz", "titulo": "Jazz bajo las estrellas"},
  "tipoEntrada": {"id": "jazz-general", "nombre": "General"},
  "numero": 1,
  "cantidad": 2,
  "estadoCompra": "CONFIRMADA"
}
```

Confirmación: `entrada.estado` pasa a UTILIZADA y `uso` contiene `{fecha: "ISO UTC", actor: "lucia"}`. Los DTO de entrada en compra y `GET /compras/:id/entradas` también incluyen `uso` (null antes del ingreso). Compra/EntradaRepository observan la misma instancia. Compra registra INGRESO con fecha/actor solo si cambia el estado agregado; una utilizada y otra sin usar conserva CONFIRMADA y su historial anterior. Usar no modifica cupo, pago ni reembolso.

Rechazos: 400 INVALID_DATA (evento faltante, no textual o repetido en query; body no objeto), 401 IDENTITY_REQUIRED, 403 FORBIDDEN, 404 NOT_FOUND. Conflictos **409**: TICKET_EVENT_MISMATCH, TICKET_UNPAID, TICKET_CANCELED y TICKET_ALREADY_USED. El motivo permanece visible en el lector hasta Escanear otra.

EntradaService vuelve a comprobar todo al confirmar; Compra protege pago/pertenencia/organizador y Entrada el uso único. No hay `await` entre validación y modificación/guardado en el proceso único. Dos lectores pueden consultar 200; dos confirmaciones de la misma entrada producen 200/409, una única fecha/actor y una sola transición agregada si corresponde. QR capturado antes de cancelar/usar deja de admitir ingreso. Las respuestas son DTO explícitos y errores JSON existentes.

El frontend pausa inmediatamente los callbacks tras un escaneo. Confirmar es una acción separada; ante error/red/segundo plano no reenvía automáticamente. Una confirmación de respuesta incierta se verifica escaneando de nuevo. Cámara de `expo-camera 58.0.14`, SVG `15.16.0`, generador `react-native-qrcode-svg 6.3.54`; todos los paquetes previos conservados. Cámara y SVG están incluidos en Expo Go SDK 58; el generador es JavaScript/SVG. El primer permiso y su recuperación requieren comprobación física del teléfono.

## Publicación de reseñas y reputación

`POST /eventos/:id/resenas`, `X-Usuario-Id` del comprador, cuerpo:

```json
{"puntaje": 5, "comentario": "Una buena experiencia."}
```

Devuelve **201** con el mismo DTO de reseña de la consulta existente: `id`, `comprador: {id,nombre}`, `evento: {id,titulo}`, `puntaje`, `comentario`, `fecha` ISO UTC del servidor. ID asignado por backend. No requiere un ID de compra ni acepta al comprador del body como identidad. `GET /resenas?organizadorId=...` conserva contrato y ahora reúne históricas/nuevas, con el evento de cada reseña, orden fecha descendente/ID. No se agregaron endpoints de edición/borrado.

- Evento finalizado: `ahora >= evento.fin`, inclusive. Un milisegundo antes se rechaza.
- Al menos una Entrada UTILIZADA en cualquiera de las compras del actor para ese evento. Otras personas/eventos no acreditan asistencia. No exige compra en estado UTILIZADA: una usada y otra sin usar puede conservar CONFIRMADA y reseñar.
- Una única reseña por **(compradorId, eventoId)**, aunque haya varias compras. Consulta de unicidad y escritura síncronas; dos POST concurrentes producen 201/409. Repository también protege la unicidad.
- `puntaje` es número entero 1–5, sin convertir strings. `comentario` es texto no vacío tras trim; no se agregó límite arbitrario de caracteres. Resena protege formato, fecha, fin y asistencia también fuera de HTTP.
- 400 INVALID_DATA; 401 IDENTITY_REQUIRED; 404 NOT_FOUND (actor/evento); 409 EVENT_NOT_FINISHED, ATTENDANCE_REQUIRED o REVIEW_ALREADY_EXISTS. Rechazos no alteran repositorios, compras, entradas ni reputación.

Cada DTO de compra incorpora `resena: {propia, puedePublicar, motivo}` calculado por comprador/evento: propia es el DTO público o null, puedePublicar considera fin/asistencia/unicidad y motivo explica la inhabilitación. Aparece igual desde detalle, Mis compras y gestión; el frontend ofrece publicar solo al comprador. Así la otra compra del mismo evento reconoce la reseña sin duplicarla ni añadir otro endpoint de lectura.

La reputación existente `{puntaje, cantidad}` promedia **todas las reseñas individuales** del organizador, sin redondear el dato: 5 y 4 en un evento más 1 en otro = 10/3, tres reseñas. No es el promedio de dos promedios. Cero reseñas: null/0, Sin calificaciones, último al ordenar. Catálogo y detalle recalculan al consultar; UI presenta un decimal y recarga al volver/primer plano.

Fixture adicional: Diseño en comunidad · edición anterior (`taller-anterior`), organizado por Bruno, iniciado dos días antes del arranque, duración tres horas. Ana reservó/pagó antes de inicio; usó una de dos durante el evento y conserva otra sin usar (`demo-resena-pendiente`, CONFIRMADA). Otra compra pagada de Ana no tiene uso (`demo-resena-otra-compra`). No hay reseña precargada: ambas reconocen la elegibilidad compartida y después la misma reseña. No se simula una reserva posterior al evento ni se altera el reloj del servidor para la demo.

## Datos y alcance

Los fixtures recrean tres usuarios, tres categorías, cinco eventos próximos y dos históricos. Las fechas se desplazan respecto del arranque. Noche indie tiene ocho General a $12.500 y tres VIP a $20.000; Jazz tiene General agotada y Mesa disponible a $18.000; Acústico está agotado; Ideas que conectan tiene entradas gratuitas. Las ventas precargadas justifican el cupo ocupado. Dos asistentes del evento histórico justifican reputación 4,5 de Lucía; Bruno aparece sin calificaciones como organizador.

Cada entidad implementada tiene archivos propios de dominio, controller, service y repository: Usuario, Categoria, Evento, TipoEntrada, Compra, Entrada, CambioEstadoCompra, Mensaje y Resena. `MemoriaRepository` comparte el mecanismo Map; los repositorios concretos conservan sus consultas. `composicion.js` crea e inyecta instancias duraderas por aplicación.

Cancelación y reembolso simulado están incluidos en el mismo endpoint. Historial de mensajes y chat están incluidos en el bloque 5. Validación/uso y publicación de reseñas están implementados en el bloque 6; favoritos de Usuario está implementado en el bloque 7.
