export class UsuarioController {
  constructor(service) { this.service = service; }
  listar = (req, res) => res.json(this.service.listar());
  favoritos = (req, res) => res.json(this.service.favoritos(req.params.id, req.get('X-Usuario-Id')));
  agregarFavorito = (req, res) => res.json(this.service.guardarFavorito(req.params.id, req.params.eventoId, req.get('X-Usuario-Id'), true));
  quitarFavorito = (req, res) => res.json(this.service.guardarFavorito(req.params.id, req.params.eventoId, req.get('X-Usuario-Id'), false));
}
