export class MemoriaRepository {
  constructor() { this.elementos = new Map(); }
  guardar(objeto) { this.elementos.set(objeto.id, objeto); return objeto; }
  buscarPorId(id) { return this.elementos.get(id) ?? null; }
  todos() { return [...this.elementos.values()]; }
}
