import { entradaDTO } from './dto.js';
import { exigir } from '../domain/ErrorNegocio.js';

export class EntradaService {
  constructor(repository, compraService, eventoService, reloj) { Object.assign(this, { repository, compraService, eventoService, reloj }); }
  listar(compraId, actorId) {
    this.compraService.consultable(compraId, actorId);
    return this.repository.deCompra(compraId).map(entradaDTO);
  }
  paraIngreso(id, eventoId, actorId) {
    const evento = this.eventoService.propio(eventoId, actorId);
    const entrada = this.repository.buscarPorId(id);
    exigir(entrada, 'NOT_FOUND', 'La entrada no existe.');
    const compra = this.compraService.consultable(entrada.compraId, actorId);
    exigir(compra.evento.id === evento.id, 'TICKET_EVENT_MISMATCH', 'La entrada pertenece a otro evento.');
    compra.validarIngreso(id);
    return { entrada, compra };
  }
  resultado(entrada, compra) {
    return {
      entrada: entradaDTO(entrada), compraId: compra.id, comprador: { id: compra.comprador.id, nombre: compra.comprador.nombre },
      evento: { id: compra.evento.id, titulo: compra.evento.titulo },
      tipoEntrada: { id: compra.tipoEntrada.id, nombre: compra.tipoEntrada.nombre },
      numero: compra.entradas.indexOf(entrada) + 1, cantidad: compra.entradas.length, estadoCompra: compra.estado,
    };
  }
  validar(id, eventoId, actorId) {
    const { entrada, compra } = this.paraIngreso(id, eventoId, actorId);
    return this.resultado(entrada, compra);
  }
  usar(id, eventoId, actorId) {
    // Se vuelve a verificar; ninguna espera separa validación y escritura en el proceso único.
    const { entrada, compra } = this.paraIngreso(id, eventoId, actorId);
    compra.confirmarIngreso(entrada.id, this.reloj(), actorId);
    this.compraService.guardar(compra);
    return this.resultado(entrada, compra);
  }
}
