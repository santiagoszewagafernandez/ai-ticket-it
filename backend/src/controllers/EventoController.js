import { objeto, texto } from './validacion.js';

export class EventoController {
  constructor(service) { this.service = service; }
  crear = (req, res) => {
    const body = objeto(req.body);
    const evento = this.service.crear({ ...body, organizadorId: texto(body.organizadorId, 'organizadorId'),
      categoriaId: texto(body.categoriaId, 'categoriaId') }, req.get('X-Usuario-Id'));
    res.location(`/eventos/${evento.id}`).status(201).json(evento);
  };
  deOrganizador = (req, res) => res.json(this.service.deOrganizador(req.params.id, req.get('X-Usuario-Id')));
  listar = (req, res) => res.json(this.service.listar({
    texto: texto(req.query.texto, 'texto', { opcional: true }),
    categoriaId: texto(req.query.categoriaId, 'categoriaId', { opcional: true }),
    orden: texto(req.query.orden, 'orden', { opcional: true }),
  }));
  detalle = (req, res) => res.json(this.service.detalle(req.params.id));
}
