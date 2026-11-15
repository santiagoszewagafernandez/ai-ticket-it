import { cambioDTO } from './dto.js';

export class CambioEstadoCompraService {
  constructor(repository, compraService) { Object.assign(this, { repository, compraService }); }
  listar(compraId, actorId) {
    this.compraService.consultable(compraId, actorId);
    return this.repository.deCompra(compraId).map(cambioDTO);
  }
}
