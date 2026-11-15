import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { crearAplicacion } from '../src/app.js';

test('HTTP real: contratos, errores, concurrencia por último cupo y expiración', async (t) => {
  let ahora = new Date('2026-11-13T20:00:00Z');
  const app = crearAplicacion({ reloj: () => new Date(ahora) });
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  async function pedir(path, { method = 'GET', body, actor = 'ana', raw } = {}) {
    const response = await fetch(`${base}${path}`, {
      method, headers: { 'Content-Type': 'application/json', ...(actor ? { 'X-Usuario-Id': actor } : {}) },
      body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
    });
    return { status: response.status, datos: await response.json(), response };
  }
  const cuerpo = { compradorId: 'ana', eventoId: 'noche-indie', tipoEntradaId: 'indie-general', cantidad: 7, totalCentavos: 1 };

  await t.test('health y consultas de apoyo', async () => {
    assert.equal((await pedir('/health')).datos.service, 'ai-ticket-it');
    assert.equal((await pedir('/usuarios')).datos.length, 3);
    assert.equal((await pedir('/categorias')).datos.length, 3);
    assert.equal((await pedir('/eventos/noche-indie/tipos-entrada')).datos.length, 2);
    assert.equal((await pedir('/resenas?organizadorId=lucia')).datos.length, 2);
    assert.equal((await pedir('/eventos/ausente')).status, 404);
  });
  await t.test('400 de JSON y query inválidos, 401 sin identidad, 403 de identidad ajena', async () => {
    assert.equal((await pedir('/compras', { method: 'POST', raw: '{' })).status, 400);
    assert.equal((await pedir('/compras', { method: 'POST', body: cuerpo, actor: null })).status, 401);
    assert.equal((await pedir('/compras', { method: 'POST', body: cuerpo, actor: 'bruno' })).status, 403);
    for (const query of ['orden=otro', 'texto=a&texto=b', 'categoriaId=ausente']) {
      const r = await pedir(`/eventos?${query}`);
      assert.ok([400, 404].includes(r.status));
      assert.equal(typeof r.datos.error.message, 'string');
    }
  });
  const primera = await pedir('/compras', { method: 'POST', body: cuerpo });
  assert.equal(primera.status, 201);
  assert.equal(primera.response.headers.get('location'), `/compras/${primera.datos.id}`);
  assert.equal(primera.datos.totalCentavos, 8750000);
  await t.test('dos peticiones concurrentes compiten por una sola entrada restante', async () => {
    const resultados = await Promise.all([
      pedir('/compras', { method: 'POST', body: { ...cuerpo, cantidad: 1 } }),
      pedir('/compras', { method: 'POST', body: { ...cuerpo, cantidad: 1 } }),
    ]);
    assert.deepEqual(resultados.map((r) => r.status).sort(), [201, 409]);
    assert.equal(app.locals.contexto.repos.tipoEntrada.buscarPorId('indie-general').disponibles, 0);
    assert.equal((await pedir('/compras?compradorId=ana&estado=PENDIENTE')).datos.length, 2);
  });
  await t.test('pago y reintento recuperan el mismo registro; entradas e historial solo propios', async () => {
    const url = `/compras/${primera.datos.id}`;
    assert.equal((await pedir(url, { actor: 'bruno' })).status, 403);
    const pagada = await pedir(`${url}/pago`, { method: 'POST' });
    const reintento = await pedir(`${url}/pago`, { method: 'POST' });
    assert.equal(pagada.status, 200);
    assert.deepEqual(reintento.datos.pago, pagada.datos.pago);
    assert.equal(reintento.datos.historial.length, 2);
    assert.equal((await pedir(`${url}/entradas`)).datos.length, 7);
    assert.equal((await pedir(`${url}/historial`)).datos.length, 2);
    assert.equal((await pedir(`${url}/historial`, { actor: 'bruno' })).status, 403);
    assert.equal((await pedir('/compras?compradorId=bruno')).status, 403);
    assert.equal((await pedir('/compras?compradorId=ana&estado=OTRA')).status, 400);
  });
  await t.test('límite exacto vía HTTP procesa vencimiento antes del pago, libera una vez', async () => {
    ahora = new Date('2026-11-13T20:05:00Z');
    const pendientes = (await pedir('/compras?compradorId=ana&estado=CANCELADA')).datos;
    assert.equal(pendientes.length, 1);
    const rechazada = await pedir(`/compras/${pendientes[0].id}/pago`, { method: 'POST' });
    assert.equal(rechazada.status, 409);
    assert.equal(rechazada.datos.error.code, 'RESERVATION_EXPIRED');
    assert.equal((await pedir('/eventos/noche-indie/tipos-entrada')).datos[0].disponibles, 1);
    assert.equal((await pedir('/eventos/noche-indie/tipos-entrada')).datos[0].disponibles, 1);
    assert.equal((await pedir(`/compras/${primera.datos.id}`)).datos.estado, 'CONFIRMADA');
  });
  await t.test('mensajes nuevos siguen usando WebSocket y favoritos ya está publicado', async () => {
    assert.equal((await pedir(`/compras/${primera.datos.id}/mensajes`, { method: 'POST', body: {} })).status, 404);
    assert.equal((await pedir('/usuarios/ana/favoritos')).status, 200);
    assert.deepEqual((await pedir('/usuarios/ana/favoritos')).datos, []);
  });
});
