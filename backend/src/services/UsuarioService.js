import { exigir } from '../domain/ErrorNegocio.js';
import { usuarioDTO } from './dto.js';

export class UsuarioService {
  constructor(repository, consultarEvento) { Object.assign(this, { repository, consultarEvento }); }
  listar() { return this.repository.todos().map(usuarioDTO); }
  obtener(id) {
    const usuario = this.repository.buscarPorId(id);
    exigir(usuario, 'NOT_FOUND', 'El usuario no existe.');
    return usuario;
  }
  identificar(id) {
    exigir(typeof id === 'string' && id.trim(), 'IDENTITY_REQUIRED', 'Seleccioná un usuario de demostración.');
    return this.obtener(id);
  }
  propio(id, actorId) {
    const actor = this.identificar(actorId);
    exigir(actor.id === id, 'FORBIDDEN', 'Solo podés consultar o modificar tus propios favoritos.');
    return actor;
  }
  favoritos(id, actorId) {
    return this.propio(id, actorId).favoritos.map(this.consultarEvento)
      .sort((a, b) => a.inicio.localeCompare(b.inicio) || a.id.localeCompare(b.id));
  }
  guardarFavorito(id, eventoId, actorId, agregar) {
    const usuario = this.propio(id, actorId);
    // Verifica existencia sin aplicar el filtro temporal del catálogo.
    this.consultarEvento(eventoId);
    if (agregar) usuario.agregarFavorito(eventoId);
    else usuario.quitarFavorito(eventoId);
    this.repository.guardar(usuario);
    return this.favoritos(id, actorId);
  }
}
