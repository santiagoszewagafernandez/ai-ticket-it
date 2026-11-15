import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { crearContexto } from '../src/composicion.js';
import { crearAplicacion } from '../src/app.js';

const AHORA = new Date('2026-11-14T16:00:00Z');
const datos = { compradorId: 'ana', eventoId: 'noche-indie', tipoEntradaId: 'indie-general', cantidad: 3 };
const foto = (repos) => JSON.stringify(Object.fromEntries(Object.entries(repos).map(([k, r]) => [k, r.todos()])));
function preparar(pagada = true) {
  let hora = AHORA;
  const contexto = crearContexto(() => new Date(hora));
  const dto = contexto.servicios.compra.crear(datos, 'ana');
  if (pagada) contexto.servicios.compra.pagar(dto.id, 'ana');
  return { ...contexto, compra: contexto.repos.compra.buscarPorId(dto.id), ids: dto.entradas.map((e) => e.id), avanzar: (n) => { hora = new Date(AHORA.getTime() + n); } };
}

describe('Ingreso individual y dominio', () => {
  test('consultar repetidamente no consume ni cambia repositorios', () => {
    const { servicios, repos, ids } = preparar();
    const antes = foto(repos);
    const resultado = servicios.entrada.validar(ids[0], 'noche-indie', 'lucia');
    assert.equal(resultado.numero, 1);
    assert.equal(resultado.cantidad, 3);
    assert.equal(resultado.entrada.estado, 'SIN_UTILIZAR');
    assert.equal(resultado.entrada.uso, null);
    assert.deepEqual(servicios.entrada.validar(ids[0], 'noche-indie', 'lucia'), resultado);
    assert.equal(foto(repos), antes);
  });
  test('uso parcial, cancelación y último ingreso: mismos objetos, cupo/pago conservados e historial real', () => {
    const { servicios, repos, compra, ids } = preparar();
    const cupo = compra.tipoEntrada.disponibles;
    const pago = compra.pago;
    servicios.entrada.usar(ids[0], 'noche-indie', 'lucia');
    assert.equal(compra.estado, 'CONFIRMADA');
    assert.equal(compra.historial.length, 2);
    assert.equal(repos.entrada.buscarPorId(ids[0]), compra.entradas[0]);
    servicios.compra.cancelar(compra.id, [ids[1]], 'ana');
    const resultado = servicios.entrada.usar(ids[2], 'noche-indie', 'lucia');
    assert.equal(resultado.estadoCompra, 'UTILIZADA');
    assert.deepEqual(resultado.entrada.uso, { fecha: AHORA.toISOString(), actor: 'lucia' });
    assert.equal(compra.historial.length, 3);
    assert.equal(compra.historial.at(-1).motivo, 'INGRESO');
    assert.equal(compra.historial.at(-1).actor, 'lucia');
    assert.equal(compra.tipoEntrada.disponibles, cupo + 1);
    assert.equal(compra.pago, pago);
    const antes = foto(repos);
    assert.throws(() => servicios.entrada.usar(ids[2], 'noche-indie', 'lucia'), { code: 'TICKET_ALREADY_USED' });
    assert.equal(foto(repos), antes);
    assert.deepEqual(servicios.compra.pagar(compra.id, 'ana').pago.entradaIds, [...pago.entradaIds]);
    assert.equal(compra.estado, 'UTILIZADA');
  });
  for (const [nombre, prepararRechazo, code] of [
    ['impaga', () => {}, 'TICKET_UNPAID'],
    ['cancelada después de consulta', ({ servicios, compra, ids }) => { servicios.compra.pagar(compra.id, 'ana'); servicios.entrada.validar(ids[0], 'noche-indie', 'lucia'); servicios.compra.cancelar(compra.id, [ids[0]], 'ana'); }, 'TICKET_CANCELED'],
    ['utilizada después de consulta', ({ servicios, compra, ids }) => { servicios.compra.pagar(compra.id, 'ana'); servicios.entrada.validar(ids[0], 'noche-indie', 'lucia'); servicios.entrada.usar(ids[0], 'noche-indie', 'lucia'); }, 'TICKET_ALREADY_USED'],
    ['vencida', ({ servicios, avanzar }) => { avanzar(300000); servicios.compra.procesarVencimientos(); }, 'TICKET_CANCELED'],
  ]) test(`${nombre}: rechaza consulta y confirmación sin efectos`, () => {
    const contexto = preparar(false);
    prepararRechazo(contexto);
    const antes = foto(contexto.repos);
    for (const metodo of ['validar', 'usar']) assert.throws(() => contexto.servicios.entrada[metodo](contexto.ids[0], 'noche-indie', 'lucia'), { code });
    assert.equal(foto(contexto.repos), antes);
  });
  for (const [actor, eventoId, id, code] of [
    [undefined, 'noche-indie', null, 'IDENTITY_REQUIRED'], ['nadie', 'noche-indie', null, 'NOT_FOUND'],
    ['ana', 'noche-indie', null, 'FORBIDDEN'], ['bruno', 'noche-indie', null, 'FORBIDDEN'],
    ['lucia', 'jazz', null, 'TICKET_EVENT_MISMATCH'], ['lucia', 'ausente', null, 'NOT_FOUND'],
    ['lucia', 'noche-indie', 'ausente', 'NOT_FOUND'],
  ]) test(`acceso ${actor}/${eventoId}/${id}: ${code}`, () => {
    const { servicios, repos, ids } = preparar();
    const antes = foto(repos);
    for (const metodo of ['validar', 'usar']) assert.throws(() => servicios.entrada[metodo](id ?? ids[0], eventoId, actor), { code });
    assert.equal(foto(repos), antes);
  });
  test('no hay ventana de admisión: antes, durante y después del evento', () => {
    const { servicios, compra, ids, avanzar } = preparar();
    servicios.entrada.usar(ids[0], 'noche-indie', 'lucia');
    avanzar(86400000);
    servicios.entrada.usar(ids[1], 'noche-indie', 'lucia');
    avanzar(2 * 86400000);
    servicios.entrada.usar(ids[2], 'noche-indie', 'lucia');
    assert.equal(compra.estado, 'UTILIZADA');
  });
  test('dominio protege pago, organizador, uso repetido y cancelación después de usar', () => {
    const { servicios, compra, ids } = preparar(false);
    assert.throws(() => compra.confirmarIngreso(ids[0], AHORA, 'lucia'), { code: 'TICKET_UNPAID' });
    servicios.compra.pagar(compra.id, 'ana');
    assert.throws(() => compra.confirmarIngreso(ids[0], AHORA, 'ana'), { code: 'FORBIDDEN' });
    assert.throws(() => compra.confirmarIngreso('ajena', AHORA, 'lucia'), { code: 'TICKET_PURCHASE_MISMATCH' });
    compra.confirmarIngreso(ids[0], AHORA, 'lucia');
    assert.throws(() => compra.entradas[0].utilizar(AHORA, 'lucia'), { code: 'TICKET_ALREADY_USED' });
    assert.throws(() => compra.entradas[0].cancelar(), { code: 'TICKET_NOT_CANCELABLE' });
  });
});

