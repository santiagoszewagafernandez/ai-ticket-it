/** @param {number} puntaje @param {string} comentario */
export function prepararResena(puntaje, comentario) {
  if (!Number.isInteger(puntaje) || puntaje < 1 || puntaje > 5) throw new Error('Elegí de 1 a 5 estrellas.');
  if (typeof comentario !== 'string' || !comentario.trim()) throw new Error('Escribí un comentario sobre tu experiencia.');
  return { puntaje, comentario: comentario.trim() };
}
