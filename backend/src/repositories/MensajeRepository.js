import { MemoriaRepository } from './MemoriaRepository.js';

export class MensajeRepository extends MemoriaRepository {
  deCompra(compraId) { return this.todos().filter((mensaje) => mensaje.compraId === compraId); }
  deEnvio(compraId, autorId, idEnvio) {
    return this.deCompra(compraId).find((mensaje) => mensaje.autor.id === autorId && mensaje.idEnvio === idEnvio) ?? null;
  }
}
