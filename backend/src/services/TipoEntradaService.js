import { exigir } from '../domain/ErrorNegocio.js';
import { tipoDTO } from './dto.js';
import { randomUUID } from 'node:crypto';
import { TipoEntrada } from '../domain/TipoEntrada.js';

export class TipoEntradaService {
  constructor(repository, eventoRepository) { Object.assign(this, { repository, eventoRepository }); }
  obtener(id) {
    const tipo = this.repository.buscarPorId(id);
    exigir(tipo, 'NOT_FOUND', 'El tipo de entrada no existe.');
    return tipo;
  }
  preparar(eventoId, datos) {
    exigir(Array.isArray(datos) && datos.length > 0, 'INVALID_DATA', 'Incluí al menos un tipo de entrada.');
    return datos.map((dato) => {
      exigir(dato && typeof dato === 'object' && !Array.isArray(dato), 'INVALID_DATA', 'Cada tipo debe ser un objeto.');
      return new TipoEntrada({ id: randomUUID(), eventoId, nombre: dato.nombre, descripcion: dato.descripcion,
        precioCentavos: dato.precioCentavos, cupo: dato.cupo });
    });
  }
  registrar(tipos) { tipos.forEach((tipo) => this.repository.guardar(tipo)); }
  listar(eventoId) {
    exigir(this.eventoRepository.buscarPorId(eventoId), 'NOT_FOUND', 'El evento no existe.');
    return this.repository.deEvento(eventoId).map(tipoDTO);
  }
}
