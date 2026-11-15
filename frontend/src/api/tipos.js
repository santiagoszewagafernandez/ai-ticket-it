/** @typedef {{id: string, nombre: string}} Usuario */
/** @typedef {{id: string, compraId: string, autor: Usuario, texto: string, idEnvio: string, fecha: string}} Mensaje */
/** @typedef {{id: string, nombre: string}} Categoria */
/** @typedef {{situacion: string, diasRestantes: number | null, etiqueta: string}} TiempoEvento */
/** @typedef {{puntaje: number | null, cantidad: number}} Reputacion */
/** @typedef {{id: string, titulo: string, descripcion: string, lugar: string, inicio: string, fin: string, categoria: Categoria, organizador: Usuario & {reputacion: Reputacion}, multimedia: {tipo: string, url: string}[], precioDesdeCentavos: number | null, agotado: boolean, puedeReservar: boolean, tiempoEvento: TiempoEvento}} Evento */
/** @typedef {{id: string, eventoId: string, nombre: string, descripcion: string, precioCentavos: number, disponibles: number, cupo: number, agotado: boolean}} TipoEntrada */
/** @typedef {{id: string, compraId: string, estado: string, uso: {fecha: string, actor: string} | null}} Entrada */
/** @typedef {{entrada: Entrada, compraId: string, comprador: Usuario, evento: {id: string, titulo: string}, tipoEntrada: {id: string, nombre: string}, numero: number, cantidad: number, estadoCompra: string}} ValidacionEntrada */
/** @typedef {{id: string, estado: string, fecha: string, actor: string, motivo: string}} Cambio */
/** @typedef {{id: string, comprador: Usuario, evento: {id: string, titulo: string, inicio: string, fin: string, lugar: string}, tipoEntrada: {id: string, nombre: string}, estado: string, cantidad: number, precioUnitarioCentavos: number, totalCentavos: number, importeAPagarCentavos: number, importeReembolsadoCentavos: number, importeNetoCentavos: number, cantidadActiva: number, cantidadCancelada: number, limiteCancelacion: string, puedeCancelar: boolean, creacion: string, vencimiento: string, vencida: boolean, puedePagar: boolean, servidorAhora: string, pago: {id: string, importeCentavos: number, fecha: string, entradaIds: string[]} | null, entradas: Entrada[], historial: Cambio[], tiempoEvento: TiempoEvento, resena: SituacionResena}} Compra */
/** @typedef {{id: string, comprador: Usuario, evento: {id: string, titulo: string}, puntaje: number, comentario: string, fecha: string}} Resena */
/** @typedef {{organizadorId: string, titulo: string, descripcion: string, lugar: string, categoriaId: string, inicio: string, fin: string, multimedia: {tipo: string, url: string}[], tiposEntrada: {nombre: string, descripcion: string, precioCentavos: number, cupo: number}[]}} AltaEvento */
export {};
/** @typedef {{propia: Resena | null, puedePublicar: boolean, motivo: string}} SituacionResena */
