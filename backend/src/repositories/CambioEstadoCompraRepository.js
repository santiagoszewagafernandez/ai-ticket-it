import { MemoriaRepository } from './MemoriaRepository.js';
export class CambioEstadoCompraRepository extends MemoriaRepository {
  deCompra(compraId) { return this.todos().filter((cambio) => cambio.compraId === compraId); }
}
