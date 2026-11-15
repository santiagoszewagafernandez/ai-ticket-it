import { randomUUID } from 'node:crypto';
import { exigir, validarTexto } from './ErrorNegocio.js';

export class Resena {
  static impedimento(comprador, evento, compras, fecha) {
    if (!evento.finalizo(fecha)) return { code: 'EVENT_NOT_FINISHED', message: 'Podés reseñar cuando el evento haya finalizado.' };
    if (!compras.some((compra) => compra.acreditaAsistencia(comprador.id, evento.id))) {
      return { code: 'ATTENDANCE_REQUIRED', message: 'Necesitás al menos una entrada utilizada en este evento para reseñar.' };
    }
    return null;
  }

  constructor({ id = randomUUID(), comprador, evento, compras, puntaje, comentario, fecha }) {
    exigir(Number.isInteger(puntaje) && puntaje >= 1 && puntaje <= 5, 'INVALID_DATA', 'El puntaje debe estar entre 1 y 5.');
    comentario = validarTexto(comentario, 'El comentario');
    exigir(comprador?.id && evento?.id && Array.isArray(compras), 'INVALID_DATA', 'La reseña requiere comprador, evento y sus compras.');
    exigir(fecha instanceof Date && Number.isFinite(fecha.getTime()), 'INVALID_DATA', 'La fecha de la reseña no es válida.');
    const impedimento = Resena.impedimento(comprador, evento, compras, fecha);
    exigir(!impedimento, impedimento?.code, impedimento?.message);
    Object.assign(this, { id, comprador, evento, puntaje, comentario, fecha: new Date(fecha) });
  }
}
