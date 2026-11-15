export class EntradaController {
  constructor(service) { this.service = service; }
  listar = (req, res) => res.json(this.service.listar(req.params.id, req.get('X-Usuario-Id')));
  validar = (req, res) => res.json(this.service.validar(req.params.id, texto(req.query.eventoId, 'eventoId'), req.get('X-Usuario-Id')));
  usar = (req, res) => {
    const body = objeto(req.body);
    res.json(this.service.usar(req.params.id, texto(body.eventoId, 'eventoId'), req.get('X-Usuario-Id')));
  };
}
import { objeto, texto } from './validacion.js';

