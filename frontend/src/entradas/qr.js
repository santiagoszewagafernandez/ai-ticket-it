const PREFIJO = 'ai-ticket-it:entrada:v1:';

/** @param {string} id */
export function contenidoQR(id) {
  if (typeof id !== 'string' || !id.trim()) throw new Error('La entrada no tiene identificación.');
  return `${PREFIJO}${encodeURIComponent(id)}`;
}

/** @param {string} contenido */
export function leerQR(contenido) {
  try {
    if (typeof contenido !== 'string' || !contenido.startsWith(PREFIJO)) throw new Error();
    const id = decodeURIComponent(contenido.slice(PREFIJO.length));
    if (!id.trim() || contenidoQR(id) !== contenido) throw new Error();
    return id;
  } catch { throw new Error('Este QR no es una entrada de AI Ticket It válida.'); }
}
