import { exigir } from '../domain/ErrorNegocio.js';
import { categoriaDTO } from './dto.js';

export class CategoriaService {
  constructor(repository) { this.repository = repository; }
  listar() { return this.repository.todos().map(categoriaDTO); }
  obtener(id) {
    const categoria = this.repository.buscarPorId(id);
    exigir(categoria, 'NOT_FOUND', 'La categoría no existe.');
    return categoria;
  }
}
