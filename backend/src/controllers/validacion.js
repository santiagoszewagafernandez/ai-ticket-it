import { exigir } from '../domain/ErrorNegocio.js';

export function texto(valor, nombre, { opcional = false } = {}) {
  if (valor === undefined && opcional) return undefined;
  exigir(typeof valor === 'string' && valor.trim().length > 0, 'INVALID_DATA', `${nombre} debe ser un texto no vacío.`);
  return valor.trim();
}
export function objeto(valor) {
  exigir(valor && typeof valor === 'object' && !Array.isArray(valor), 'INVALID_DATA', 'Enviá un objeto JSON.');
  return valor;
}
