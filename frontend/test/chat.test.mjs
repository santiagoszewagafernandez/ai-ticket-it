import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChatCompra, combinarMensajes } from '../src/chat/ChatCompra.js';

const mensaje = (id, autor = 'ana', idEnvio = id, compraId = 'compra') => ({
  id, compraId, idEnvio, texto: `Texto ${id}`, autor: { id: autor, nombre: autor }, fecha: '2026-11-14T12:00:00.000Z',
});
const turno = () => new Promise(setImmediate);
const diferida = () => { let resolver, rechazar; const promise = new Promise((resolve, reject) => { resolver = resolve; rechazar = reject; }); return { promise, resolver, rechazar }; };

function preparar({ usuarioId = 'ana', compraId = 'compra', historial = async () => [] } = {}) {
  const sockets = [];
  const timers = new Map();
  const consultas = [];
  let contador = 0;
  let ids = 0;
  class Socket {
    readyState = 0;
    envios = [];
    cierres = 0;
    onopen = null; onmessage = null; onclose = null; onerror = null;
    abrir() { this.readyState = 1; this.onopen?.(); }
    recibir(datos) { this.onmessage?.({ data: JSON.stringify(datos) }); }
    listo() { this.recibir({ tipo: 'listo', compraId, usuarioId }); }
    send(datos) { this.envios.push(JSON.parse(datos)); }
    close() { this.cierres += 1; this.readyState = 3; }
    cortar() { this.readyState = 3; this.onclose?.(); }
  }
  const chat = new ChatCompra({
    compraId, usuarioId, plataforma: 'test',
    abrirSocket: () => { const socket = new Socket(); sockets.push(socket); return socket; },
    historial: (signal) => { consultas.push(signal); return historial(signal); },
    alCambiar: () => {}, crearId: () => `envio-${++ids}`,
    programar: (fn, ms) => { const id = ++contador; timers.set(id, { fn, ms }); return id; },
    cancelar: (id) => timers.delete(id),
  });
  const timer = (ms) => {
    const par = [...timers].find(([, valor]) => valor.ms === ms);
    assert.ok(par, `Debe existir timer de ${ms} ms`);
    timers.delete(par[0]); par[1].fn();
  };
  const conectar = async () => { chat.iniciar(); const socket = sockets.at(-1); socket.abrir(); socket.listo(); await turno(); return socket; };
  return { chat, sockets, consultas, timers, timer, conectar };
}

test('abre socket e identifica antes de pedir historial; envío espera sincronización', async () => {
  const espera = diferida(); const e = preparar({ historial: () => espera.promise });
  e.chat.iniciar();
  assert.equal(e.consultas.length, 0);
  const s = e.sockets[0]; s.abrir();
  assert.deepEqual(s.envios, [{ tipo: 'identificar', usuarioId: 'ana', plataforma: 'test' }]);
  assert.equal(e.consultas.length, 0);
  s.listo(); assert.equal(e.consultas.length, 1);
  assert.equal(e.chat.enviar('Todavía no'), false);
  espera.resolver([]); await turno();
  assert.equal(e.chat.estado.conexion, 'Conectado');
  assert.equal(e.timers.size, 0); e.chat.detener();
});

test('apertura mezcla historial/eventos superpuestos sin huecos, duplicados ni desorden con fechas iguales', async () => {
  const espera = diferida(); const e = preparar({ historial: () => espera.promise });
  e.chat.iniciar(); const s = e.sockets[0]; s.abrir(); s.listo();
  s.recibir({ tipo: 'mensaje', mensaje: mensaje('dos') });
  s.recibir({ tipo: 'mensaje', mensaje: mensaje('tres') });
  espera.resolver([mensaje('uno'), mensaje('dos')]); await turno();
  assert.deepEqual(e.chat.estado.mensajes.map((m) => m.id), ['uno', 'dos', 'tres']);
  s.recibir({ tipo: 'mensaje', mensaje: mensaje('tres') });
  s.recibir({ tipo: 'mensaje', mensaje: mensaje('cuatro') });
  assert.deepEqual(e.chat.estado.mensajes.map((m) => m.id), ['uno', 'dos', 'tres', 'cuatro']); e.chat.detener();
});

