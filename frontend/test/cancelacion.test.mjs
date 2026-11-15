import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alternarEntrada, resumenCancelacion } from '../src/formularios/cancelacion.js';

const compra = {
  precioUnitarioCentavos: 1250000,
  entradas: [
    { id: 'a', estado: 'SIN_UTILIZAR' },
    { id: 'b', estado: 'SIN_UTILIZAR' },
    { id: 'c', estado: 'CANCELADA' },
    { id: 'd', estado: 'UTILIZADA' },
  ],
  pago: { entradaIds: ['a', 'b', 'd'] },
};

test('permite seleccionar varias y desmarcar sin mutar ni duplicar la selección anterior', () => {
  const primera = ['a'];
  const varias = alternarEntrada(primera, 'b');
  assert.deepEqual(varias, ['a', 'b']);
  assert.deepEqual(primera, ['a']);
  assert.deepEqual(alternarEntrada(varias, 'a'), ['b']);
  assert.deepEqual(alternarEntrada(varias, 'b'), ['a']);
});

test('resume reembolso pagado por las entradas seleccionadas, con cero para selección vacía', () => {
  assert.deepEqual(resumenCancelacion(compra, ['a', 'b']), {
    cantidad: 2, invalida: false, importeReembolsoCentavos: 2500000, importeLiberadoCentavos: 2500000,
  });
  assert.equal(resumenCancelacion(compra, []).importeReembolsoCentavos, 0);
});

test('reserva sin pago resume cupo e importe liberado sin prometer devolución de dinero', () => {
  assert.deepEqual(resumenCancelacion({ ...compra, pago: null }, ['a']), {
    cantidad: 1, invalida: false, importeReembolsoCentavos: 0, importeLiberadoCentavos: 1250000,
  });
});

test('tras refrescar una selección rechazada se conserva y permite quitar la entrada que cambió', () => {
  const seleccion = ['a', 'b'];
  const actual = { ...compra, entradas: compra.entradas.map((entrada) => entrada.id === 'b' ? { ...entrada, estado: 'CANCELADA' } : entrada) };
  assert.equal(resumenCancelacion(actual, seleccion).invalida, true);
  assert.deepEqual(seleccion, ['a', 'b']);
  const corregida = alternarEntrada(seleccion, 'b');
  assert.equal(resumenCancelacion(actual, corregida).invalida, false);
  assert.equal(resumenCancelacion(actual, corregida).importeReembolsoCentavos, 1250000);
  for (const id of ['c', 'd', 'inexistente']) assert.equal(resumenCancelacion(compra, ['a', id]).invalida, true);
});
