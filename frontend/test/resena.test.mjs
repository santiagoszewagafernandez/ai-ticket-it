import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepararResena } from '../src/formularios/resena.js';

test('no permite publicar sin elegir estrellas ni con fracciones/fuera de escala', () => {
  for (const valor of [0, 1.5, 6, '4', null]) assert.throws(() => prepararResena(valor, 'Experiencia.'), /1 a 5/);
});
test('exige comentario y conserva el formulario original ante rechazos', () => {
  const formulario = { puntaje: 4, comentario: '   ' };
  assert.throws(() => prepararResena(formulario.puntaje, formulario.comentario), /comentario/);
  assert.deepEqual(formulario, { puntaje: 4, comentario: '   ' });
});
test('prepara puntaje elegido y comentario sin enviar actor ni importes', () => {
  assert.deepEqual(prepararResena(1, '  Una experiencia.  '), { puntaje: 1, comentario: 'Una experiencia.' });
  assert.deepEqual(prepararResena(5, 'Excelente.'), { puntaje: 5, comentario: 'Excelente.' });
});
