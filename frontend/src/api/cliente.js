import { Platform } from 'react-native';

export class ErrorSolicitud extends Error {
  /** @param {string} message */
  constructor(message, code = 'NETWORK_ERROR', status = 0) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/** @param {string} baseUrl */
export function normalizarUrl(baseUrl) {
  let url;
  try { url = new URL(baseUrl.trim().replace(/\/+$/, '')); }
  catch { throw new ErrorSolicitud('Ingresá la URL del backend con la IP Wi-Fi de tu PC.', 'INVALID_URL'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) {
    throw new ErrorSolicitud('Usá una URL HTTP o HTTPS sin ruta, parámetros ni credenciales.', 'INVALID_URL');
  }
  if (['localhost', '127.0.0.1', '[::1]', '0.0.0.0'].includes(url.hostname)) {
    throw new ErrorSolicitud('En el iPhone, usá la IP Wi-Fi de la PC. localhost identifica al teléfono.', 'INVALID_URL');
  }
  return url.origin;
}

/** @param {string} baseUrl
 * @param {string | undefined} usuarioId
 */
export function crearApi(baseUrl, usuarioId) {
  /** @param {string} path
   * @param {{method?: string, body?: object, signal?: AbortSignal}} [opciones]
   */
  async function pedir(path, { method = 'GET', body, signal } = {}) {
    const origen = normalizarUrl(baseUrl);
    const controller = new AbortController();
    const abortar = () => controller.abort();
    if (signal?.aborted) controller.abort();
    signal?.addEventListener('abort', abortar);
    const timeout = setTimeout(abortar, 8000);
    try {
      const response = await fetch(`${origen}${path}`, {
        method, signal: controller.signal,
        headers: {
          Accept: 'application/json', 'Content-Type': 'application/json', 'X-Client-Platform': Platform.OS,
          ...(usuarioId ? { 'X-Usuario-Id': usuarioId } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      let datos;
      try { datos = await response.json(); }
      catch { throw new ErrorSolicitud('El servidor no devolvió JSON válido. Revisá la URL del backend.', 'INVALID_RESPONSE', response.status); }
      if (!response.ok) throw new ErrorSolicitud(datos?.error?.message ?? `Error HTTP ${response.status}.`, datos?.error?.code ?? 'HTTP_ERROR', response.status);
      return datos;
    } catch (error) {
      if (error instanceof ErrorSolicitud) throw error;
      throw new ErrorSolicitud(controller.signal.aborted ? 'La consulta superó los 8 segundos. Revisá la conexión y volvé a consultar.' : 'No se pudo llegar al backend. Revisá el Wi-Fi, la URL y que Express esté iniciado.');
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abortar);
    }
  }
  return {
    /** @param {AbortSignal} signal @returns {Promise<import('./tipos').Evento[]>} */
    favoritos: (signal) => pedir(`/usuarios/${encodeURIComponent(usuarioId ?? '')}/favoritos`, { signal }),
    /** @param {string} id @param {boolean} agregar @param {AbortSignal} signal @returns {Promise<import('./tipos').Evento[]>} */
    guardarFavorito: (id, agregar, signal) => pedir(`/usuarios/${encodeURIComponent(usuarioId ?? '')}/favoritos/${encodeURIComponent(id)}`, { method: agregar ? 'PUT' : 'DELETE', signal }),
    /** @param {string} id @param {{puntaje: number, comentario: string}} datos @param {AbortSignal} signal @returns {Promise<import('./tipos').Resena>} */
    publicarResena: (id, datos, signal) => pedir(`/eventos/${encodeURIComponent(id)}/resenas`, { method: 'POST', body: datos, signal }),
    /** @param {string} id @param {string} eventoId @param {AbortSignal} signal @returns {Promise<import('./tipos').ValidacionEntrada>} */
    validarEntrada: (id, eventoId, signal) => pedir(`/entradas/${encodeURIComponent(id)}/validacion?eventoId=${encodeURIComponent(eventoId)}`, { signal }),
    /** @param {string} id @param {string} eventoId @param {AbortSignal} signal @returns {Promise<import('./tipos').ValidacionEntrada>} */
    usarEntrada: (id, eventoId, signal) => pedir(`/entradas/${encodeURIComponent(id)}/uso`, { method: 'POST', body: { eventoId }, signal }),
    /** @param {string} id @param {AbortSignal} signal @returns {Promise<import('./tipos').Mensaje[]>} */
    mensajes: (id, signal) => pedir(`/compras/${encodeURIComponent(id)}/mensajes`, { signal }),
    /** @param {AbortSignal} signal @returns {Promise<import('./tipos').Usuario[]>} */
    usuarios: (signal) => pedir('/usuarios', { signal }),
    /** @param {AbortSignal} signal @returns {Promise<import('./tipos').Categoria[]>} */
    categorias: (signal) => pedir('/categorias', { signal }),
    /** @param {{texto: string, categoriaId: string, orden: string}} filtros @param {AbortSignal} signal @returns {Promise<import('./tipos').Evento[]>} */
    eventos: (filtros, signal) => pedir(`/eventos?${new URLSearchParams(Object.entries(filtros).filter(([, v]) => v)).toString()}`, { signal }),
    /** @param {string} id @param {AbortSignal} signal @returns {Promise<import('./tipos').Evento>} */
    evento: (id, signal) => pedir(`/eventos/${encodeURIComponent(id)}`, { signal }),
    /** @param {AbortSignal} signal @returns {Promise<import('./tipos').Evento[]>} */
    misEventos: (signal) => pedir(`/usuarios/${encodeURIComponent(usuarioId ?? '')}/eventos`, { signal }),
    /** @param {import('./tipos').AltaEvento} datos @param {AbortSignal} signal @returns {Promise<import('./tipos').Evento>} */
    crearEvento: (datos, signal) => pedir('/eventos', { method: 'POST', body: datos, signal }),
    /** @param {string} id @param {string} estado @param {AbortSignal} signal @returns {Promise<import('./tipos').Compra[]>} */
    comprasEvento: (id, estado, signal) => pedir(`/eventos/${encodeURIComponent(id)}/compras${estado ? `?estado=${encodeURIComponent(estado)}` : ''}`, { signal }),
    /** @param {string} id @param {AbortSignal} signal @returns {Promise<import('./tipos').TipoEntrada[]>} */
    tipos: (id, signal) => pedir(`/eventos/${encodeURIComponent(id)}/tipos-entrada`, { signal }),
    /** @param {string} id @param {AbortSignal} signal @returns {Promise<import('./tipos').Resena[]>} */
    resenas: (id, signal) => pedir(`/resenas?organizadorId=${encodeURIComponent(id)}`, { signal }),
    /** @param {{compradorId: string, eventoId: string, tipoEntradaId: string, cantidad: number}} datos @param {AbortSignal} signal @returns {Promise<import('./tipos').Compra>} */
    reservar: (datos, signal) => pedir('/compras', { method: 'POST', body: datos, signal }),
    /** @param {string} id @param {AbortSignal} signal @returns {Promise<import('./tipos').Compra>} */
    pagar: (id, signal) => pedir(`/compras/${encodeURIComponent(id)}/pago`, { method: 'POST', signal }),
    /** @param {string} id @param {string[]} entradaIds @param {AbortSignal} signal @returns {Promise<import('./tipos').Compra>} */

    cancelar: (id, entradaIds, signal) => pedir(`/compras/${encodeURIComponent(id)}/cancelaciones`, 
    { method: 'POST', body: { entradaIds }, signal }),
    
    /** @param {string} id @param {AbortSignal} signal @returns {Promise<import('./tipos').Compra>} */
    compra: (id, signal) => pedir(`/compras/${encodeURIComponent(id)}`, { signal }),
    /** @param {string} estado @param {AbortSignal} signal @returns {Promise<import('./tipos').Compra[]>} */
    compras: (estado, signal) => pedir(`/compras?compradorId=${encodeURIComponent(usuarioId ?? '')}${estado ? `&estado=${encodeURIComponent(estado)}` : ''}`, { signal }),
  };
}
