import { exigir, validarCantidad, validarTexto } from './ErrorNegocio.js';

export class TipoEntrada {
  constructor({ id, eventoId, nombre, descripcion, precioCentavos, cupo }) {
    nombre = validarTexto(nombre, 'El nombre del tipo');
    descripcion = validarTexto(descripcion, 'La descripción del tipo');
    validarTexto(eventoId, 'El evento del tipo');
    exigir(Number.isSafeInteger(precioCentavos) && precioCentavos >= 0, 'INVALID_DATA', 'El precio debe expresarse en centavos enteros no negativos.');
    exigir(Number.isSafeInteger(cupo) && cupo >= 0, 'INVALID_DATA', 'El cupo debe ser un entero no negativo.');
    Object.assign(this, { id, eventoId, nombre, descripcion, precioCentavos, cupo });
    this.disponibles = cupo;
  }

  exigirCupo(cantidad) {
    validarCantidad(cantidad);
    exigir(cantidad <= this.disponibles, 'INSUFFICIENT_CAPACITY', `Quedan ${this.disponibles} entradas de ${this.nombre}.`);
  }

  reservar(cantidad) {
    this.exigirCupo(cantidad);
    this.disponibles -= cantidad;
  }

  exigirLiberacion(cantidad) {
    validarCantidad(cantidad);
    exigir(this.disponibles + cantidad <= this.cupo, 'CAPACITY_INVARIANT', 'La devolución supera el cupo del tipo de entrada.');
  }

  liberar(cantidad) {
    this.exigirLiberacion(cantidad);
    this.disponibles += cantidad;
  }
}
