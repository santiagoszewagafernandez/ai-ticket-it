import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { crearContexto } from '../src/composicion.js';
import { crearAplicacion } from '../src/app.js';
import { Evento } from '../src/domain/Evento.js';
import { TipoEntrada } from '../src/domain/TipoEntrada.js';

const AHORA = new Date('2026-11-13T20:00:00Z');
const datos = (extra = {}) => ({
  organizadorId: 'lucia', titulo: 'Festival creado', descripcion: 'Música para compartir.', categoriaId: 'musica',
  lugar: 'Sala de prueba', inicio: '2026-11-15T21:00:00.000Z', fin: '2026-11-16T00:00:00.000Z',
  multimedia: [{ tipo: 'imagen', url: 'https://example.com/festival.jpg' }, { tipo: 'video', url: 'https://example.com/video.mp4' }],
  tiposEntrada: [
    { nombre: 'General', descripcion: 'Acceso general.', precioCentavos: 1250000, cupo: 5 },
    { nombre: 'VIP', descripcion: 'Sector elevado.', precioCentavos: 2000000, cupo: 2 },
  ], ...extra,
});
const foto = (repos) => JSON.stringify(Object.fromEntries(Object.entries(repos).map(([nombre, repo]) => [nombre, repo.todos()])));

describe('Creación conjunta y reglas del dominio', () => {
  test('registra evento y varios tipos relacionados; devuelve DTO sin referencias mutables', () => {
    const { servicios, repos } = crearContexto(() => AHORA);
    const entrada = datos();
    const creado = servicios.evento.crear(entrada, 'lucia');
    assert.equal(creado.tiposEntrada.length, 2);
    assert.ok(creado.tiposEntrada.every((tipo) => tipo.eventoId === creado.id && tipo.disponibles === tipo.cupo));
    assert.equal(servicios.evento.listar({}).find((evento) => evento.id === creado.id).precioDesdeCentavos, 1250000);
    entrada.multimedia[0].url = 'https://example.com/cambio.jpg';
    creado.multimedia[1].url = 'https://example.com/otro.mp4';
    assert.equal(repos.evento.buscarPorId(creado.id).multimedia[0].url, 'https://example.com/festival.jpg');
    assert.equal(servicios.evento.detalle(creado.id).multimedia[1].url, 'https://example.com/video.mp4');
  });

  const invalidos = [
    ['sin tipos', { tiposEntrada: [] }], ['tipos no lista', { tiposEntrada: {} }],
    ['segundo tipo inválido', { tiposEntrada: [datos().tiposEntrada[0], { ...datos().tiposEntrada[1], cupo: -1 }] }],
    ['precio string', { tiposEntrada: [{ ...datos().tiposEntrada[0], precioCentavos: '100' }] }],
    ['precio fraccionario', { tiposEntrada: [{ ...datos().tiposEntrada[0], precioCentavos: 1.1 }] }],
    ['cupo fraccionario', { tiposEntrada: [{ ...datos().tiposEntrada[0], cupo: 1.5 }] }],
    ['nombre vacío', { tiposEntrada: [{ ...datos().tiposEntrada[0], nombre: ' ' }] }],
    ['descripción de tipo vacía', { tiposEntrada: [{ ...datos().tiposEntrada[0], descripcion: '' }] }],
    ['tipo null', { tiposEntrada: [null] }], ['título vacío', { titulo: ' ' }],
    ['descripción vacía', { descripcion: null }], ['fin igual', { fin: datos().inicio }],
    ['inicio inválido', { inicio: '2026-02-30T21:00:00.000Z' }], ['sin zona', { inicio: '2026-11-15T21:00:00' }],
    ['fin inválido', { fin: 'mañana' }], ['multimedia no lista', { multimedia: null }],
    ['URL inválida al final', { multimedia: [datos().multimedia[0], { tipo: 'video', url: 'file:///video.mp4' }] }],
    ['medio desconocido', { multimedia: [{ tipo: 'audio', url: 'https://example.com/audio' }] }],
  ];
  for (const [nombre, extra] of invalidos) {
    test(`rechaza ${nombre} sin registrar evento ni tipos ni alterar otros repositorios`, () => {
      const { servicios, repos } = crearContexto(() => AHORA);
      const antes = foto(repos);
      assert.throws(() => servicios.evento.crear(datos(extra), 'lucia'), { code: 'INVALID_DATA' });
      assert.equal(foto(repos), antes);
    });
  }
  for (const [actor, extra, code] of [
    [undefined, {}, 'IDENTITY_REQUIRED'], ['nadie', {}, 'NOT_FOUND'], ['ana', {}, 'FORBIDDEN'],
    ['lucia', { categoriaId: 'ausente' }, 'NOT_FOUND'],
  ]) {
    test(`rechaza actor ${actor} y ${JSON.stringify(extra)} sin efectos: ${code}`, () => {
      const { servicios, repos } = crearContexto(() => AHORA);
      const antes = foto(repos);
      assert.throws(() => servicios.evento.crear(datos(extra), actor), { code });
      assert.equal(foto(repos), antes);
    });
  }
  test('las entidades protegen título, multimedia, fechas, nombre y precio sin pasar por HTTP', () => {
    const { repos } = crearContexto(() => AHORA);
    const base = repos.evento.buscarPorId('noche-indie');
    for (const cambio of [{ titulo: '' }, { multimedia: [{ tipo: 'imagen', url: 'javascript:algo' }] }, { fin: new Date('inválida') }]) {
      assert.throws(() => new Evento({ ...base, ...cambio }), { code: 'INVALID_DATA' });
    }
    assert.throws(() => new TipoEntrada({ ...repos.tipoEntrada.buscarPorId('indie-general'), nombre: '' }), { code: 'INVALID_DATA' });
    const gratuito = new TipoEntrada({ ...repos.tipoEntrada.buscarPorId('indie-general'), precioCentavos: 0, cupo: 0 });
    assert.equal(gratuito.disponibles, 0);
  });
});

