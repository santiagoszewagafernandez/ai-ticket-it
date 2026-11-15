import { test } from 'node:test';
import assert from 'node:assert/strict';
import { altaEvento, datosEvento, fechaFormulario, formularioVacio } from '../src/formularios/evento.js';

const preparar = () => ({ ...formularioVacio(), titulo: 'Festival móvil', descripcion: 'Una noche de música.', categoriaId: 'musica',
  inicioFecha: '15/11/2026', inicioHora: '21:00', finFecha: '16/11/2026', finHora: '00:30',
  multimedia: [{ tipo: 'imagen', url: 'https://example.com/foto.jpg' }],
  tiposEntrada: [{ nombre: 'General', descripcion: 'Salón.', precio: '12500,25', cupo: '5' },
    { nombre: 'VIP', descripcion: 'Sector elevado.', precio: '20000', cupo: '2' }] });

test('convierte Buenos Aires a UTC y pesos con coma a centavos sin cambiar el formulario compartido', () => {
  const formulario = preparar();
  const antes = structuredClone(formulario);
  const conjunto = altaEvento(formulario, 'lucia');
  assert.equal(conjunto.inicio, '2026-11-16T00:00:00.000Z');
  assert.equal(conjunto.fin, '2026-11-16T03:30:00.000Z');
  assert.equal(conjunto.tiposEntrada[0].precioCentavos, 1250025);
  assert.equal(conjunto.tiposEntrada[1].cupo, 2);
  assert.deepEqual(formulario, antes);
  conjunto.multimedia[0].url = 'https://example.com/cambiada.jpg';
  assert.deepEqual(formulario, antes);
});

test('paso de datos y rechazo del segundo tipo conservan todos los valores para corregir y enviar', () => {
  const formulario = preparar();
  formulario.tiposEntrada[1].precio = 'no válido';
  const antes = structuredClone(formulario);
  assert.equal(datosEvento(formulario).titulo, 'Festival móvil');
  assert.deepEqual(formulario, antes);
  assert.throws(() => altaEvento(formulario, 'lucia'), /Tipo 2/);
  assert.deepEqual(formulario, antes);
  formulario.tiposEntrada[1].precio = '20000';
  assert.equal(altaEvento(formulario, 'lucia').tiposEntrada.length, 2);
  assert.equal(formulario.tiposEntrada[0].precio, '12500,25');
});

test('rechaza fechas imposibles, horas inválidas, fin anterior y URLs sin borrar datos', () => {
  for (const cambio of [{ inicioFecha: '31/02/2026' }, { inicioHora: '24:01' }, { finFecha: '14/11/2026' },
    { multimedia: [{ tipo: 'imagen', url: 'file:///foto' }] }]) {
    const formulario = { ...preparar(), ...cambio };
    const antes = structuredClone(formulario);
    assert.throws(() => datosEvento(formulario));
    assert.deepEqual(formulario, antes);
  }
  assert.equal(fechaFormulario('29/02/2028', '00:00', 'Inicio'), '2028-02-29T03:00:00.000Z');
});

test('no convierte vacío, negativos, fracciones ni exponentes en cupos; gratuito y cupo cero son válidos', () => {
  for (const cupo of ['', '-1', '1.5', '1e2', '9007199254740992']) {
    const formulario = preparar();
    formulario.tiposEntrada[0].cupo = cupo;
    assert.throws(() => altaEvento(formulario, 'lucia'), /cupo/);
  }
  for (const precio of ['', '-1', '1,001', '1e2', '9007199254740992']) {
    const formulario = preparar();
    formulario.tiposEntrada[0].precio = precio;
    assert.throws(() => altaEvento(formulario, 'lucia'), /precio/);
  }
  const formulario = preparar();
  formulario.tiposEntrada[0].precio = '0';
  formulario.tiposEntrada[0].cupo = '0';
  assert.equal(altaEvento(formulario, 'lucia').tiposEntrada[0].precioCentavos, 0);
  assert.equal(altaEvento(formulario, 'lucia').tiposEntrada[0].cupo, 0);
});