test('eco del servidor confirma Enviado y no deja copia pendiente; mismo idEnvio de otro autor no confirma', async () => {
  const e = preparar(); const s = await e.conectar();
  assert.equal(e.chat.enviar('Hola'), true);
  assert.equal(e.chat.estado.pendientes[0].estado, 'Enviando');
  s.recibir({ tipo: 'mensaje', mensaje: mensaje('ajeno', 'lucia', 'envio-1') });
  assert.equal(e.chat.estado.pendientes.length, 1);
  s.recibir({ tipo: 'mensaje', mensaje: mensaje('propio', 'ana', 'envio-1') });
  assert.equal(e.chat.estado.pendientes.length, 0);
  assert.equal(e.chat.estado.mensajes.length, 2); assert.equal(e.timers.size, 0); e.chat.detener();
});

test('confirmación perdida: timeout permite reintentar exactamente texto/idEnvio originales', async () => {
  const e = preparar(); const s = await e.conectar();
  e.chat.enviar('Hola'); const original = s.envios.at(-1);
  e.timer(8000); assert.equal(e.chat.estado.pendientes[0].estado, 'Error');
  e.chat.reintentar('envio-1');
  assert.deepEqual(s.envios.at(-1), original);
  assert.equal(e.chat.estado.pendientes[0].estado, 'Enviando');
  s.recibir({ tipo: 'mensaje', mensaje: mensaje('guardado', 'ana', 'envio-1') });
  assert.equal(e.chat.estado.pendientes.length, 0);
  assert.equal(e.chat.estado.mensajes.length, 1); e.chat.detener();
});

test('reconexión recupera confirmación perdida desde historial sin reenviar ni duplicar', async () => {
  let historial = [];
  const e = preparar({ historial: async () => historial }); const s = await e.conectar();
  e.chat.enviar('Guardado sin eco'); s.cortar();
  assert.equal(e.chat.estado.pendientes[0].estado, 'Error');
  historial = [mensaje('registrado', 'ana', 'envio-1')];
  e.timer(1000); const nueva = e.sockets.at(-1); nueva.abrir(); nueva.listo(); await turno();
  assert.equal(e.chat.estado.pendientes.length, 0);
  assert.equal(e.chat.estado.mensajes.length, 1);
  assert.deepEqual(nueva.envios.map((v) => v.tipo), ['identificar']); e.chat.detener();
});

test('reconexión recupera mensajes del intervalo desconectado y combina eventos durante el HTTP', async () => {
  const espera = diferida(); let consulta = 0;
  const e = preparar({ historial: () => ++consulta === 1 ? Promise.resolve([mensaje('uno')]) : espera.promise });
  const s = await e.conectar(); s.cortar(); e.timer(1000);
  const nueva = e.sockets.at(-1); nueva.abrir(); nueva.listo();
  nueva.recibir({ tipo: 'mensaje', mensaje: mensaje('tres', 'lucia') });
  espera.resolver([mensaje('uno'), mensaje('dos', 'lucia'), mensaje('tres', 'lucia')]); await turno();
  assert.deepEqual(e.chat.estado.mensajes.map((m) => m.id), ['uno', 'dos', 'tres']); e.chat.detener();
});

test('salir aborta historial y descarta respuesta tardía; cierra socket y elimina handlers/timers', async () => {
  const espera = diferida(); const e = preparar({ historial: () => espera.promise });
  e.chat.iniciar(); const s = e.sockets[0]; s.abrir(); s.listo(); const anterior = s.onmessage;
  e.chat.detener();
  assert.equal(e.consultas[0].aborted, true);
  assert.equal(s.cierres, 1); assert.equal(s.onmessage, null); assert.equal(s.onclose, null);
  assert.equal(e.timers.size, 0);
  espera.resolver([mensaje('viejo')]); anterior({ data: JSON.stringify({ tipo: 'mensaje', mensaje: mensaje('otro') }) }); await turno();
  assert.deepEqual(e.chat.estado.mensajes, []); assert.equal(e.chat.estado.conexion, 'Desconectado');
});

