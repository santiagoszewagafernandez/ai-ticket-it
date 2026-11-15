import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import WebSocket from 'ws';
import { crearContexto } from '../src/composicion.js';
import { Mensaje } from '../src/domain/Mensaje.js';
import { crearAplicacion } from '../src/app.js';
import { conectarChat } from '../src/chat.js';

const reserva = { compradorId: 'ana', eventoId: 'noche-indie', tipoEntradaId: 'indie-general', cantidad: 1 };
const fecha = new Date('2026-11-14T12:00:00Z');
const codigo = (esperado) => (error) => error.code === esperado;

describe('Mensaje: invariantes, participación e idempotencia en memoria', () => {
  for (const invalido of [{ texto: '' }, { texto: '  ' }, { texto: 123 }, { idEnvio: '' }, { idEnvio: null }, { fecha: new Date('inválida') }]) {
    test(`dominio rechaza ${JSON.stringify(invalido)}`, () => {
      assert.throws(() => new Mensaje({ compraId: 'compra', autor: { id: 'ana' }, texto: 'Hola', idEnvio: 'envio', fecha, ...invalido }), codigo('INVALID_DATA'));
    });
  }
  test('reintento conserva ID/fecha/texto y no crea otra fila; texto diferente rechaza sin modificar', () => {
    let ahora = new Date(fecha);
    const { repos, servicios } = crearContexto(() => new Date(ahora));
    const compra = servicios.compra.crear(reserva, 'ana');
    const primero = servicios.mensaje.enviar(compra.id, 'ana', { texto: ' Hola ', idEnvio: 'a' });
    ahora = new Date(ahora.getTime() + 3000);
    const otraVez = servicios.mensaje.enviar(compra.id, 'ana', { texto: 'Hola', idEnvio: 'a' });
    assert.equal(primero.nuevo, true);
    assert.equal(otraVez.nuevo, false);
    assert.deepEqual(otraVez.mensaje, primero.mensaje);
    assert.throws(() => servicios.mensaje.enviar(compra.id, 'ana', { texto: 'Otro', idEnvio: 'a' }), codigo('SEND_ID_CONFLICT'));
    assert.equal(repos.mensaje.todos().length, 1);
    assert.deepEqual(servicios.mensaje.listar(compra.id, 'lucia'), [primero.mensaje]);
  });
  test('idEnvio se limita a compra y autor; orden de registro conserva fechas iguales', () => {
    const { servicios, repos } = crearContexto(() => new Date(fecha));
    const a = servicios.compra.crear(reserva, 'ana');
    const b = servicios.compra.crear(reserva, 'ana');
    const enviar = (id, autor, texto) => servicios.mensaje.enviar(id, autor, { idEnvio: 'mismo', texto }).mensaje;
    const uno = enviar(a.id, 'ana', 'Uno');
    const dos = enviar(a.id, 'lucia', 'Dos');
    enviar(b.id, 'ana', 'Tres');
    assert.equal(repos.mensaje.todos().length, 3);
    assert.deepEqual(servicios.mensaje.listar(a.id, 'ana'), [uno, dos]);
  });
  for (const [actor, esperado] of [[undefined, 'IDENTITY_REQUIRED'], ['nadie', 'NOT_FOUND'], ['bruno', 'FORBIDDEN']]) {
    test(`actor ${actor} no lee ni envía: ${esperado}`, () => {
      const { servicios, repos } = crearContexto(() => new Date(fecha));
      const compra = servicios.compra.crear(reserva, 'ana');
      assert.throws(() => servicios.mensaje.listar(compra.id, actor), codigo(esperado));
      assert.throws(() => servicios.mensaje.enviar(compra.id, actor, { texto: 'Hola', idEnvio: 'a' }), codigo(esperado));
      assert.equal(repos.mensaje.todos().length, 0);
    });
  }
  for (const estado of ['PENDIENTE', 'CONFIRMADA', 'CANCELADA', 'REEMBOLSADA', 'UTILIZADA']) {
    test(`chat disponible en ${estado} y después del evento`, () => {
      let ahora = new Date(fecha);
      const { servicios, repos } = crearContexto(() => new Date(ahora));
      const dto = servicios.compra.crear(reserva, 'ana');
      const compra = repos.compra.buscarPorId(dto.id);
      if (['CONFIRMADA', 'REEMBOLSADA', 'UTILIZADA'].includes(estado)) servicios.compra.pagar(dto.id, 'ana');
      if (['CANCELADA', 'REEMBOLSADA'].includes(estado)) servicios.compra.cancelar(dto.id, dto.entradas.map((e) => e.id), 'ana');
      // Fixture de asistencia; no se implementa el bloque de ingreso.
      if (estado === 'UTILIZADA') compra.entradas.forEach((e) => { e.estado = 'UTILIZADA'; });
      assert.equal(compra.estado, estado);
      servicios.mensaje.enviar(dto.id, 'ana', { texto: 'Antes', idEnvio: 'antes' });
      ahora = new Date(compra.evento.fin.getTime() + 1000);
      servicios.compra.procesarVencimientos();
      servicios.mensaje.enviar(dto.id, 'lucia', { texto: 'Después', idEnvio: 'despues' });
      assert.equal(servicios.mensaje.listar(dto.id, 'ana').length, 2);
    });
  }
});

