export class ErrorNegocio extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export function exigir(condicion, code, message) {
  if (!condicion) throw new ErrorNegocio(code, message);
}

export function validarCantidad(cantidad) {
  exigir(Number.isSafeInteger(cantidad) && cantidad > 0, 'INVALID_DATA', 'La cantidad debe ser un entero positivo.');
}

export function validarTexto(valor, nombre) {
  exigir(typeof valor === 'string' && valor.trim().length > 0, 'INVALID_DATA', `${nombre} debe ser un texto no vacío.`);
  return valor.trim();
}
