import { MemoriaRepository } from './MemoriaRepository.js';
import { exigir } from '../domain/ErrorNegocio.js';
export class ResenaRepository extends MemoriaRepository {
  deCompradorEvento(compradorId, eventoId) {
    return this.todos().find((resena) => resena.comprador.id === compradorId && resena.evento.id === eventoId);
  }
  guardar(resena) {
    const anterior = this.deCompradorEvento(resena.comprador.id, resena.evento.id);
    exigir(!anterior || anterior === resena, 'REVIEW_ALREADY_EXISTS', 'Ya publicaste una reseña para este evento.');
    return super.guardar(resena);
  }
  deOrganizador(organizadorId) { return this.todos().filter((resena) => resena.evento.organizador.id === organizadorId); }
}
