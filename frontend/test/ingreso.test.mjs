import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contenidoQR, leerQR } from '../src/entradas/qr.js';
import { LectorEntrada } from '../src/entradas/LectorEntrada.js';
const dto = { entrada: { id: 'entrada-1', estado: 'SIN_UTILIZAR', uso: null } };
const diferida = () => { let resolver; const promesa = new Promise((resolve) => { resolver = resolve; }); return { promesa, resolver }; };

test('QR versionado solo transporta ID, incluso con caracteres reservados', () => {
  for (const id of ['compra-entrada-1', 'á/?#:%']) assert.equal(leerQR(contenidoQR(id)), id);
  for (const valor of ['', 'https://otra.app/entrada', 'ai-ticket-it:entrada:v2:id', 'ai-ticket-it:entrada:v1:', 'ai-ticket-it:entrada:v1:%', 'ai-ticket-it:entrada:v1:%20']) assert.throws(() => leerQR(valor));
});
test('escanear pausa inmediatamente, consulta una vez y solo Confirmar usa', async () => {
  const pendiente = diferida(); let consultas = 0; let usos = 0;
  const lector = new LectorEntrada({ validar: () => { consultas++; return pendiente.promesa; }, usar: async () => { usos++; return dto; } });
  const operacion = lector.escanear(contenidoQR('entrada-1'));
  assert.equal(lector.estado.fase, 'consultando');
  await lector.escanear(contenidoQR('otra'));
  await lector.confirmar();
  assert.equal(consultas, 1); assert.equal(usos, 0);
  pendiente.resolver(dto); await operacion;
  assert.equal(lector.estado.fase, 'validada');
  await lector.escanear(contenidoQR('otra'));
  assert.equal(consultas, 1);
  await lector.confirmar(); await lector.confirmar();
  assert.equal(usos, 1); assert.equal(lector.estado.fase, 'utilizada');
  lector.otra(); assert.equal(lector.estado.fase, 'leyendo'); assert.equal(lector.estado.datos, null);
});
test('doble toque en confirmación no duplica el envío', async () => {
  const pendiente = diferida(); let usos = 0;
  const lector = new LectorEntrada({ validar: async () => dto, usar: () => { usos++; return pendiente.promesa; } });
  await lector.escanear(contenidoQR('entrada-1'));
  const confirmacion = lector.confirmar();
  await lector.confirmar(); lector.otra();
  assert.equal(lector.estado.fase, 'confirmando'); assert.equal(usos, 1);
  pendiente.resolver(dto); await confirmacion;
});
test('QR inválido conserva motivo hasta Escanear otra y no consulta backend', async () => {
  let consultas = 0;
  const lector = new LectorEntrada({ validar: async () => { consultas++; return dto; }, usar: async () => dto });
  await lector.escanear('otro QR'); await lector.escanear(contenidoQR('entrada-1'));
  assert.equal(consultas, 0); assert.equal(lector.estado.fase, 'rechazada'); assert.match(lector.estado.error, /QR/);
  lector.otra(); await lector.escanear(contenidoQR('entrada-1')); assert.equal(consultas, 1);
});
test('conflicto de otra confirmación muestra el motivo y exige nueva lectura', async () => {
  const lector = new LectorEntrada({ validar: async () => dto, usar: async () => { throw new Error('La entrada ya fue utilizada.'); } });
  await lector.escanear(contenidoQR('entrada-1')); await lector.confirmar();
  assert.equal(lector.estado.fase, 'rechazada'); assert.match(lector.estado.error, /ya fue utilizada/);
});
for (const confirmando of [false, true]) test(`salir/segundo plano descarta respuesta tardía de ${confirmando ? 'uso' : 'consulta'}`, async () => {
  const pendiente = diferida(); let signal;
  const accion = async (id, s) => { signal = s; return pendiente.promesa; };
  const lector = new LectorEntrada({ validar: confirmando ? async () => dto : accion, usar: accion });
  let operacion = lector.escanear(contenidoQR('entrada-1'));
  if (confirmando) { await operacion; operacion = lector.confirmar(); }
  lector.suspender(); assert.equal(signal.aborted, true);
  assert.equal(lector.estado.fase, 'rechazada');
  lector.otra(); pendiente.resolver(dto); await operacion;
  assert.equal(lector.estado.fase, 'leyendo'); assert.equal(lector.estado.datos, null);
});
