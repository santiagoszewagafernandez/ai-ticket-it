import { exigir } from './ErrorNegocio.js';

export const ESTADOS_ENTRADA = Object.freeze(['SIN_UTILIZAR', 'UTILIZADA', 'CANCELADA']);

export class Entrada {
  constructor({ id, compraId, estado = 'SIN_UTILIZAR' }) {
    exigir(ESTADOS_ENTRADA.includes(estado), 'INVALID_DATA', 'El estado de la entrada no es válido.');
    Object.assign(this, { id, compraId, estado });
    this.uso = null;
  }

  exigirSinUtilizar() {
    exigir(this.estado === 'SIN_UTILIZAR', this.estado === 'UTILIZADA' ? 'TICKET_ALREADY_USED' : 'TICKET_CANCELED',
      this.estado === 'UTILIZADA' ? 'La entrada ya fue utilizada.' : 'La entrada está cancelada.');
  }

  utilizar(fecha, actor) {
    this.exigirSinUtilizar();
    exigir(fecha instanceof Date && Number.isFinite(fecha.getTime()) && typeof actor === 'string' && actor.trim(),
      'INVALID_DATA', 'El uso requiere fecha y actor válidos.');
    this.uso = Object.freeze({ fecha: new Date(fecha), actor });
    this.estado = 'UTILIZADA';
  }

  cancelarPorVencimiento() {
    if (this.estado !== 'SIN_UTILIZAR') return false;
    this.estado = 'CANCELADA';
    return true;
  }

  exigirCancelable() {
    exigir(this.estado === 'SIN_UTILIZAR', 'TICKET_NOT_CANCELABLE', `La entrada ${this.id} está ${this.estado} y no se puede cancelar.`);
  }

  cancelar() {
    this.exigirCancelable();
    this.estado = 'CANCELADA';
  }
}
