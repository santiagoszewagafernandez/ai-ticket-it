import { leerQR } from './qr.js';

/** @typedef {import('../api/tipos').ValidacionEntrada} ValidacionEntrada */
export class LectorEntrada {
  /** @param {{validar: (id: string, signal: AbortSignal) => Promise<ValidacionEntrada>, usar: (id: string, signal: AbortSignal) => Promise<ValidacionEntrada>}} api */
  constructor(api) {
    this.api = api;
    this.estado = { fase: 'leyendo', datos: /** @type {ValidacionEntrada | null} */ (null), error: '' };
    this.pendiente = /** @type {AbortController | null} */ (null);
    this.observadores = new Set();
  }
  /** @param {(estado: LectorEntrada['estado']) => void} observar */
  suscribir(observar) { this.observadores.add(observar); observar(this.estado); return () => { this.observadores.delete(observar); }; }
  /** @param {LectorEntrada['estado']} estado */
  publicar(estado) { this.estado = estado; this.observadores.forEach((observar) => observar(estado)); }
  /** @param {string} contenido */
  async escanear(contenido) {
    if (this.estado.fase !== 'leyendo') return;
    // La fase cambia sincrónicamente antes de la primera espera: bloquea callbacks repetidos de cámara.
    this.publicar({ fase: 'consultando', datos: null, error: '' });
    try {
      const id = leerQR(contenido);
      await this.operar('validada', (signal) => this.api.validar(id, signal));
    } catch (error) { this.rechazar(error); }
  }
  async confirmar() {
    if (this.estado.fase !== 'validada' || !this.estado.datos) return;
    const id = this.estado.datos.entrada.id;
    this.publicar({ ...this.estado, fase: 'confirmando', error: '' });
    await this.operar('utilizada', (signal) => this.api.usar(id, signal));
  }
  /** @param {string} fase @param {(signal: AbortSignal) => Promise<ValidacionEntrada>} accion */
  async operar(fase, accion) {
    const controller = new AbortController();
    this.pendiente = controller;
    try {
      const datos = await accion(controller.signal);
      if (!controller.signal.aborted) this.publicar({ fase, datos, error: '' });
    } catch (error) { if (!controller.signal.aborted) this.rechazar(error); }
    finally { if (this.pendiente === controller) this.pendiente = null; }
  }
  /** @param {unknown} error */
  rechazar(error) { this.publicar({ ...this.estado, fase: 'rechazada', error: error instanceof Error ? error.message : 'No se pudo comprobar la entrada.' }); }
  otra() {
    if (this.pendiente) return;
    this.publicar({ fase: 'leyendo', datos: null, error: '' });
  }
  suspender() {
    if (!this.pendiente) return;
    const confirmando = this.estado.fase === 'confirmando';
    this.pendiente.abort();
    this.pendiente = null;
    this.rechazar(new Error(confirmando ? 'Se interrumpió la confirmación. Volvé a escanear para consultar si el ingreso quedó registrado.' : 'Se interrumpió la consulta. Podés escanear otra vez.'));
  }
}
