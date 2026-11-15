/**
 * @param {string} baseUrl
 * @param {{signal: AbortSignal, plataforma: string}} opciones
 */
export async function consultarSalud(baseUrl, { signal, plataforma }) {
  let url;
  try {
    url = new URL(`${baseUrl.trim().replace(/\/+$/, '')}/health`);
  } catch {
    throw new Error('Ingresá una URL válida, por ejemplo http://192.168.0.237:3000.');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.search || url.hash || url.username || url.password) {
    throw new Error('Usá una URL HTTP o HTTPS sin credenciales, parámetros ni fragmentos.');
  }
  if (['localhost', '127.0.0.1', '[::1]', '0.0.0.0'].includes(url.hostname)) {
    throw new Error('En el iPhone, localhost identifica al teléfono. Usá la IP Wi-Fi de tu PC.');
  }

  let response;
  try {
    response = await fetch(url.toString(), {
      signal,
      headers: { Accept: 'application/json', 'X-Client-Platform': plataforma },
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error('No se pudo llegar al backend. Revisá la URL, el Wi-Fi, el permiso de red local de Expo Go y que Express esté iniciado.');
  }
  if (!response.ok) {
    throw new Error(`El servidor respondió HTTP ${response.status}. Verificá que la URL corresponda a Express.`);
  }

  let datos;
  try {
    datos = await response.json();
  } catch {
    throw new Error('El servidor no devolvió una respuesta JSON válida.');
  }
  if (datos?.status !== 'ok' || datos?.service !== 'ai-ticket-it' || typeof datos?.timestamp !== 'string' || Number.isNaN(Date.parse(datos.timestamp))) {
    throw new Error('La respuesta no corresponde al diagnóstico de AI Ticket It. Revisá la URL.');
  }
  return /** @type {{status: string, service: string, timestamp: string}} */ (datos);
}
