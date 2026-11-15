export class CambioEstadoCompraController {
  constructor(service) { this.service = service; }
  listar = (req, res) => res.json(this.service.listar(req.params.id, req.get('X-Usuario-Id')));
}