async function escenario(t) {
  const app = crearAplicacion({ reloj: () => new Date(fecha) });
  const server = app.listen(0, '127.0.0.1');
  const conexionesServidor = [];
  server.on('connection', (socket) => conexionesServidor.push(socket));
  const chat = conectarChat(server, app.locals.contexto.servicios.mensaje);
  t.after(async () => {
    chat.cerrar();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const compra = app.locals.contexto.servicios.compra.crear(reserva, 'ana');
  const pedir = async (actor = 'ana', id = compra.id) => {
    const r = await fetch(`${base}/compras/${id}/mensajes`, { headers: actor ? { 'X-Usuario-Id': actor } : {} });
    return { status: r.status, datos: await r.json() };
  };
  async function abrir(actor = 'ana', id = compra.id) {
    const socket = new WebSocket(`${base.replace('http', 'ws')}/compras/${id}/chat`);
    const cola = [];
    const lectores = [];
    socket.on('message', (data) => {
      const valor = JSON.parse(data.toString());
      if (lectores.length) lectores.shift()(valor);
      else cola.push(valor);
    });
    socket.on('error', () => {});
    await once(socket, 'open');
    const siguiente = () => cola.length ? Promise.resolve(cola.shift()) : new Promise((resolve) => lectores.push(resolve));
    const enviar = (datos) => socket.send(typeof datos === 'string' ? datos : JSON.stringify(datos));
    if (actor !== null) enviar({ tipo: 'identificar', usuarioId: actor, plataforma: 'test-node' });
    return { socket, siguiente, enviar };
  }
  return { app, chat, compra, pedir, abrir, conexionesServidor };
}

test('HTTP historial real: 401/403/404, participantes y DTO explícito', { timeout: 6000 }, async (t) => {
  const { pedir, app, compra } = await escenario(t);
  assert.equal((await pedir(null)).status, 401);
  assert.equal((await pedir('bruno')).status, 403);
  assert.equal((await pedir('nadie')).status, 404);
  assert.equal((await pedir('ana', 'ausente')).status, 404);
  const m = app.locals.contexto.servicios.mensaje.enviar(compra.id, 'ana', { texto: 'Historial', idEnvio: '1' }).mensaje;
  assert.deepEqual(await pedir(), { status: 200, datos: [m] });
  assert.deepEqual(await pedir('lucia'), { status: 200, datos: [m] });
  assert.deepEqual(Object.keys(m).sort(), ['id', 'compraId', 'autor', 'texto', 'idEnvio', 'fecha'].sort());
});

test('WS real: comprador/organizador en vivo, guardado antes de confirmar y aislamiento por compra', { timeout: 6000 }, async (t) => {
  const { app, compra, pedir, abrir } = await escenario(t);
  const otra = app.locals.contexto.servicios.compra.crear(reserva, 'ana');
  const ana = await abrir(); const lucia = await abrir('lucia'); const separada = await abrir('ana', otra.id);
  for (const c of [ana, lucia, separada]) assert.equal((await c.siguiente()).tipo, 'listo');
  ana.enviar({ tipo: 'enviar', texto: 'Consulta', idEnvio: 'a', autor: { id: 'bruno' }, compraId: otra.id });
  const confirmacion = await ana.siguiente();
  assert.equal(confirmacion.mensaje.autor.id, 'ana');
  assert.equal(confirmacion.mensaje.compraId, compra.id);
  assert.deepEqual(await lucia.siguiente(), confirmacion);
  assert.deepEqual((await pedir()).datos, [confirmacion.mensaje]);
  lucia.enviar({ tipo: 'enviar', texto: 'Respuesta', idEnvio: 'b' });
  assert.equal((await ana.siguiente()).mensaje.texto, 'Respuesta');
  assert.equal((await lucia.siguiente()).mensaje.texto, 'Respuesta');
  separada.enviar({ tipo: 'enviar', texto: 'Solo otra compra', idEnvio: 'a' });
  // Si hubo filtración, lo primero en esta cola sería Consulta o Respuesta.
  assert.equal((await separada.siguiente()).mensaje.texto, 'Solo otra compra');
  ana.enviar({ tipo: 'enviar', texto: 'Fin', idEnvio: 'c' });
  assert.equal((await ana.siguiente()).mensaje.texto, 'Fin');
  assert.equal((await lucia.siguiente()).mensaje.texto, 'Fin');
});

test('WS real: terceros/no identificados no suscriben ni envían; no permite cambiar de identidad', { timeout: 6000 }, async (t) => {
  const { app, abrir, compra } = await escenario(t);
  for (const [actor, esperado, id] of [['bruno', 'FORBIDDEN', compra.id], ['nadie', 'NOT_FOUND', compra.id], ['ana', 'NOT_FOUND', 'ausente']]) {
    const cliente = await abrir(actor, id);
    const r = await cliente.siguiente();
    assert.equal(r.tipo, 'error'); assert.equal(r.error.code, esperado); assert.equal(r.fatal, true);
  }
  const anonimo = await abrir(null);
  anonimo.enviar({ tipo: 'enviar', texto: 'Intruso', idEnvio: 'a' });
  assert.equal((await anonimo.siguiente()).error.code, 'IDENTITY_REQUIRED');
  const ana = await abrir();
  await ana.siguiente();
  ana.enviar({ tipo: 'identificar', usuarioId: 'bruno' });
  assert.equal((await ana.siguiente()).error.code, 'INVALID_DATA');
  ana.enviar({ tipo: 'enviar', texto: 'Sigo siendo Ana', idEnvio: 'a', usuarioId: 'bruno' });
  assert.equal((await ana.siguiente()).mensaje.autor.id, 'ana');
  assert.equal(app.locals.contexto.repos.mensaje.todos().length, 1);
});

test('WS real: confirmación perdida, reconexión y reintento conservan mensaje y fecha originales', { timeout: 6000 }, async (t) => {
  const { abrir, pedir } = await escenario(t);
  const ana = await abrir(); await ana.siguiente();
  const lucia = await abrir('lucia'); await lucia.siguiente();
  // El emisor descarta su confirmación y corta la conexión; Lucía acredita el guardado.
  ana.enviar({ tipo: 'enviar', texto: '¿Llegó?', idEnvio: 'perdido' });
  const original = (await lucia.siguiente()).mensaje;
  ana.socket.terminate();
  const recuperada = await abrir(); await recuperada.siguiente();
  assert.deepEqual((await pedir()).datos, [original]);
  recuperada.enviar({ tipo: 'enviar', texto: '¿Llegó?', idEnvio: 'perdido' });
  assert.deepEqual((await recuperada.siguiente()).mensaje, original);
  assert.equal((await pedir()).datos.length, 1);
  // El reintento solo confirma al solicitante: el otro no recibe una segunda difusión.
  recuperada.enviar({ tipo: 'enviar', texto: 'Nuevo', idEnvio: 'nuevo' });
  assert.equal((await lucia.siguiente()).mensaje.texto, 'Nuevo');
});

test('WS real: JSON/texto/idEnvio inválidos, conflicto y revalidación de participación sin efectos', { timeout: 6000 }, async (t) => {
  const { app, compra, abrir, pedir } = await escenario(t);
  const ana = await abrir(); await ana.siguiente();
  for (const datos of ['{', [], { tipo: 'enviar', texto: '', idEnvio: 'a' }, { tipo: 'enviar', texto: 'Hola' }]) {
    ana.enviar(datos);
    assert.equal((await ana.siguiente()).error.code, 'INVALID_DATA');
  }
  assert.deepEqual((await pedir()).datos, []);
  ana.enviar({ tipo: 'enviar', texto: 'Original', idEnvio: 'a' }); await ana.siguiente();
  ana.enviar({ tipo: 'enviar', texto: 'Cambiado', idEnvio: 'a' });
  assert.equal((await ana.siguiente()).error.code, 'SEND_ID_CONFLICT');
  assert.equal((await pedir()).datos.length, 1);
  // Simular cambio de participación: no existe endpoint que lo haga en este bloque.
  app.locals.contexto.repos.compra.buscarPorId(compra.id).comprador = app.locals.contexto.repos.usuario.buscarPorId('bruno');
  ana.enviar({ tipo: 'enviar', texto: 'Ya no soy parte', idEnvio: 'b' });
  assert.equal((await ana.siguiente()).error.code, 'FORBIDDEN');
  assert.equal(app.locals.contexto.repos.mensaje.todos().length, 1);
});

test('WS real: salir cierra conexión; volver no deja listeners/suscripciones duplicados', { timeout: 6000 }, async (t) => {
  const { chat, abrir, conexionesServidor } = await escenario(t);
  const ana = await abrir(); await ana.siguiente();
  assert.equal(chat.conexiones(), 1);
  const cierre = once(ana.socket, 'close');
  const cierreServidor = once(conexionesServidor[0], 'close');
  ana.socket.close(); await Promise.all([cierre, cierreServidor]);
  assert.equal(chat.conexiones(), 0);
  const nueva = await abrir(); await nueva.siguiente();
  assert.equal(chat.conexiones(), 1);
  nueva.enviar({ tipo: 'enviar', texto: 'Una entrega', idEnvio: 'a' });
  assert.equal((await nueva.siguiente()).mensaje.texto, 'Una entrega');
});
