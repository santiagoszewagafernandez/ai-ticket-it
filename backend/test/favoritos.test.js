import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { Usuario } from '../src/domain/Usuario.js';
import { crearContexto } from '../src/composicion.js';
import { crearAplicacion } from '../src/app.js';

const inicio = new Date('2026-11-14T18:00:00Z');
const ids = (eventos) => eventos.map((evento) => evento.id);

test('Usuario protege unicidad, eliminación repetida y copia de la colección', () => {
  const usuario = new Usuario({ id: 'ana', nombre: 'Ana' });
  usuario.agregarFavorito('jazz'); usuario.agregarFavorito('jazz');
  const copia = usuario.favoritos;
  copia.push('otro');
  assert.deepEqual(usuario.favoritos, ['jazz']);
  usuario.quitarFavorito('jazz'); usuario.quitarFavorito('jazz');
  assert.deepEqual(usuario.favoritos, []);
});
for (const id of ['', ' ', undefined, 1]) test(`dominio rechaza favorito inválido ${String(id)} sin efectos`, () => {
  const usuario = new Usuario({ id: 'ana', nombre: 'Ana' });
  assert.throws(() => usuario.agregarFavorito(id), { code: 'INVALID_DATA' });
  assert.throws(() => usuario.quitarFavorito(id), { code: 'INVALID_DATA' });
  assert.deepEqual(usuario.favoritos, []);
});

test('favoritos persisten en UsuarioRepository, están aislados y sus DTO no modifican el dominio', () => {
  const { servicios: s, repos } = crearContexto(() => inicio);
  assert.deepEqual(s.usuario.favoritos('ana', 'ana'), []);
  s.usuario.guardarFavorito('ana', 'jazz', 'ana', true);
  s.usuario.guardarFavorito('ana', 'jazz', 'ana', true);
  const dto = s.usuario.favoritos('ana', 'ana');
  dto[0].titulo = 'alterado'; dto[0].organizador.nombre = 'otro'; dto[0].multimedia.length = 0;
  assert.deepEqual(repos.usuario.buscarPorId('ana').favoritos, ['jazz']);
  assert.equal(s.usuario.favoritos('ana', 'ana')[0].titulo, 'Jazz bajo las estrellas');
  assert.equal(s.usuario.favoritos('ana', 'ana')[0].organizador.nombre, 'Lucía Producciones');
  assert.equal(s.usuario.favoritos('ana', 'ana')[0].multimedia.length, 1);
  assert.deepEqual(s.usuario.favoritos('bruno', 'bruno'), []);
  s.usuario.guardarFavorito('bruno', 'jazz', 'bruno', true);
  s.usuario.guardarFavorito('ana', 'jazz', 'ana', false);
  assert.deepEqual(ids(s.usuario.favoritos('bruno', 'bruno')), ['jazz']);
  assert.deepEqual(s.usuario.favoritos('ana', 'ana'), []);
});

for (const [id, actor, evento, codigo] of [
  ['ana', undefined, 'jazz', 'IDENTITY_REQUIRED'], ['ana', 'nadie', 'jazz', 'NOT_FOUND'],
  ['ana', 'bruno', 'jazz', 'FORBIDDEN'], ['bruno', 'ana', 'jazz', 'FORBIDDEN'],
  ['ana', 'ana', 'ausente', 'NOT_FOUND'],
]) test(`rechazo ${id}/${String(actor)}/${evento}: ${codigo}, sin efectos`, () => {
  const { servicios: s, repos } = crearContexto(() => inicio);
  const antes = JSON.stringify(Object.fromEntries(Object.entries(repos).map(([k, r]) => [k, r.todos()])));
  const favoritos = repos.usuario.todos().map((u) => u.favoritos);
  for (const agregar of [true, false]) assert.throws(() => s.usuario.guardarFavorito(id, evento, actor, agregar), { code: codigo });
  assert.equal(JSON.stringify(Object.fromEntries(Object.entries(repos).map(([k, r]) => [k, r.todos()]))), antes);
  assert.deepEqual(repos.usuario.todos().map((u) => u.favoritos), favoritos);
});

test('favorito atraviesa inicio y fin, sale del catálogo y conserva detalle sin poder comprar', () => {
  let ahora = inicio;
  const { servicios: s } = crearContexto(() => ahora);
  s.usuario.guardarFavorito('ana', 'noche-indie', 'ana', true);
  const evento = s.evento.obtener('noche-indie');
  for (const [instante, situacion] of [[evento.inicio, 'EN_CURSO'], [evento.fin, 'FINALIZADO']]) {
    ahora = instante;
    const favorito = s.usuario.favoritos('ana', 'ana')[0];
    assert.equal(favorito.tiempoEvento.situacion, situacion);
    assert.equal(favorito.tiempoEvento.diasRestantes, null);
    assert.equal(favorito.puedeReservar, false);
    assert.ok(!ids(s.evento.listar({})).includes(evento.id));
    assert.equal(s.evento.detalle(evento.id).id, evento.id);
    assert.throws(() => s.compra.crear({ compradorId: 'ana', eventoId: evento.id, tipoEntradaId: 'indie-general', cantidad: 1 }, 'ana'), { code: 'EVENT_STARTED' });
  }
  s.usuario.guardarFavorito('ana', 'noche-indie', 'ana', false);
  assert.deepEqual(s.usuario.favoritos('ana', 'ana'), []);
});

