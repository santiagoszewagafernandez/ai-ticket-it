/** @typedef {import('../api/tipos').Evento} Evento */
/** @typedef {{datos: Evento[] | null, cargando: boolean, error: string, pendienteId: string, errorOperacion: string, confirmacion: string}} Estado */

// Coordina la UI de una sesión; los favoritos y sus reglas se guardan en Usuario del backend.
export class ListaFavoritos {
  /** @param {{favoritos: (signal: AbortSignal) => Promise<Evento[]>, guardarFavorito: (id: string, agregar: boolean, signal: AbortSignal) => Promise<Evento[]>}} api */
  constructor(api) {
    this.api = api;
    this.estado = /** @type {Estado} */ ({ datos: null, cargando: true, error: '', pendienteId: '', errorOperacion: '', confirmacion: '' });
    this.consulta = /** @type {AbortController | null} */ (null);
    this.mutacion = /** @type {AbortController | null} */ (null);
    this.observadores = new Set();
  }
  /** @param {(estado: Estado) => void} observar */
  suscribir(observar) { this.observadores.add(observar); observar(this.estado); return () => { this.observadores.delete(observar); }; }
  /** @param {Partial<Estado>} cambios */
  publicar(cambios) { this.estado = { ...this.estado, ...cambios }; this.observadores.forEach((f) => f(this.estado)); }
  async cargar() {
    if (this.mutacion) return;
    this.consulta?.abort();
    const controller = new AbortController();
    this.consulta = controller;
    this.publicar({ cargando: true, error: '', confirmacion: '' });
    try {
      const datos = await this.api.favoritos(controller.signal);
      if (!controller.signal.aborted) this.publicar({ datos, cargando: false, errorOperacion: '' });
    } catch (error) {
      if (!controller.signal.aborted) this.publicar({ cargando: false, error: error instanceof Error ? error.message : 'No se pudieron consultar los favoritos.' });
    } finally { if (this.consulta === controller) this.consulta = null; }
  }
  /** @param {string} id */
  async cambiar(id) {
    if (this.mutacion || !this.estado.datos || this.estado.error) return;
    const agregar = !this.estado.datos.some((e) => e.id === id);
    this.consulta?.abort(); this.consulta = null;
    const controller = new AbortController();
    this.mutacion = controller;
    this.publicar({ pendienteId: id, cargando: false, errorOperacion: '', confirmacion: '' });
    try {
      const datos = await this.api.guardarFavorito(id, agregar, controller.signal);
      if (!controller.signal.aborted) this.publicar({ datos, pendienteId: '', confirmacion: agregar ? 'Evento guardado en favoritos.' : 'Evento quitado de favoritos.' });
    } catch (error) {
      if (!controller.signal.aborted) this.publicar({ pendienteId: '', errorOperacion: `${error instanceof Error ? error.message : 'No se confirmó el cambio.'} Podés volver a consultar o repetir la misma acción de forma segura.` });
    } finally { if (this.mutacion === controller) this.mutacion = null; }
  }
  detener() {
    this.consulta?.abort(); this.mutacion?.abort();
    this.consulta = null; this.mutacion = null;
    this.publicar({ pendienteId: '', cargando: false });
  }
}
