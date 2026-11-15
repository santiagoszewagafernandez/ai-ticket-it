import { MemoriaRepository } from './MemoriaRepository.js';
export class EventoRepository extends MemoriaRepository {
  deOrganizador(organizadorId) { return this.todos().filter((evento) => evento.organizador.id === organizadorId); }
}
