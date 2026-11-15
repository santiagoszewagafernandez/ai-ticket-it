import { MemoriaRepository } from './MemoriaRepository.js';
export class TipoEntradaRepository extends MemoriaRepository {
  deEvento(eventoId) { return this.todos().filter((tipo) => tipo.eventoId === eventoId); }
}
