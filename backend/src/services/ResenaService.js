import { resenaDTO } from './dto.js';
import { Resena } from '../domain/Resena.js';
import { exigir } from '../domain/ErrorNegocio.js';

export class ResenaService {
  constructor(repository, usuarioService, eventoRepository, compraRepository, reloj) {
    Object.assign(this, { repository, usuarioService, eventoRepository, compraRepository, reloj });
  }
  situacion(evento, comprador, ahora) {
    const propia = this.repository.deCompradorEvento(comprador.id, evento.id);
    const impedimento = Resena.impedimento(comprador, evento, this.compraRepository.deComprador(comprador.id), ahora);
    return { propia: propia ? resenaDTO(propia) : null, puedePublicar: !propia && !impedimento,
      motivo: propia ? 'Ya publicaste tu reseña para este evento.' : impedimento?.message ?? '' };
  }
  crear(eventoId, datos, actorId) {
    const comprador = this.usuarioService.identificar(actorId);
    const evento = this.eventoRepository.buscarPorId(eventoId);
    exigir(evento, 'NOT_FOUND', 'El evento no existe.');
    exigir(!this.repository.deCompradorEvento(comprador.id, evento.id), 'REVIEW_ALREADY_EXISTS', 'Ya publicaste una reseña para este evento.');
    const resena = new Resena({ comprador, evento, compras: this.compraRepository.deComprador(comprador.id),
      puntaje: datos.puntaje, comentario: datos.comentario, fecha: this.reloj() });
    // Comprobación de unicidad y escritura sin await: una sola reseña aun con pedidos concurrentes.
    this.repository.guardar(resena);
    return resenaDTO(resena);
  }
  reputacion(organizadorId) {
    const resenas = this.repository.deOrganizador(organizadorId);
    return {
      puntaje: resenas.length ? resenas.reduce((suma, resena) => suma + resena.puntaje, 0) / resenas.length : null,
      cantidad: resenas.length,
    };
  }
  listar(organizadorId) {
    this.usuarioService.obtener(organizadorId);
    return this.repository.deOrganizador(organizadorId).sort((a, b) => b.fecha - a.fecha || a.id.localeCompare(b.id)).map(resenaDTO);
  }
}
