import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { crearContexto } from '../src/composicion.js';
import { crearAplicacion } from '../src/app.js';
import { Resena } from '../src/domain/Resena.js';

const AHORA = new Date('2026-11-14T16:00:00Z');
const FIN = new Date('2026-11-14T18:00:00Z');
const foto = (repos) => JSON.stringify(Object.fromEntries(Object.entries(repos).map(([k, r]) => [k, r.todos()])));
function escenario(contexto) {
  const { servicios, repos } = contexto;
  const evento = servicios.evento.crear({ organizadorId: 'lucia', titulo: 'Encuentro para reseñar', descripcion: 'Música compartida.', categoriaId: 'musica',
    inicio: '2026-11-14T17:00:00Z', fin: FIN.toISOString(), tiposEntrada: [{ nombre: 'General', descripcion: 'Acceso.', precioCentavos: 100, cupo: 10 }] }, 'lucia');
  const reservar = (compradorId = 'ana', cantidad = 2) => {
    const c = servicios.compra.crear({ compradorId, eventoId: evento.id, tipoEntradaId: evento.tiposEntrada[0].id, cantidad }, compradorId);
    servicios.compra.pagar(c.id, compradorId);
    return repos.compra.buscarPorId(c.id);
  };
  return { ...contexto, evento, reservar };
}
function preparar({ usada = true, terminado = true } = {}) {
  let ahora = AHORA;
  const c = escenario(crearContexto(() => new Date(ahora)));
  const compra = c.reservar();
  if (usada) c.servicios.entrada.usar(compra.entradas[0].id, c.evento.id, 'lucia');
  if (terminado) ahora = FIN;
  return { ...c, compra, fijarHora: (fecha) => { ahora = new Date(fecha); } };
}

