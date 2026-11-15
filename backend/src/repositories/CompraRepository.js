import { MemoriaRepository } from './MemoriaRepository.js';
export class CompraRepository extends MemoriaRepository {
  deComprador(compradorId) { return this.todos().filter((compra) => compra.comprador.id === compradorId); }
  deEvento(eventoId) { return this.todos().filter((compra) => compra.evento.id === eventoId); }
}
