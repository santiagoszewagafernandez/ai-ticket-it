import { Mensaje } from '../domain/Mensaje.js';
import { validarTexto } from '../domain/ErrorNegocio.js';
import { mensajeDTO } from './dto.js';

export class MensajeService {
  constructor(repository, compraService, usuarioService, reloj) {
    Object.assign(this, { repository, compraService, usuarioService, reloj });
  }
  autorizar(compraId, actorId) { this.compraService.consultable(compraId, actorId); }
  listar(compraId, actorId) {
    this.autorizar(compraId, actorId);
    // Map conserva el orden de registro, incluso con fechas iguales.
    return this.repository.deCompra(compraId).map(mensajeDTO);
  }
  enviar(compraId, actorId, { texto, idEnvio }) {
    this.autorizar(compraId, actorId);
    const autor = this.usuarioService.identificar(actorId);
    const envio = validarTexto(idEnvio, 'idEnvio');
    const anterior = this.repository.deEnvio(compraId, autor.id, envio);
    if (anterior) {
      anterior.exigirMismoTexto(texto);
      return { mensaje: mensajeDTO(anterior), nuevo: false };
    }
    const mensaje = new Mensaje({ compraId, autor, texto, idEnvio: envio, fecha: this.reloj() });
    // Validación, deduplicación y escritura síncronas en este único proceso.
    this.repository.guardar(mensaje);
    return { mensaje: mensajeDTO(mensaje), nuevo: true };
  }
}
