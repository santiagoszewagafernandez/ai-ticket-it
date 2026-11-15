// Datos opcionales de prueba local, creados por HTTP desde PC. No graba ni envía video.
// Reejecutar en la misma sesión reutiliza los eventos propios con estos títulos.
const [base = 'http://127.0.0.1:3000'] = process.argv.slice(2);
const headers = { 'Content-Type': 'application/json', 'X-Usuario-Id': 'lucia', 'X-Client-Platform': 'pc-preparacion-integracion' };
async function pedir(ruta, opciones = {}) {
  const r = await fetch(`${base}${ruta}`, { ...opciones, headers, signal: AbortSignal.timeout(8000) });
  const datos = await r.json();
  if (!r.ok) throw new Error(`${ruta}: ${r.status} ${datos.error?.message}`);
  return datos;
}
const existentes = await pedir('/usuarios/lucia/eventos');
const ahora = Date.now();
const plantillas = [
  { titulo: 'Integración multimedia · demo MDN', descripcion: 'Datos ficticios para comprobar imágenes, video, fallos remotos y filtros en el iPhone.', categoriaId: 'tecnologia',
    inicio: new Date(ahora + 2 * 86400000).toISOString(), fin: new Date(ahora + 2 * 86400000 + 7200000).toISOString(),
    multimedia: [
      { tipo: 'imagen', url: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1000&q=80' },
      { tipo: 'video', url: 'https://developer.mozilla.org/shared-assets/videos/flower.mp4' },
      { tipo: 'imagen', url: 'https://example.com/imagen-demo-inexistente.jpg' },
      { tipo: 'video', url: 'https://example.com/video-demo-inexistente.mp4' },
    ] },
  { titulo: 'Integración en curso · demo', descripcion: 'Evento ficticio ya comenzado: accesible por gestión y favoritos, con venta cerrada.', categoriaId: 'musica',
    inicio: new Date(ahora - 1800000).toISOString(), fin: new Date(ahora + 7200000).toISOString(), multimedia: [] },
];
for (const datos of plantillas) {
  const evento = existentes.find((e) => e.titulo === datos.titulo) ?? await pedir('/eventos', { method: 'POST', body: JSON.stringify({
    ...datos, organizadorId: 'lucia', lugar: 'Sala de pruebas local',
    tiposEntrada: [{ nombre: 'General', descripcion: 'Acceso de prueba.', precioCentavos: 100000, cupo: 5 }],
  }) });
  console.info(JSON.stringify({ id: evento.id, titulo: evento.titulo, inicio: evento.inicio, fin: evento.fin }));
}