describe('Reseñas por comprador/evento', () => {
  test('una usada y otra sin usar habilitan en el fin exacto aunque siga CONFIRMADA', () => {
    const { servicios, repos, compra, evento } = preparar();
    assert.equal(compra.estado, 'CONFIRMADA');
    const antes = JSON.stringify(compra);
    const dto = servicios.resena.crear(evento.id, { puntaje: 5, comentario: ' Una buena experiencia. ' }, 'ana');
    assert.equal(dto.comentario, 'Una buena experiencia.');
    assert.equal(dto.comprador.id, 'ana');
    assert.equal(dto.evento.id, evento.id);
    assert.equal(dto.fecha, FIN.toISOString());
    assert.equal(JSON.stringify(compra), antes);
    assert.equal(repos.resena.deCompradorEvento('ana', evento.id).id, dto.id);
  });
  for (const [nombre, opciones, code] of [
    ['antes del fin con asistencia', { terminado: false }, 'EVENT_NOT_FINISHED'],
    ['evento finalizado sin asistencia', { usada: false }, 'ATTENDANCE_REQUIRED'],
  ]) test(`${nombre}: rechazo sin efectos`, () => {
    const { servicios, repos, evento } = preparar(opciones);
    const antes = foto(repos);
    assert.throws(() => servicios.resena.crear(evento.id, { puntaje: 4, comentario: 'Comentario' }, 'ana'), { code });
    assert.equal(foto(repos), antes);
  });
  test('un milisegundo antes del fin rechaza; el fin exacto permite', () => {
    const { servicios, evento, fijarHora } = preparar();
    fijarHora(FIN.getTime() - 1);
    assert.throws(() => servicios.resena.crear(evento.id, { puntaje: 1, comentario: 'Experiencia.' }, 'ana'), { code: 'EVENT_NOT_FINISHED' });
    fijarHora(FIN);
    assert.equal(servicios.resena.crear(evento.id, { puntaje: 1, comentario: 'Experiencia.' }, 'ana').puntaje, 1);
  });
  for (const puntaje of [0, 6, 1.5, '5', null, undefined, NaN]) test(`puntaje ${puntaje}: INVALID_DATA sin registro`, () => {
    const { servicios, repos, evento } = preparar(); const antes = foto(repos);
    assert.throws(() => servicios.resena.crear(evento.id, { puntaje, comentario: 'Comentario' }, 'ana'), { code: 'INVALID_DATA' });
    assert.equal(foto(repos), antes);
  });
  for (const comentario of ['', '  ', null, 5, undefined]) test(`comentario ${comentario}: INVALID_DATA sin registro`, () => {
    const { servicios, repos, evento } = preparar(); const antes = foto(repos);
    assert.throws(() => servicios.resena.crear(evento.id, { puntaje: 3, comentario }, 'ana'), { code: 'INVALID_DATA' });
    assert.equal(foto(repos), antes);
  });
  test('asistencia de otro comprador o evento no habilita y campos enviados no suplantan actor', () => {
    const { servicios, repos, evento } = preparar(); const antes = foto(repos);
    assert.throws(() => servicios.resena.crear(evento.id, { compradorId: 'ana', puntaje: 5, comentario: 'Comentario' }, 'bruno'), { code: 'ATTENDANCE_REQUIRED' });
    assert.throws(() => servicios.resena.crear('taller-anterior', { puntaje: 5, comentario: 'Comentario' }, 'bruno'), { code: 'ATTENDANCE_REQUIRED' });
    assert.equal(foto(repos), antes);
  });
  test('pagadas sin usar, canceladas y reservas vencidas no acreditan asistencia', () => {
    const { servicios, compra, evento } = preparar({ usada: false });
    assert.equal(compra.estado, 'CONFIRMADA');
    assert.throws(() => servicios.resena.crear(evento.id, { puntaje: 3, comentario: 'Comentario' }, 'ana'), { code: 'ATTENDANCE_REQUIRED' });
    for (const estado of ['CANCELADA', 'SIN_UTILIZAR']) {
      compra.entradas.forEach((e) => { e.estado = estado; });
      compra.pago = null;
      assert.equal(compra.acreditaAsistencia('ana', evento.id), false);
    }
  });
  test('una reseña se reconoce en todas las compras, incluida la que no tiene uso', () => {
    const { servicios, repos, evento, reservar, compra, fijarHora } = preparar({ terminado: false });
    const otra = reservar();
    fijarHora(FIN);
    assert.equal(servicios.compra.detalle(otra.id, 'ana').resena.puedePublicar, true);
    const resena = servicios.resena.crear(evento.id, { puntaje: 4, comentario: 'Una reseña compartida.' }, 'ana');
    for (const c of [compra, otra]) {
      const situacion = servicios.compra.detalle(c.id, 'ana').resena;
      assert.equal(situacion.puedePublicar, false);
      assert.deepEqual(situacion.propia, resena);
    }
    const antes = foto(repos);
    assert.throws(() => servicios.resena.crear(evento.id, { puntaje: 1, comentario: 'Otra.' }, 'ana'), { code: 'REVIEW_ALREADY_EXISTS' });
    assert.equal(foto(repos), antes);
  });
  for (const [actor, code] of [[undefined, 'IDENTITY_REQUIRED'], ['nadie', 'NOT_FOUND']]) test(`identidad ${actor}: ${code}`, () => {
    const { servicios, evento } = preparar();
    assert.throws(() => servicios.resena.crear(evento.id, { puntaje: 3, comentario: 'Comentario' }, actor), { code });
  });
  test('dominio protege las reglas sin pasar por el servicio', () => {
    const { compra, repos } = preparar();
    const datos = { comprador: compra.comprador, evento: compra.evento, compras: [compra], puntaje: 2, comentario: 'Experiencia.', fecha: FIN };
    assert.throws(() => new Resena({ ...datos, compras: [] }), { code: 'ATTENDANCE_REQUIRED' });
    assert.throws(() => new Resena({ ...datos, fecha: AHORA }), { code: 'EVENT_NOT_FINISHED' });
    assert.throws(() => new Resena({ ...datos, fecha: new Date(NaN) }), { code: 'INVALID_DATA' });
    assert.throws(() => new Resena({ ...datos, comentario: ' ' }), { code: 'INVALID_DATA' });
    const primera = new Resena(datos);
    repos.resena.guardar(primera);
    assert.throws(() => repos.resena.guardar(new Resena(datos)), { code: 'REVIEW_ALREADY_EXISTS' });
  });
  test('reputación pondera cada reseña por igual y llega al catálogo, detalle e histórico', () => {
    const { servicios, evento } = preparar();
    assert.deepEqual(servicios.resena.reputacion('lucia'), { puntaje: 4.5, cantidad: 2 });
    const nueva = servicios.resena.crear(evento.id, { puntaje: 1, comentario: 'Experiencia mejorable.' }, 'ana');
    const reputacion = { puntaje: 10 / 3, cantidad: 3 };
    assert.deepEqual(servicios.resena.reputacion('lucia'), reputacion);
    assert.deepEqual(servicios.evento.detalle('noche-indie').organizador.reputacion, reputacion);
    const catalogo = servicios.evento.listar({ orden: 'puntaje' });
    assert.deepEqual(catalogo[0].organizador.reputacion, reputacion);
    assert.equal(catalogo.at(-1).organizador.reputacion.puntaje, null);
    const historico = servicios.resena.listar('lucia');
    assert.equal(historico.length, 3);
    assert.deepEqual(historico.find((r) => r.id === nueva.id), nueva);
  });
  test('fixture permite reseñar desde cualquiera de dos compras y cambia orden por reputación', () => {
    const { servicios } = crearContexto(() => AHORA);
    assert.equal(servicios.compra.detalle('demo-resena-pendiente', 'ana').estado, 'CONFIRMADA');
    assert.equal(servicios.compra.detalle('demo-resena-otra-compra', 'ana').resena.puedePublicar, true);
    servicios.resena.crear('taller-anterior', { puntaje: 5, comentario: 'Buena organización.' }, 'ana');
    assert.equal(servicios.evento.listar({ orden: 'puntaje' })[0].organizador.id, 'bruno');
    assert.equal(servicios.compra.detalle('demo-resena-pendiente', 'ana').resena.propia.puntaje, 5);
  });
});