test('HTTP ingreso: contrato, permisos y dos lectores confirman una sola utilización', async (t) => {
  const app = crearAplicacion({ reloj: () => new Date(AHORA) });
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  async function pedir(path, method = 'GET', body, actor = 'lucia') {
    const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(actor ? { 'X-Usuario-Id': actor } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: r.status, datos: await r.json() };
  }
  const c = (await pedir('/compras', 'POST', { ...datos, cantidad: 1 }, 'ana')).datos;
  const ruta = `/entradas/${c.entradas[0].id}`;
  assert.equal((await pedir(`${ruta}/validacion?eventoId=noche-indie`)).datos.error.code, 'TICKET_UNPAID');
  await pedir(`/compras/${c.id}/pago`, 'POST', undefined, 'ana');
  for (const query of ['', '?eventoId=', '?eventoId=a&eventoId=b']) assert.equal((await pedir(`${ruta}/validacion${query}`)).status, 400);
  for (const body of [undefined, {}, [], { eventoId: 4 }]) assert.equal((await pedir(`${ruta}/uso`, 'POST', body)).status, 400);
  assert.equal((await pedir(`${ruta}/validacion?eventoId=noche-indie`, 'GET', undefined, null)).status, 401);
  assert.equal((await pedir(`${ruta}/uso`, 'POST', { eventoId: 'noche-indie' }, 'ana')).status, 403);
  assert.equal((await pedir('/entradas/ausente/uso', 'POST', { eventoId: 'noche-indie' })).status, 404);
  const antes = foto(app.locals.contexto.repos);
  const consultas = await Promise.all([pedir(`${ruta}/validacion?eventoId=noche-indie`), pedir(`${ruta}/validacion?eventoId=noche-indie`)]);
  assert.deepEqual(consultas.map((r) => r.status), [200, 200]);
  assert.equal(foto(app.locals.contexto.repos), antes);
  const usos = await Promise.all([pedir(`${ruta}/uso`, 'POST', { eventoId: 'noche-indie' }), pedir(`${ruta}/uso`, 'POST', { eventoId: 'noche-indie' })]);
  assert.deepEqual(usos.map((r) => r.status).sort(), [200, 409]);
  assert.equal(usos.find((r) => r.status === 409).datos.error.code, 'TICKET_ALREADY_USED');
  const actual = (await pedir(`/compras/${c.id}`)).datos;
  assert.equal(actual.estado, 'UTILIZADA');
  assert.deepEqual(actual.entradas[0].uso, { fecha: AHORA.toISOString(), actor: 'lucia' });
  assert.equal(actual.historial.filter((e) => e.motivo === 'INGRESO').length, 1);
  assert.equal(app.locals.contexto.repos.tipoEntrada.buscarPorId('indie-general').disponibles, 7);
});
