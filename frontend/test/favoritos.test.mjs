import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ListaFavoritos } from '../src/favoritos/ListaFavoritos.js';

const evento = { id: 'jazz', tiempoEvento: { situacion: 'PROXIMO' } };
function diferida() {
  let resolver; let rechazar;
  const promesa = new Promise((resolve, reject) => { resolver = resolve; rechazar = reject; });
  return { promesa, resolver, rechazar };
}

test('carga inicial distingue vacío, carga, error y recuperación', async () => {
  const respuesta = diferida(); let falla = false;
  const lista = new ListaFavoritos({ favoritos: () => falla ? Promise.reject(new Error('Sin red')) : respuesta.promesa, guardarFavorito: async () => [] });
  const carga = lista.cargar();
  assert.equal(lista.estado.cargando, true); assert.equal(lista.estado.datos, null);
  respuesta.resolver([]); await carga;
  assert.equal(lista.estado.cargando, false); assert.deepEqual(lista.estado.datos, []);
  falla = true; await lista.cargar();
  assert.equal(lista.estado.error, 'Sin red'); assert.deepEqual(lista.estado.datos, []);
  falla = false; await lista.cargar(); assert.equal(lista.estado.error, '');
});
test('guardar y quitar esperan confirmación; doble toque no envía dos operaciones', async () => {
  const respuesta = diferida(); const pedidos = [];
  const lista = new ListaFavoritos({ favoritos: async () => [], guardarFavorito: (id, agregar) => { pedidos.push({ id, agregar }); return agregar ? respuesta.promesa : Promise.resolve([]); } });
  await lista.cargar();
  const guardado = lista.cambiar(evento.id);
  await lista.cambiar(evento.id); await lista.cambiar('otro');
  assert.equal(pedidos.length, 1); assert.equal(lista.estado.pendienteId, evento.id);
  assert.deepEqual(lista.estado.datos, []); assert.equal(lista.estado.confirmacion, '');
  respuesta.resolver([evento]); await guardado;
  assert.deepEqual(lista.estado.datos, [evento]); assert.match(lista.estado.confirmacion, /guardado/);
  await lista.cambiar(evento.id);
  assert.deepEqual(pedidos, [{ id: 'jazz', agregar: true }, { id: 'jazz', agregar: false }]);
  assert.deepEqual(lista.estado.datos, []); assert.match(lista.estado.confirmacion, /quitado/);
});
test('una consulta anterior que ignora abort no sobrescribe una mutación confirmada', async () => {
  const vieja = diferida(); let veces = 0;
  const lista = new ListaFavoritos({ favoritos: async () => ++veces === 1 ? [] : vieja.promesa, guardarFavorito: async () => [evento] });
  await lista.cargar(); const carga = lista.cargar();
  await lista.cambiar(evento.id); vieja.resolver([]); await carga;
  assert.deepEqual(lista.estado.datos, [evento]);
});
test('dos consultas resueltas al revés conservan solo la última', async () => {
  const vieja = diferida(); let veces = 0;
  const lista = new ListaFavoritos({ favoritos: async () => ++veces === 1 ? vieja.promesa : [evento], guardarFavorito: async () => [] });
  const primera = lista.cargar(); await lista.cargar(); vieja.resolver([]); await primera;
  assert.deepEqual(lista.estado.datos, [evento]);
});
test('error de mutación conserva datos, no inventa éxito y permite repetir la misma acción', async () => {
  let falla = true; const agregarEnviado = [];
  const lista = new ListaFavoritos({ favoritos: async () => [], guardarFavorito: async (id, agregar) => { agregarEnviado.push(agregar); if (falla) throw new Error('Respuesta perdida'); return [evento]; } });
  await lista.cargar(); await lista.cambiar(evento.id);
  assert.deepEqual(lista.estado.datos, []); assert.equal(lista.estado.confirmacion, '');
  assert.match(lista.estado.errorOperacion, /Respuesta perdida/); assert.equal(lista.estado.pendienteId, '');
  falla = false; await lista.cambiar(evento.id);
  assert.deepEqual(agregarEnviado, [true, true]); assert.deepEqual(lista.estado.datos, [evento]);
  assert.equal(lista.estado.errorOperacion, '');
});
test('cambiar de usuario/URL usa otra lista y descarta consultas y mutaciones anteriores', async () => {
  const lectura = diferida(); const escritura = diferida(); let signalVieja; let signalEscritura;
  const ana = new ListaFavoritos({ favoritos: (signal) => { signalVieja = signal; return lectura.promesa; }, guardarFavorito: async () => [] });
  const bruno = new ListaFavoritos({ favoritos: async () => [], guardarFavorito: (id, agregar, signal) => { signalEscritura = signal; return escritura.promesa; } });
  const anterior = ana.cargar(); ana.detener();
  assert.equal(signalVieja.aborted, true);
  await bruno.cargar(); const mutacion = bruno.cambiar('teatro'); bruno.detener();
  assert.equal(signalEscritura.aborted, true);
  lectura.resolver([evento]); escritura.resolver([{ id: 'teatro' }]);
  await anterior; await mutacion;
  assert.equal(ana.estado.datos, null); assert.deepEqual(bruno.estado.datos, []);
  assert.equal(bruno.estado.confirmacion, '');
});
test('recargar no solapa una escritura y regresar consulta el resultado actual del servidor', async () => {
  const respuesta = diferida(); let consultas = 0; let guardados = [];
  const lista = new ListaFavoritos({ favoritos: async () => { consultas++; return guardados; }, guardarFavorito: () => respuesta.promesa });
  await lista.cargar(); const mutacion = lista.cambiar('jazz'); await lista.cargar();
  assert.equal(consultas, 1);
  lista.detener(); guardados = [evento]; respuesta.resolver(guardados); await mutacion;
  assert.deepEqual(lista.estado.datos, []);
  await lista.cargar(); assert.equal(consultas, 2); assert.deepEqual(lista.estado.datos, [evento]);
});
test('no muta sin una lectura válida y conserva favoritos finalizados recibidos de API', async () => {
  let escrituras = 0;
  const finalizado = { ...evento, puedeReservar: false, tiempoEvento: { situacion: 'FINALIZADO', diasRestantes: null, etiqueta: 'Finalizado' } };
  const lista = new ListaFavoritos({ favoritos: async () => [finalizado], guardarFavorito: async () => { escrituras++; return []; } });
  await lista.cambiar('jazz'); assert.equal(escrituras, 0);
  await lista.cargar(); assert.deepEqual(lista.estado.datos, [finalizado]);
  await lista.cambiar('jazz'); assert.equal(escrituras, 1); assert.deepEqual(lista.estado.datos, []);
});
