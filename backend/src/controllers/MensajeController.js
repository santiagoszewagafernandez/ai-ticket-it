import { exigir } from '../domain/ErrorNegocio.js';
import { objeto, texto } from './validacion.js';

export class MensajeController {
  constructor(service) { this.service = service; }
  listar = (req, res) => res.json(this.service.listar(req.params.id, req.get('X-Usuario-Id')));
  identificar(compraId, datos) {
    const body = objeto(datos);
    exigir(body.tipo === 'identificar', 'IDENTITY_REQUIRED', 'Identificá primero al usuario de demostración.');
    const actorId = texto(body.usuarioId, 'usuarioId');
    this.service.autorizar(compraId, actorId);
    return actorId;
  }
  enviar(compraId, actorId, datos) {
    const body = objeto(datos);
    exigir(body.tipo === 'enviar', 'INVALID_DATA', 'El tipo de operación debe ser enviar.');
    return this.service.enviar(compraId, actorId, { texto: body.texto, idEnvio: body.idEnvio });
  }
}
