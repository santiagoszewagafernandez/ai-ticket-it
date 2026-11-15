import { Compra, ESTADOS_COMPRA } from '../domain/Compra.js';
import { exigir } from '../domain/ErrorNegocio.js';
import { compraDTO } from './dto.js';

export class CompraService {
  constructor({ repository, entradaRepository, cambioRepository, usuarioService, eventoService, tipoService, resenaService, reloj }) {
    Object.assign(this, { repository, entradaRepository, cambioRepository, usuarioService, eventoService, tipoService, resenaService, reloj });
  }
  dto(compra, ahora) {
    return { ...compraDTO(compra, ahora), resena: this.resenaService.situacion(compra.evento, compra.comprador, ahora) };
  }
  guardar(compra) {
    this.repository.guardar(compra);
    compra.entradas.forEach((entrada) => this.entradaRepository.guardar(entrada));
    compra.historial.forEach((cambio) => this.cambioRepository.guardar(cambio));
  }
  propia(id, actorId) {
    const actor = this.usuarioService.identificar(actorId);
    const compra = this.repository.buscarPorId(id);
    exigir(compra, 'NOT_FOUND', 'La compra no existe.');
    exigir(actor.esCompradorDe(compra), 'FORBIDDEN', 'Solo el comprador puede consultar u operar esta compra.');
    return compra;
  }
  consultable(id, actorId) {
    const actor = this.usuarioService.identificar(actorId);
    const compra = this.repository.buscarPorId(id);
    exigir(compra, 'NOT_FOUND', 'La compra no existe.');
    exigir(actor.esCompradorDe(compra) || actor.esOrganizadorDe(compra.evento), 'FORBIDDEN', 'Solo el comprador o el organizador pueden consultar esta compra.');
    return compra;
  }
  crear(datos, actorId) {
    const comprador = this.usuarioService.identificar(actorId);
    exigir(datos.compradorId === comprador.id, 'FORBIDDEN', 'El comprador debe coincidir con el usuario seleccionado.');
    const evento = this.eventoService.obtener(datos.eventoId);
    const tipoEntrada = this.tipoService.obtener(datos.tipoEntradaId);
    const compra = new Compra({ comprador, evento, tipoEntrada, cantidad: datos.cantidad, creacion: this.reloj() });
    // Repositorios síncronos: toda validación termina antes de la primera escritura.
    // No introducir await entre la verificación y la reserva en este proceso en memoria.
    tipoEntrada.reservar(datos.cantidad);
    this.guardar(compra);
    return this.dto(compra, this.reloj());
  }
  pagar(id, actorId) {
    const compra = this.propia(id, actorId);
    compra.pagar(this.reloj());
    this.guardar(compra);
    return this.dto(compra, this.reloj());
  }
  cancelar(id, entradaIds, actorId) {
    const compra = this.propia(id, actorId);
    const ahora = this.reloj();
    const seleccion = compra.validarCancelacion(entradaIds, ahora);
    compra.tipoEntrada.exigirLiberacion(seleccion.length);
    // Todas las precondiciones están comprobadas. Sin await entre cambios en memoria.
    const liberadas = compra.cancelar(entradaIds, ahora);
    compra.tipoEntrada.liberar(liberadas);
    this.guardar(compra);
    return this.dto(compra, ahora);
  }
  detalle(id, actorId) { return this.dto(this.consultable(id, actorId), this.reloj()); }
  deEvento(eventoId, estado, actorId) {
    this.eventoService.propio(eventoId, actorId);
    if (estado) exigir(ESTADOS_COMPRA.includes(estado), 'INVALID_DATA', 'El estado de compra no es válido.');
    const ahora = this.reloj();
    return this.repository.deEvento(eventoId).filter((compra) => !estado || compra.estado === estado)
      .sort((a, b) => b.creacion - a.creacion || a.id.localeCompare(b.id)).map((compra) => this.dto(compra, ahora));
  }
  listar({ compradorId, estado }, actorId) {
    const actor = this.usuarioService.identificar(actorId);
    exigir(compradorId, 'INVALID_DATA', 'Indicá compradorId para consultar tus compras.');
    exigir(compradorId === actor.id, 'FORBIDDEN', 'Solo podés consultar tus propias compras.');
    if (estado) exigir(ESTADOS_COMPRA.includes(estado), 'INVALID_DATA', 'El estado de compra no es válido.');
    const ahora = this.reloj();
    return this.repository.deComprador(compradorId).filter((compra) => !estado || compra.estado === estado)
      .sort((a, b) => b.creacion - a.creacion || a.id.localeCompare(b.id)).map((compra) => this.dto(compra, ahora));
  }
  procesarVencimientos() {
    const ahora = this.reloj();
    for (const compra of this.repository.todos()) {
      const cantidad = compra.vencer(ahora);
      if (cantidad > 0) {
        compra.tipoEntrada.liberar(cantidad);
        this.guardar(compra);
      }
    }
  }
}
