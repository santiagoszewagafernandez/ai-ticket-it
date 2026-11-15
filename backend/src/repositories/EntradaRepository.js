import { MemoriaRepository } from './MemoriaRepository.js';
export class EntradaRepository extends MemoriaRepository {
  deCompra(compraId) { return this.todos().filter((entrada) => entrada.compraId === compraId); }
}
