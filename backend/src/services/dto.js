import { tiempoEvento, ZONA_HORARIA } from './tiempo.js';

export const usuarioDTO = ({ id, nombre }) => ({ id, nombre });
export const resenaDTO = (resena) => ({
  id: resena.id, comprador: usuarioDTO(resena.comprador), evento: { id: resena.evento.id, titulo: resena.evento.titulo },
  puntaje: resena.puntaje, comentario: resena.comentario, fecha: resena.fecha.toISOString(),
});
export const mensajeDTO = ({ id, compraId, autor, texto, idEnvio, fecha }) => ({
  id, compraId, autor: usuarioDTO(autor), texto, idEnvio, fecha: fecha.toISOString(),
});
export const categoriaDTO = ({ id, nombre }) => ({ id, nombre });
export const entradaDTO = ({ id, compraId, estado, uso }) => ({
  id, compraId, estado, uso: uso ? { fecha: uso.fecha.toISOString(), actor: uso.actor } : null,
});
export const tipoDTO = ({ id, eventoId, nombre, descripcion, precioCentavos, cupo, disponibles }) => ({
  id, eventoId, nombre, descripcion, precioCentavos, cupo, disponibles, moneda: 'ARS', agotado: disponibles === 0,
});
export const cambioDTO = ({ id, compraId, estado, fecha, actor, motivo }) => ({
  id, compraId, estado, fecha: fecha.toISOString(), actor, motivo,
});

export function compraDTO(compra, ahora) {
  return {
    id: compra.id, comprador: usuarioDTO(compra.comprador),
    evento: {
      id: compra.evento.id, titulo: compra.evento.titulo, lugar: compra.evento.lugar,
      inicio: compra.evento.inicio.toISOString(), fin: compra.evento.fin.toISOString(),
    },
    tipoEntrada: { id: compra.tipoEntrada.id, nombre: compra.tipoEntrada.nombre },
    estado: compra.estado, cantidad: compra.entradas.length, moneda: 'ARS',
    precioUnitarioCentavos: compra.precioUnitarioCentavos, totalCentavos: compra.totalCentavos,
    importeAPagarCentavos: compra.importeAPagarCentavos,
    importeReembolsadoCentavos: compra.importeReembolsadoCentavos,
    importeNetoCentavos: compra.importeNetoCentavos,
    cantidadActiva: compra.cantidadActiva, cantidadCancelada: compra.cantidadCancelada,
    limiteCancelacion: compra.limiteCancelacion.toISOString(), puedeCancelar: compra.puedeCancelar(ahora),
    creacion: compra.creacion.toISOString(), vencimiento: compra.vencimiento.toISOString(),
    vencida: compra.estaVencida(ahora),
    puedePagar: compra.estado === 'PENDIENTE' && !compra.estaVencida(ahora) && !compra.evento.comenzo(ahora),
    pago: compra.pago ? {
      id: compra.pago.id, importeCentavos: compra.pago.importeCentavos,
      fecha: compra.pago.fecha.toISOString(), entradaIds: [...compra.pago.entradaIds],
    } : null,
    entradas: compra.entradas.map(entradaDTO), historial: compra.historial.map(cambioDTO),
    tiempoEvento: tiempoEvento(compra.evento, ahora), zonaHoraria: ZONA_HORARIA,
    servidorAhora: ahora.toISOString(),
  };
}
