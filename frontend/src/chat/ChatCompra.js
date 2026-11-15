/** @typedef {import('../api/tipos').Mensaje} Mensaje */
/** @typedef {{idEnvio: string, texto: string, estado: string, error: string}} Pendiente */
/** @typedef {{conexion: string, error: string, mensajes: Mensaje[], pendientes: Pendiente[]}} EstadoChat */

/** Historial en orden de registro + eventos recibidos durante su consulta.
 * @param {Mensaje[]} historial @param {Mensaje[]} vivos
 */
export function combinarMensajes(historial, vivos) {
  return [...new Map([...historial, ...vivos].map((mensaje) => [mensaje.id, mensaje])).values()];
}

// Identificador opaco de envío, generado por una acción; no autentica al usuario.
let secuencia = 0;
export function crearIdEnvio() {
  return `${Date.now().toString(36)}-${++secuencia}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

/** Sin dependencias de React Native: el hook controla foco y AppState.
 * Los transportes y timers se inyectan para comprobar carreras y limpieza.
 */
export class ChatCompra {
  /** @param {{compraId: string, usuarioId: string, plataforma: string,
   * abrirSocket: () => WebSocket, historial: (signal: AbortSignal) => Promise<Mensaje[]>,
   * alCambiar: (estado: EstadoChat) => void, crearId?: () => string,
   * programar?: typeof setTimeout, cancelar?: typeof clearTimeout}} opciones */
  constructor({ compraId, usuarioId, plataforma, abrirSocket, historial, alCambiar,
    crearId = crearIdEnvio, programar = setTimeout, cancelar = clearTimeout }) {
    this.compraId = compraId;
    this.usuarioId = usuarioId;
    this.plataforma = plataforma;
    this.abrirSocket = abrirSocket;
    this.historial = historial;
    this.alCambiar = alCambiar;
    this.crearId = crearId;
    this.programar = programar;
    this.cancelar = cancelar;
    this.estado = /** @type {EstadoChat} */ ({ conexion: 'Desconectado', error: '', mensajes: [], pendientes: [] });
    this.socket = /** @type {WebSocket | null} */ (null);
    this.peticion = /** @type {AbortController | null} */ (null);
    this.esperas = new Map();
    this.reconexion = /** @type {ReturnType<typeof setTimeout> | undefined} */ (undefined);
    this.plazo = /** @type {ReturnType<typeof setTimeout> | undefined} */ (undefined);
    this.generacion = 0;
    this.intentos = 0;
    this.activo = false;
    this.fatal = false;
  }
  publicar() { this.alCambiar({ ...this.estado, mensajes: [...this.estado.mensajes], pendientes: [...this.estado.pendientes] }); }
  iniciar() {
    if (this.activo) return;
    this.activo = true;
    this.intentos = 0;
    this.fatal = false;
    this.conectar();
  }
  limpiarConexion() {
    this.generacion += 1;
    this.peticion?.abort();
    this.peticion = null;
    this.cancelar(this.plazo);
    this.cancelar(this.reconexion);
    this.plazo = this.reconexion = undefined;
    for (const timer of this.esperas.values()) this.cancelar(timer);
    this.esperas.clear();
    const anterior = this.socket;
    this.socket = null;
    if (anterior) {
      anterior.onopen = anterior.onmessage = anterior.onclose = anterior.onerror = null;
      anterior.close();
    }
    this.estado.pendientes = this.estado.pendientes.map((p) => p.estado === 'Enviando'
      ? { ...p, estado: 'Error', error: 'No llegó la confirmación. Podés reintentar el mismo envío.' } : p);
  }
  detener() {
    this.activo = false;
    this.limpiarConexion();
    this.estado.conexion = 'Desconectado';
    this.publicar();
  }
  reconectar() {
    if (this.fatal) return;
    this.intentos = 0;
    if (this.activo) this.conectar();
    else this.iniciar();
  }
  conectar() {
    this.limpiarConexion();
    const generacion = this.generacion;
    const vigente = () => this.activo && this.generacion === generacion;
    this.estado.conexion = 'Conectando';
    this.estado.error = '';
    this.publicar();
    try {
      const socket = this.abrirSocket();
      this.socket = socket;
      this.plazo = this.programar(() => { if (vigente()) this.interrumpir('No se pudo sincronizar el chat en 8 segundos.'); }, 8000);
      socket.onopen = () => {
        if (!vigente()) return;
        try { socket.send(JSON.stringify({ tipo: 'identificar', usuarioId: this.usuarioId, plataforma: this.plataforma })); }
        catch { this.interrumpir('No se pudo identificar la conexión.'); }
      };
      let listo = false;
      let vivos = /** @type {Mensaje[]} */ ([]);
      socket.onmessage = (evento) => {
        if (!vigente()) return;
        try {
          const datos = JSON.parse(evento.data);
          if (datos.tipo === 'listo' && !listo) {
            if (datos.compraId !== this.compraId || datos.usuarioId !== this.usuarioId) throw new Error('La conexión no corresponde a esta conversación.');
            listo = true;
            this.estado.conexion = 'Sincronizando';
            this.publicar();
            const peticion = new AbortController();
            this.peticion = peticion;
            this.historial(peticion.signal).then((historial) => {
              if (!vigente()) return;
              this.estado.mensajes = combinarMensajes(historial, vivos);
              this.confirmarPendientes();
              this.estado.conexion = 'Conectado';
              this.estado.error = '';
              this.intentos = 0;
              this.cancelar(this.plazo);
              this.publicar();
            }).catch((error) => {
              if (!vigente()) return;
              if ([401, 403, 404].includes(error?.status)) this.rechazar(error.message);
              else this.interrumpir(error instanceof Error ? error.message : 'No se pudo recuperar el historial.');
            });
          } else if (datos.tipo === 'mensaje' && listo) {
            const mensaje = /** @type {Mensaje} */ (datos.mensaje);
            if (mensaje.compraId !== this.compraId) throw new Error('Se recibió un mensaje de otra compra.');
            vivos = combinarMensajes(vivos, [mensaje]);
            this.estado.mensajes = combinarMensajes(this.estado.mensajes, [mensaje]);
            this.confirmarPendientes();
            this.publicar();
          } else if (datos.tipo === 'error') {
            if (datos.fatal) this.rechazar(datos.error.message);
            else if (datos.idEnvio) this.marcarError(datos.idEnvio, datos.error.message);
            else { this.estado.error = datos.error.message; this.publicar(); }
          } else throw new Error('El servidor devolvió un mensaje de chat desconocido.');
        } catch (error) { this.interrumpir(error instanceof Error ? error.message : 'Respuesta de chat inválida.'); }
      };
      socket.onclose = () => { if (vigente()) this.interrumpir('Se interrumpió la conexión. Recuperaremos el historial al reconectar.'); };
      socket.onerror = () => { if (vigente()) this.interrumpir('No se pudo conectar el chat. Revisá la conexión.'); };
    } catch (error) { this.interrumpir(error instanceof Error ? error.message : 'No se pudo abrir el chat.'); }
  }
  /** @param {string} mensaje */
  interrumpir(mensaje) {
    this.limpiarConexion();
    this.estado.error = mensaje;
    this.estado.conexion = 'Desconectado';
    if (this.activo && !this.fatal && this.intentos < 5) {
      const demora = Math.min(1000 * 2 ** this.intentos, 10000);
      this.intentos += 1;
      this.estado.conexion = 'Reconectando';
      this.reconexion = this.programar(() => this.conectar(), demora);
    }
    this.publicar();
  }
  /** @param {string} mensaje */
  rechazar(mensaje) {
    this.fatal = true;
    this.limpiarConexion();
    this.estado = { conexion: 'Acceso rechazado', error: mensaje, mensajes: [], pendientes: [] };
    this.publicar();
  }
  confirmarPendientes() {
    const confirmados = new Set(this.estado.mensajes.filter((m) => m.autor.id === this.usuarioId).map((m) => m.idEnvio));
    this.estado.pendientes = this.estado.pendientes.filter((p) => {
      if (!confirmados.has(p.idEnvio)) return true;
      this.cancelar(this.esperas.get(p.idEnvio));
      this.esperas.delete(p.idEnvio);
      return false;
    });
  }
  /** @param {string} idEnvio @param {string} error */
  marcarError(idEnvio, error) {
    this.cancelar(this.esperas.get(idEnvio));
    this.esperas.delete(idEnvio);
    this.estado.pendientes = this.estado.pendientes.map((p) => p.idEnvio === idEnvio ? { ...p, estado: 'Error', error } : p);
    this.publicar();
  }
  /** @param {string} texto */
  enviar(texto) {
    if (!texto.trim() || this.estado.conexion !== 'Conectado') return false;
    const pendiente = { texto: texto.trim(), idEnvio: this.crearId(), estado: 'Enviando', error: '' };
    this.estado.pendientes = [...this.estado.pendientes, pendiente];
    this.transmitir(pendiente);
    return true;
  }
  /** @param {string} idEnvio */
  reintentar(idEnvio) {
    const pendiente = this.estado.pendientes.find((p) => p.idEnvio === idEnvio);
    if (pendiente && pendiente.estado === 'Error' && this.estado.conexion === 'Conectado') this.transmitir(pendiente);
  }
  /** @param {Pendiente} pendiente */
  transmitir(pendiente) {
    this.estado.pendientes = this.estado.pendientes.map((p) => p.idEnvio === pendiente.idEnvio ? { ...p, estado: 'Enviando', error: '' } : p);
    this.publicar();
    try {
      if (!this.socket || this.socket.readyState !== 1) throw new Error('Desconectado');
      this.esperas.set(pendiente.idEnvio, this.programar(() => {
        this.marcarError(pendiente.idEnvio, 'No llegó la confirmación. Reintentá: se conserva el mismo envío.');
      }, 8000));
      this.socket.send(JSON.stringify({ tipo: 'enviar', texto: pendiente.texto, idEnvio: pendiente.idEnvio }));
    } catch { this.marcarError(pendiente.idEnvio, 'No se pudo enviar. Revisá la conexión y reintentá.'); }
  }
}
