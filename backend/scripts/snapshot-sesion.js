import { writeFile } from 'node:fs/promises';

// Solo lecturas HTTP de la sesión existente. No restaura datos ni simula acciones del iPhone.
const [base = 'http://127.0.0.1:3000', archivo] = process.argv.slice(2);
if (!archivo) throw new Error('Uso: node scripts/snapshot-sesion.js URL archivo.json');
async function leer(ruta, actor) {
  const r = await fetch(`${base}${ruta}`, { headers: { 'X-Client-Platform': 'pc-snapshot', ...(actor ? { 'X-Usuario-Id': actor } : {}) }, signal: AbortSignal.timeout(8000) });
  const datos = await r.json();
  if (!r.ok && !(ruta.endsWith('/favoritos') && r.status === 404)) throw new Error(`${ruta}: HTTP ${r.status}`);
  return { status: r.status, datos };
}
const usuarios = (await leer('/usuarios')).datos;
const snapshot = { origen: 'Solo lecturas desde PC; no acredita ejecución iPhone', fecha: new Date().toISOString(), base,
  salud: await leer('/health'), usuarios: [], eventos: [] };
const eventoIds = new Set();
for (const usuario of usuarios) {
  const compras = (await leer(`/compras?compradorId=${usuario.id}`, usuario.id)).datos;
  const eventos = (await leer(`/usuarios/${usuario.id}/eventos`, usuario.id)).datos;
  const favoritos = await leer(`/usuarios/${usuario.id}/favoritos`, usuario.id);
  for (const evento of eventos) eventoIds.add(evento.id);
  const conversaciones = [];
  for (const compra of compras) {
    eventoIds.add(compra.evento.id);
    conversaciones.push({ compraId: compra.id, mensajes: (await leer(`/compras/${compra.id}/mensajes`, usuario.id)).datos });
  }
  snapshot.usuarios.push({ usuario, compras, eventos, favoritos, conversaciones, resenas: (await leer(`/resenas?organizadorId=${usuario.id}`)).datos });
}
for (const id of eventoIds) snapshot.eventos.push({ detalle: (await leer(`/eventos/${id}`)).datos, tipos: (await leer(`/eventos/${id}/tipos-entrada`)).datos });
await writeFile(archivo, JSON.stringify(snapshot, null, 2) + '\n');
console.info(`Snapshot PC guardado: ${snapshot.usuarios.length} usuarios, ${snapshot.eventos.length} eventos, ${snapshot.usuarios.reduce((n, u) => n + u.compras.length, 0)} compras.`);
