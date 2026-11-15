export class CategoriaController {
  constructor(service) { this.service = service; }
  listar = (req, res) => res.json(this.service.listar());
}
