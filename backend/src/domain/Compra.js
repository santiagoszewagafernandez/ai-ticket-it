import { randomUUID } from 'node:crypto';
import { Entrada } from './Entrada.js';
import { CambioEstadoCompra } from './CambioEstadoCompra.js';
import { exigir, validarCantidad } from './ErrorNegocio.js';

export const ESTADOS_COMPRA = Object.freeze(['PENDIENTE', 'CONFIRMADA', 'UTILIZADA', 'CANCELADA', 'REEMBOLSADA']);
export const PLAZO_RESERVA_MS = 5 * 60 * 1000;

export class Compra {
  constructor({ id = randomUUID(), comprador, evento, tipoEntrada, cantidad, creacion }) {
    validarCantidad(cantidad);
    exigir(tipoEntrada.eventoId === evento.id, 'TYPE_EVENT_MISMATCH', 'El tipo de entrada no pertenece al evento.');
    evento.exigirVentaAbierta(creacion);
    tipoEntrada.exigirCupo(cantidad);
    exigir(Number.isSafeInteger(tipoEntrada.precioCentavos * cantidad), 'INVALID_DATA', 'El total excede el importe admitido.');
    Object.assign(this, { id, comprador, evento, tipoEntrada, creacion });
    this.precioUnitarioCentavos = tipoEntrada.precioCentavos;
    this.vencimiento = new Date(Math.min(creacion.getTime() + PLAZO_RESERVA_MS, evento.inicio.getTime()));
    this.entradas = Array.from({ length: cantidad }, (_, i) => new Entrada({ id: `${id}-entrada-${i + 1}`, compraId: id }));
    this.pago = null;
    this.importeReembolsadoCentavos = 0;
    this.historial = [];
    this.registrarCambio(creacion, comprador.id, 'RESERVA');
  }

  get estado() {
    const activas = this.entradas.filter((entrada) => entrada.estado !== 'CANCELADA');
    if (activas.length === 0) {
      return this.pago && this.importeReembolsadoCentavos === this.pago.importeCentavos ? 'REEMBOLSADA' : 'CANCELADA';
    }
    if (activas.every((entrada) => entrada.estado === 'UTILIZADA')) return 'UTILIZADA';
    return this.pago ? 'CONFIRMADA' : 'PENDIENTE';
  }

  get totalCentavos() { return this.entradas.length * this.precioUnitarioCentavos; }

  acreditaAsistencia(compradorId, eventoId) {
    return this.comprador.id === compradorId && this.evento.id === eventoId
      && this.entradas.some((entrada) => entrada.estado === 'UTILIZADA');
  }

  validarIngreso(entradaId) {
    const entrada = this.entradas.find((item) => item.id === entradaId && item.compraId === this.id);
    exigir(entrada, 'TICKET_PURCHASE_MISMATCH', 'La entrada no pertenece a esta compra.');
    entrada.exigirSinUtilizar();
    exigir(this.pago?.entradaIds.includes(entrada.id), 'TICKET_UNPAID', 'La entrada no tiene un pago aprobado.');
    return entrada;
  }

  confirmarIngreso(entradaId, ahora, actor) {
    exigir(actor === this.evento.organizador.id, 'FORBIDDEN', 'Solo el organizador puede confirmar el ingreso.');
    const entrada = this.validarIngreso(entradaId);
    entrada.utilizar(ahora, actor);
    this.registrarCambio(ahora, actor, 'INGRESO');
    return entrada;
  }
  get cantidadActiva() { return this.entradas.filter((entrada) => entrada.estado !== 'CANCELADA').length; }
  get cantidadCancelada() { return this.entradas.length - this.cantidadActiva; }
  get importeNetoCentavos() { return (this.pago?.importeCentavos ?? 0) - this.importeReembolsadoCentavos; }
  get limiteCancelacion() { return new Date(this.evento.inicio.getTime() - 60 * 60 * 1000); }
  get importeAPagarCentavos() {
    return this.cantidadActiva * this.precioUnitarioCentavos;
  }

  registrarCambio(fecha, actor, motivo) {
    if (this.historial.at(-1)?.estado === this.estado) return;
    this.historial.push(new CambioEstadoCompra({
      id: randomUUID(), compraId: this.id, estado: this.estado, fecha, actor, motivo,
    }));
  }

  estaVencida(ahora) {
    return !this.pago && ahora >= this.vencimiento
      && (this.estado === 'PENDIENTE' || this.historial.some((cambio) => cambio.motivo === 'VENCIMIENTO'));
  }

  puedeCancelar(ahora) {
    return ahora <= this.limiteCancelacion && !this.estaVencida(ahora)
      && this.entradas.some((entrada) => entrada.estado === 'SIN_UTILIZAR');
  }

  validarCancelacion(entradaIds, ahora) {
    exigir(Array.isArray(entradaIds) && entradaIds.length > 0
      && entradaIds.every((id) => typeof id === 'string' && id.trim().length > 0)
      && new Set(entradaIds).size === entradaIds.length,
    'INVALID_DATA', 'Seleccioná una lista no vacía de identificadores de entradas, sin repetidos.');
    const seleccion = entradaIds.map((id) => {
      const entrada = this.entradas.find((item) => item.id === id);
      exigir(entrada && entrada.compraId === this.id, 'TICKET_PURCHASE_MISMATCH', `La entrada ${id} no pertenece a esta compra.`);
      entrada.exigirCancelable();
      return entrada;
    });
    exigir(ahora <= this.limiteCancelacion, 'CANCELLATION_DEADLINE', 'Podés cancelar hasta una hora antes del inicio, inclusive.');
    exigir(!this.estaVencida(ahora), 'RESERVATION_EXPIRED', 'La reserva venció y su cupo fue liberado.');
    return seleccion;
  }

  cancelar(entradaIds, ahora) {
    // Validar el conjunto antes de modificar siquiera la primera entrada.
    const seleccion = this.validarCancelacion(entradaIds, ahora);
    const importe = seleccion.filter((entrada) => this.pago?.entradaIds.includes(entrada.id)).length * this.precioUnitarioCentavos;
    seleccion.forEach((entrada) => entrada.cancelar());
    this.importeReembolsadoCentavos += importe;
    this.registrarCambio(ahora, this.comprador.id, 'CANCELACION_COMPRADOR');
    return seleccion.length;
  }

  vencer(ahora) {
    if (!this.estaVencida(ahora) || this.estado !== 'PENDIENTE') return 0;
    const liberadas = this.entradas.filter((entrada) => entrada.cancelarPorVencimiento()).length;
    this.registrarCambio(this.vencimiento, 'SISTEMA', 'VENCIMIENTO');
    return liberadas;
  }

  pagar(ahora) {
    // Recuperar primero el pago original también después del inicio o de cambios de estado.
    if (this.pago) return this.pago;
    exigir(!this.estaVencida(ahora), 'RESERVATION_EXPIRED', 'La reserva venció y su cupo fue liberado. Podés volver a elegir entradas.');
    this.evento.exigirVentaAbierta(ahora);
    exigir(this.estado === 'PENDIENTE', 'PURCHASE_NOT_PAYABLE', 'Esta compra no admite pago.');
    this.pago = Object.freeze({
      id: randomUUID(), importeCentavos: this.importeAPagarCentavos, fecha: ahora,
      entradaIds: Object.freeze(this.entradas.filter((entrada) => entrada.estado !== 'CANCELADA').map((entrada) => entrada.id)),
    });
    this.registrarCambio(ahora, this.comprador.id, 'PAGO_SIMULADO');
    return this.pago;
  }
}
