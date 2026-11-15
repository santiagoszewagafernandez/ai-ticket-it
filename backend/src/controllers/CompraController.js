import { objeto, texto } from './validacion.js';

export class CompraController {
  constructor(service) { this.service = service; }
  deEvento = (req, res) => res.json(this.service.deEvento(req.params.id,
    texto(req.query.estado, 'estado', { opcional: true }), req.get('X-Usuario-Id')));
  crear = (req, res) => {
    const body = objeto(req.body);
    const compra = this.service.crear({
      compradorId: texto(body.compradorId, 'compradorId'), eventoId: texto(body.eventoId, 'eventoId'),
      tipoEntradaId: texto(body.tipoEntradaId, 'tipoEntradaId'), cantidad: body.cantidad,
    }, req.get('X-Usuario-Id'));
    res.location(`/compras/${compra.id}`).status(201).json(compra);
  };
  pagar = (req, res) => res.json(this.service.pagar(req.params.id, req.get('X-Usuario-Id')));
  cancelar = (req, res) => {
    const body = objeto(req.body);
    res.json(this.service.cancelar(req.params.id, body.entradaIds, req.get('X-Usuario-Id')));
  };
  detalle = (req, res) => res.json(this.service.detalle(req.params.id, req.get('X-Usuario-Id')));
  listar = (req, res) => res.json(this.service.listar({
    compradorId: texto(req.query.compradorId, 'compradorId'),
    estado: texto(req.query.estado, 'estado', { opcional: true }),
  }, req.get('X-Usuario-Id')));
}