test('HTTP organizador: creación, aislamiento, detalle participante, filtros y cupos reales', async (t) => {
  let ahora = new Date(AHORA);
  const app = crearAplicacion({ reloj: () => new Date(ahora) });
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  async function pedir(path, { method = 'GET', body, actor = 'lucia' } = {}) {
    const response = await fetch(`${base}${path}`, { method,
      headers: { 'Content-Type': 'application/json', ...(actor ? { 'X-Usuario-Id': actor } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, datos: await response.json(), response };
  }
  await t.test('JSON inválido y conjunto rechazado no dejan efectos parciales; corregir permite crear una vez', async () => {
    const antes = foto(app.locals.contexto.repos);
    for (const body of [null, [], {}, datos({ tiposEntrada: [datos().tiposEntrada[0], null] })]) {
      assert.equal((await pedir('/eventos', { method: 'POST', body })).status, 400);
      assert.equal(foto(app.locals.contexto.repos), antes);
    }
    assert.equal((await pedir('/eventos', { method: 'POST', body: datos(), actor: null })).status, 401);
    assert.equal((await pedir('/eventos', { method: 'POST', body: datos(), actor: 'ana' })).status, 403);
    assert.equal(foto(app.locals.contexto.repos), antes);
  });
  const alta = await pedir('/eventos', { method: 'POST', body: datos() });
  assert.equal(alta.status, 201);
  assert.equal(alta.response.headers.get('location'), `/eventos/${alta.datos.id}`);
  const eventoId = alta.datos.id;
  const url = `/eventos/${eventoId}`;
  const tipoEntradaId = alta.datos.tiposEntrada[0].id;
  await t.test('Mis eventos incluye propios e históricos; catálogo solo futuros; no permite suplantar organizador', async () => {
    const propios = await pedir('/usuarios/lucia/eventos');
    assert.ok(propios.datos.some((evento) => evento.id === eventoId));
    assert.ok(propios.datos.some((evento) => evento.id === 'sesion-anterior'));
    assert.ok(propios.datos.every((evento) => evento.organizador.id === 'lucia'));
    assert.equal((await pedir('/usuarios/lucia/eventos', { actor: 'ana' })).status, 403);
    assert.equal((await pedir('/usuarios/lucia/eventos', { actor: null })).status, 401);
    assert.deepEqual((await pedir('/usuarios/ana/eventos', { actor: 'ana' })).datos, []);
    const catalogo = (await pedir('/eventos')).datos;
    assert.ok(catalogo.some((evento) => evento.id === eventoId));
    assert.ok(!catalogo.some((evento) => evento.id === 'sesion-anterior'));
  });
  const compra = (await pedir('/compras', { method: 'POST', actor: 'ana', body: { compradorId: 'ana', eventoId, tipoEntradaId, cantidad: 2 } })).datos;
  await t.test('solo participantes leen detalle, entradas e historial; solo comprador paga y ve su listado', async () => {
    for (const sufijo of ['', '/entradas', '/historial']) {
      for (const actor of ['ana', 'lucia']) assert.equal((await pedir(`/compras/${compra.id}${sufijo}`, { actor })).status, 200);
      assert.equal((await pedir(`/compras/${compra.id}${sufijo}`, { actor: 'bruno' })).status, 403);
      assert.equal((await pedir(`/compras/${compra.id}${sufijo}`, { actor: null })).status, 401);
    }
    assert.equal((await pedir(`/compras/${compra.id}/pago`, { method: 'POST' })).status, 403);
    assert.equal((await pedir('/compras?compradorId=ana')).status, 403);
    assert.equal((await pedir(`${url}/compras`, { actor: 'ana' })).status, 403);
    assert.equal((await pedir(`${url}/compras`, { actor: 'bruno' })).status, 403);
    assert.equal((await pedir(`${url}/compras`, { actor: null })).status, 401);
    assert.equal((await pedir('/eventos/ausente/compras')).status, 404);
    assert.equal((await pedir(`${url}/compras?estado=OTRO`)).status, 400);
    assert.equal((await pedir(`${url}/compras?estado=PENDIENTE&estado=CONFIRMADA`)).status, 400);
  });
  await t.test('gestión refleja reserva, pago sin segundo descuento y vencimiento único; filtra estado', async () => {
    const disponibles = async () => (await pedir(`${url}/tipos-entrada`, { actor: null })).datos[0].disponibles;
    assert.equal(await disponibles(), 3);
    const pendientes = (await pedir(`${url}/compras?estado=PENDIENTE`)).datos;
    assert.deepEqual(pendientes.map((p) => p.id), [compra.id]);
    const pago = await pedir(`/compras/${compra.id}/pago`, { method: 'POST', actor: 'ana' });
    assert.equal(pago.status, 200);
    assert.equal(pago.datos.pago.importeCentavos, 2500000);
    assert.equal(await disponibles(), 3);
    const otra = (await pedir('/compras', { method: 'POST', actor: 'bruno', body: { compradorId: 'bruno', eventoId, tipoEntradaId, cantidad: 1 } })).datos;
    assert.equal(await disponibles(), 2);
    ahora = new Date(AHORA.getTime() + 300000);
    assert.deepEqual((await pedir(`${url}/compras?estado=CANCELADA`)).datos.map((p) => p.id), [otra.id]);
    assert.equal(await disponibles(), 3);
    assert.equal(await disponibles(), 3);
    assert.deepEqual((await pedir(`${url}/compras?estado=CONFIRMADA`)).datos.map((p) => p.id), [compra.id]);
    ahora = new Date('2026-11-17T20:00:00Z');
    assert.ok((await pedir('/usuarios/lucia/eventos')).datos.some((evento) => evento.id === eventoId));
    assert.ok(!(await pedir('/eventos')).datos.some((evento) => evento.id === eventoId));
    assert.equal((await pedir(`${url}/compras`)).datos.length, 2);
    assert.equal((await pedir(`/compras/${compra.id}`)).datos.estado, 'CONFIRMADA');
  });
});