test('salir con envío pendiente limpia confirmación; volver abre una única conexión', async () => {
  const e = preparar(); const s = await e.conectar(); e.chat.enviar('Hola');
  assert.equal(e.timers.size, 1); e.chat.detener();
  assert.equal(e.timers.size, 0); assert.equal(e.chat.estado.pendientes[0].estado, 'Error');
  const nueva = await e.conectar(); e.chat.iniciar();
  assert.equal(e.sockets.length, 2); assert.equal(s.cierres, 1); assert.equal(nueva.cierres, 0); e.chat.detener();
});

test('cambio de usuario/compra usa otra sesión sin mensajes ni pendientes anteriores', async () => {
  const primera = preparar(); const s = await primera.conectar(); primera.chat.enviar('Privado');
  const vieja = s.onmessage; primera.chat.detener();
  const segunda = preparar({ usuarioId: 'lucia', compraId: 'otra' }); await segunda.conectar();
  vieja({ data: JSON.stringify({ tipo: 'mensaje', mensaje: mensaje('tardio') }) });
  assert.deepEqual(segunda.chat.estado.mensajes, []); assert.deepEqual(segunda.chat.estado.pendientes, []);
  assert.equal(s.onmessage, null); segunda.chat.detener();
});

test('reintentos automáticos acotados y recuperación manual; no deja timers después de detener', () => {
  const e = preparar(); e.chat.iniciar();
  for (const demora of [1000, 2000, 4000, 8000, 10000]) {
    e.sockets.at(-1).cortar(); assert.equal(e.chat.estado.conexion, 'Reconectando'); e.timer(demora);
  }
  e.sockets.at(-1).cortar();
  assert.equal(e.chat.estado.conexion, 'Desconectado'); assert.equal(e.timers.size, 0);
  e.chat.reconectar(); assert.equal(e.sockets.length, 7); e.chat.detener(); assert.equal(e.timers.size, 0);
});

test('historial 403 borra datos y detiene reconexión, sin mostrar conversación ajena', async () => {
  const e = preparar({ historial: async () => { throw Object.assign(new Error('Sin acceso'), { status: 403 }); } });
  const s = await e.conectar();
  assert.equal(e.chat.estado.conexion, 'Acceso rechazado');
  assert.deepEqual(e.chat.estado.mensajes, []); assert.deepEqual(e.chat.estado.pendientes, []);
  assert.equal(e.timers.size, 0); assert.equal(s.cierres, 1);
  e.chat.reconectar(); assert.equal(e.sockets.length, 1); e.chat.detener();
});

test('error de envío correlacionado conserva texto para reintentar; error fatal limpia sesión', async () => {
  const e = preparar(); const s = await e.conectar(); e.chat.enviar('Hola');
  s.recibir({ tipo: 'error', idEnvio: 'envio-1', fatal: false, error: { code: 'INVALID_DATA', message: 'Revisá el texto' } });
  assert.equal(e.chat.estado.pendientes[0].estado, 'Error'); assert.equal(e.chat.estado.pendientes[0].texto, 'Hola');
  s.recibir({ tipo: 'error', fatal: true, error: { code: 'FORBIDDEN', message: 'Sin permiso' } });
  assert.equal(e.chat.estado.conexion, 'Acceso rechazado'); assert.deepEqual(e.chat.estado.pendientes, []); e.chat.detener();
});

test('mensaje de otra compra nunca se incorpora y provoca resincronización', async () => {
  const e = preparar(); const s = await e.conectar();
  s.recibir({ tipo: 'mensaje', mensaje: mensaje('ajeno', 'ana', 'a', 'otra') });
  assert.deepEqual(e.chat.estado.mensajes, []); assert.equal(e.chat.estado.conexion, 'Reconectando'); e.chat.detener();
});

test('combinar no modifica entradas ni usa texto/fecha/idEnvio como identidad del mensaje', () => {
  const uno = mensaje('1'); const dos = mensaje('2', 'ana', '1');
  const historial = [uno]; const vivos = [uno, dos];
  assert.deepEqual(combinarMensajes(historial, vivos), [uno, dos]);
  assert.deepEqual(historial, [uno]); assert.deepEqual(vivos, [uno, dos]);
});