test('favoritos incluyen históricos/agotados, ordenan por fecha e ID y recalculan precio/reputación', () => {
  const { servicios: s } = crearContexto(() => inicio);
  for (const id of ['acustico', 'teatro', 'taller-anterior', 'jazz']) s.usuario.guardarFavorito('ana', id, 'ana', true);
  const favoritos = s.usuario.favoritos('ana', 'ana');
  assert.deepEqual(ids(favoritos), ['taller-anterior', 'acustico', 'teatro', 'jazz']);
  assert.equal(favoritos[1].agotado, true); assert.equal(favoritos[1].puedeReservar, false);
  assert.equal(favoritos[3].precioDesdeCentavos, 1800000);
  assert.equal(favoritos[2].organizador.reputacion.puntaje, null);
  s.resena.crear('taller-anterior', { puntaje: 5, comentario: 'Opinión de prueba.' }, 'ana');
  assert.equal(s.usuario.favoritos('ana', 'ana')[2].organizador.reputacion.puntaje, 5);
});

test('cada contexto nuevo restablece favoritos vacíos sin alterar fixtures anteriores', () => {
  const primero = crearContexto(() => inicio);
  primero.servicios.usuario.guardarFavorito('ana', 'jazz', 'ana', true);
  const segundo = crearContexto(() => inicio);
  assert.deepEqual(segundo.servicios.usuario.favoritos('ana', 'ana'), []);
  assert.equal(segundo.repos.compra.todos().length, primero.repos.compra.todos().length);
  for (const compra of segundo.repos.compra.todos()) {
    assert.ok(compra.creacion < compra.evento.inicio);
    assert.ok(compra.pago.fecha < compra.evento.inicio);
    for (const entrada of compra.entradas.filter((e) => e.uso)) {
      assert.ok(entrada.uso.fecha >= compra.evento.inicio && entrada.uso.fecha <= compra.evento.fin);
    }
  }
});

test('HTTP favoritos: contratos reales, permisos e idempotencia concurrente', async (t) => {
  const app = crearAplicacion({ reloj: () => inicio });
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve, reject) => server.close((e) => e ? reject(e) : resolve())));
  await once(server, 'listening');
  async function pedir(path = '/usuarios/ana/favoritos', method = 'GET', actor = 'ana') {
    const r = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { method, headers: actor ? { 'X-Usuario-Id': actor } : {} });
    return { status: r.status, datos: await r.json(), cache: r.headers.get('cache-control') };
  }
  await t.test('GET propio vacío y 401/403/404 coherentes en las tres rutas', async () => {
    assert.deepEqual((await pedir()).datos, []);
    for (const method of ['GET', 'PUT', 'DELETE']) {
      const path = '/usuarios/ana/favoritos' + (method === 'GET' ? '' : '/jazz');
      assert.equal((await pedir(path, method, null)).status, 401);
      assert.equal((await pedir(path, method, 'bruno')).status, 403);
      assert.equal((await pedir(path, method, 'nadie')).status, 404);
      if (method !== 'GET') assert.equal((await pedir('/usuarios/ana/favoritos/ausente', method)).status, 404);
    }
    assert.deepEqual((await pedir()).datos, []);
  });
  await t.test('PUT concurrente guarda uno; DELETE concurrente lo mantiene fuera sin tocar al otro usuario', async () => {
    const path = '/usuarios/ana/favoritos/jazz';
    const agregados = await Promise.all([pedir(path, 'PUT'), pedir(path, 'PUT')]);
    for (const r of agregados) { assert.equal(r.status, 200); assert.equal(r.cache, 'no-store'); assert.deepEqual(ids(r.datos), ['jazz']); }
    assert.deepEqual((await pedir('/usuarios/bruno/favoritos', 'GET', 'bruno')).datos, []);
    await pedir('/usuarios/bruno/favoritos/jazz', 'PUT', 'bruno');
    const quitados = await Promise.all([pedir(path, 'DELETE'), pedir(path, 'DELETE')]);
    for (const r of quitados) { assert.equal(r.status, 200); assert.deepEqual(r.datos, []); }
    assert.deepEqual(ids((await pedir('/usuarios/bruno/favoritos', 'GET', 'bruno')).datos), ['jazz']);
  });
  await t.test('histórico conserva detalle, temporalidad y rechazo real de reserva por HTTP', async () => {
    const r = await pedir('/usuarios/ana/favoritos/taller-anterior', 'PUT');
    assert.equal(r.status, 200); assert.equal(r.datos[0].tiempoEvento.situacion, 'FINALIZADO');
    assert.equal(r.datos[0].puedeReservar, false);
    assert.equal((await pedir('/eventos/taller-anterior')).status, 200);
    const reserva = await fetch(`http://127.0.0.1:${server.address().port}/compras`, { method: 'POST', headers: { 'X-Usuario-Id': 'ana', 'Content-Type': 'application/json' }, body: JSON.stringify({ compradorId: 'ana', eventoId: 'taller-anterior', tipoEntradaId: 'taller-general', cantidad: 1 }) });
    assert.equal(reserva.status, 409); assert.equal((await reserva.json()).error.code, 'EVENT_STARTED');
  });
});
