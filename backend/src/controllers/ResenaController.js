import { objeto, texto } from './validacion.js';

export class ResenaController {
  constructor(service) { this.service = service; }
  listar = (req, res) => res.json(this.service.listar(texto(req.query.organizadorId, 'organizadorId')));
  crear = (req, res) => {
    const datos = objeto(req.body);
    res.status(201).json(this.service.crear(req.params.id, datos, req.get('X-Usuario-Id')));
  };
}
