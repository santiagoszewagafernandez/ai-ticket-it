export const ZONA_HORARIA = 'America/Argentina/Buenos_Aires';

function diaCalendario(fecha) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(fecha);
  const valor = (tipo) => Number(partes.find((parte) => parte.type === tipo).value);
  return Date.UTC(valor('year'), valor('month') - 1, valor('day')) / 86400000;
}

export function tiempoEvento(evento, ahora) {
  if (evento.finalizo(ahora)) return { situacion: 'FINALIZADO', diasRestantes: null, etiqueta: 'Finalizado' };
  if (evento.comenzo(ahora)) return { situacion: 'EN_CURSO', diasRestantes: null, etiqueta: 'En curso' };
  const diasRestantes = Math.max(0, diaCalendario(evento.inicio) - diaCalendario(ahora));
  return {
    situacion: 'PROXIMO', diasRestantes,
    etiqueta: diasRestantes === 0 ? 'Hoy' : diasRestantes === 1 ? 'Mañana' : `En ${diasRestantes} días`,
  };
}