test('HTTP reseñas: identidad, formato, unicidad concurrente y consultas existentes', async (t) => {
  const app = crearAplicacion({ reloj: () => new Date(AHORA) });
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  async function pedir(path, method = 'GET', body, actor = 'ana') {
    const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(actor ? { 'X-Usuario-Id': actor } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: r.status, datos: await r.json() };
  }
  const url = '/eventos/taller-anterior/resenas';
  const datos = { puntaje: 5, comentario: 'Publicado en la API.' };
  assert.equal((await pedir(url, 'POST', datos, null)).status, 401);
  assert.equal((await pedir('/eventos/ausente/resenas', 'POST', datos)).status, 404);
  assert.equal((await pedir(url, 'POST', datos, 'bruno')).datos.error.code, 'ATTENDANCE_REQUIRED');
  assert.equal((await pedir('/eventos/noche-indie/resenas', 'POST', datos)).datos.error.code, 'EVENT_NOT_FINISHED');
  const antes = foto(app.locals.contexto.repos);
  for (const body of [[], {}, { ...datos, puntaje: 1.5 }, { ...datos, comentario: '' }]) assert.equal((await pedir(url, 'POST', body)).status, 400);
  assert.equal(foto(app.locals.contexto.repos), antes);
  const resultados = await Promise.all([pedir(url, 'POST', datos), pedir(url, 'POST', datos)]);
  assert.deepEqual(resultados.map((r) => r.status).sort(), [201, 409]);
  assert.equal(resultados.find((r) => r.status === 409).datos.error.code, 'REVIEW_ALREADY_EXISTS');
  const resena = resultados.find((r) => r.status === 201).datos;
  const historial = (await pedir('/resenas?organizadorId=bruno')).datos;
  assert.deepEqual(historial, [resena]);
  assert.equal((await pedir('/resenas?organizadorId=ausente')).status, 404);
  for (const id of ['demo-resena-pendiente', 'demo-resena-otra-compra']) {
    const compra = (await pedir(`/compras/${id}`)).datos;
    assert.deepEqual(compra.resena.propia, resena); assert.equal(compra.resena.puedePublicar, false);
  }
  assert.deepEqual((await pedir('/eventos/teatro')).datos.organizador.reputacion, { puntaje: 5, cantidad: 1 });
  assert.equal((await pedir('/eventos?orden=puntaje')).datos[0].organizador.id, 'bruno');
  assert.equal((await pedir(url, 'PATCH', { puntaje: 1 })).status, 404);
});
