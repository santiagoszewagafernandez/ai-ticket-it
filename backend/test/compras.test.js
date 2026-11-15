import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { crearContexto } from '../src/composicion.js';
import { tiempoEvento } from '../src/services/tiempo.js';
import { iniciarVencimientos } from '../src/vencimientos.js';

const INICIO = new Date('2026-11-13T20:00:00.000Z');
function preparar() {
  let ahora = new Date(INICIO);
  const contexto = crearContexto(() => new Date(ahora));
  return { ...contexto, avanzar: (ms) => { ahora = new Date(INICIO.getTime() + ms); } };
}
const datos = (extra = {}) => ({ compradorId: 'ana', eventoId: 'noche-indie', tipoEntradaId: 'indie-general', cantidad: 2, ...extra });

describe('Reservas, pago y vencimiento con reloj controlado', () => {
  test('el temporizador del backend libera sin consultas y detiene su ejecución al cerrar', (t) => {
    t.mock.timers.enable({ apis: ['setInterval'] });
    const { servicios, repos, avanzar } = preparar();
    servicios.compra.crear(datos(), 'ana');
    const detener = iniciarVencimientos(servicios.compra);
    avanzar(300000);
    assert.equal(repos.tipoEntrada.buscarPorId('indie-general').disponibles, 6);
    t.mock.timers.tick(1000);
    assert.equal(repos.tipoEntrada.buscarPorId('indie-general').disponibles, 8);
    t.mock.timers.tick(1000);
    assert.equal(repos.tipoEntrada.buscarPorId('indie-general').disponibles, 8);
    detener();
    const siguiente = servicios.compra.crear(datos(), 'ana');
    avanzar(600000);
    t.mock.timers.tick(1000);
    assert.equal(repos.compra.buscarPorId(siguiente.id).estado, 'PENDIENTE');
  });
  test('reserva todo el cupo; rechaza sobrecupo sin entradas ni compras huérfanas', () => {
    const { servicios, repos } = preparar();
    const comprasAntes = repos.compra.todos().length;
    const entradasAntes = repos.entrada.todos().length;
    assert.throws(() => servicios.compra.crear(datos({ cantidad: 9 }), 'ana'), { code: 'INSUFFICIENT_CAPACITY' });
    assert.equal(repos.compra.todos().length, comprasAntes);
    assert.equal(repos.entrada.todos().length, entradasAntes);
    assert.equal(repos.tipoEntrada.buscarPorId('indie-general').disponibles, 8);
    const compra = servicios.compra.crear(datos({ cantidad: 8 }), 'ana');
    assert.equal(compra.entradas.length, 8);
    assert.equal(compra.estado, 'PENDIENTE');
    assert.equal(repos.tipoEntrada.buscarPorId('indie-general').disponibles, 0);
    assert.equal(compra.vencimiento, '2026-11-13T20:05:00.000Z');
  });

  for (const cantidad of [0, -1, 1.5, '2', null, undefined, Number.MAX_SAFE_INTEGER + 1]) {
    test(`rechaza cantidad ${String(cantidad)} sin efectos`, () => {
      const { servicios, repos } = preparar();
      const antes = [repos.compra.todos().length, repos.entrada.todos().length, repos.cambio.todos().length];
      assert.throws(() => servicios.compra.crear(datos({ cantidad }), 'ana'), { code: 'INVALID_DATA' });
      assert.deepEqual([repos.compra.todos().length, repos.entrada.todos().length, repos.cambio.todos().length], antes);
      assert.equal(repos.tipoEntrada.buscarPorId('indie-general').disponibles, 8);
    });
  }

  for (const [extra, actor, code] of [
    [{ tipoEntradaId: 'teatro-platea' }, 'ana', 'TYPE_EVENT_MISMATCH'],
    [{ eventoId: 'ausente' }, 'ana', 'NOT_FOUND'],
    [{ tipoEntradaId: 'ausente' }, 'ana', 'NOT_FOUND'],
    [{}, 'ausente', 'NOT_FOUND'], [{}, undefined, 'IDENTITY_REQUIRED'], [{}, 'bruno', 'FORBIDDEN'],
  ]) {
    test(`rechaza ${JSON.stringify(extra)} con actor ${actor}: ${code}`, () => {
      const { servicios, repos } = preparar();
      const antes = repos.compra.todos().length;
      assert.throws(() => servicios.compra.crear(datos(extra), actor), { code });
      assert.equal(repos.compra.todos().length, antes);
      assert.equal(repos.tipoEntrada.buscarPorId('indie-general').disponibles, 8);
    });
  }

  test('fija el precio en el backend y paga sin volver a descontar cupo', () => {
    const { servicios, repos } = preparar();
    const compra = servicios.compra.crear(datos({ precioUnitarioCentavos: 1, totalCentavos: 1 }), 'ana');
    repos.tipoEntrada.buscarPorId('indie-general').precioCentavos = 9900000;
    const pagada = servicios.compra.pagar(compra.id, 'ana');
    assert.equal(pagada.precioUnitarioCentavos, 1250000);
    assert.equal(pagada.pago.importeCentavos, 2500000);
    assert.equal(pagada.estado, 'CONFIRMADA');
    assert.equal(repos.tipoEntrada.buscarPorId('indie-general').disponibles, 6);
    assert.deepEqual(pagada.historial.map((c) => c.estado), ['PENDIENTE', 'CONFIRMADA']);
  });

  test('paga un milisegundo antes del vencimiento y nunca expira la compra pagada', () => {
    const { servicios, repos, avanzar } = preparar();
    const compra = servicios.compra.crear(datos(), 'ana');
    avanzar(299999);
    servicios.compra.pagar(compra.id, 'ana');
    avanzar(86400000 * 10);
    servicios.compra.procesarVencimientos();
    assert.equal(servicios.compra.detalle(compra.id, 'ana').estado, 'CONFIRMADA');
    assert.equal(repos.tipoEntrada.buscarPorId('indie-general').disponibles, 6);
  });

  for (const ms of [300000, 300001]) {
    test(`al vencimiento + ${ms - 300000} ms rechaza pago y libera una sola vez`, () => {
      const { servicios, repos, avanzar } = preparar();
      const compra = servicios.compra.crear(datos(), 'ana');
      avanzar(ms);
      servicios.compra.procesarVencimientos();
      servicios.compra.procesarVencimientos();
      assert.throws(() => servicios.compra.pagar(compra.id, 'ana'), { code: 'RESERVATION_EXPIRED' });
      const cancelada = servicios.compra.detalle(compra.id, 'ana');
      assert.equal(cancelada.estado, 'CANCELADA');
      assert.ok(cancelada.entradas.every((e) => e.estado === 'CANCELADA'));
      assert.equal(repos.tipoEntrada.buscarPorId('indie-general').disponibles, 8);
      assert.equal(cancelada.historial.length, 2);
      assert.equal(cancelada.historial[1].actor, 'SISTEMA');
      assert.equal(cancelada.historial[1].fecha, compra.vencimiento);
    });
  }

  test('inicio cercano acorta el vencimiento y cierra nuevas reservas y pagos', () => {
    const { servicios, repos, avanzar } = preparar();
    const evento = repos.evento.buscarPorId('noche-indie');
    evento.inicio = new Date(INICIO.getTime() + 60000);
    const compra = servicios.compra.crear(datos(), 'ana');
    assert.equal(compra.vencimiento, evento.inicio.toISOString());
    avanzar(60000);
    servicios.compra.procesarVencimientos();
    assert.throws(() => servicios.compra.pagar(compra.id, 'ana'), { code: 'RESERVATION_EXPIRED' });
    assert.throws(() => servicios.compra.crear(datos(), 'ana'), { code: 'EVENT_STARTED' });
    assert.equal(repos.tipoEntrada.buscarPorId('indie-general').disponibles, 8);
  });

  test('reintentar pago conserva importe, fecha, id e historial incluso tras inicio y uso', () => {
    const { servicios, repos, avanzar } = preparar();
    const dto = servicios.compra.crear(datos(), 'ana');
    const primero = servicios.compra.pagar(dto.id, 'ana');
    assert.deepEqual(servicios.compra.pagar(dto.id, 'ana').pago, primero.pago);
    const compra = repos.compra.buscarPorId(dto.id);
    compra.entradas.forEach((e) => { e.estado = 'UTILIZADA'; });
    compra.registrarCambio(new Date(INICIO.getTime() + 86400000), 'lucia', 'ASISTENCIA_DE_PRUEBA');
    servicios.compra.guardar(compra);
    avanzar(86400000 * 2);
    const reintento = servicios.compra.pagar(dto.id, 'ana');
    assert.equal(reintento.estado, 'UTILIZADA');
    assert.deepEqual(reintento.pago, primero.pago);
    assert.equal(reintento.historial.length, 3);
    assert.equal(repos.tipoEntrada.buscarPorId('indie-general').disponibles, 6);
  });

  test('Compra y EntradaRepository comparten las mismas instancias', () => {
    const { servicios, repos, avanzar } = preparar();
    const dto = servicios.compra.crear(datos(), 'ana');
    const compra = repos.compra.buscarPorId(dto.id);
    assert.equal(compra.entradas[0], repos.entrada.buscarPorId(dto.entradas[0].id));
    avanzar(300000);
    servicios.compra.procesarVencimientos();
    assert.equal(repos.entrada.buscarPorId(dto.entradas[0].id).estado, 'CANCELADA');
    assert.deepEqual(servicios.entrada.listar(dto.id, 'ana'), servicios.compra.detalle(dto.id, 'ana').entradas);
  });

  test('calcula estados mixtos y no inventa transiciones si el estado agregado no cambió', () => {
    const { servicios, repos } = preparar();
    const dto = servicios.compra.crear(datos({ cantidad: 3 }), 'ana');
    servicios.compra.pagar(dto.id, 'ana');
    const compra = repos.compra.buscarPorId(dto.id);
    compra.entradas[0].estado = 'UTILIZADA';
    compra.entradas[1].estado = 'CANCELADA';
    compra.registrarCambio(INICIO, 'ana', 'FIXTURE_PARCIAL');
    assert.equal(compra.estado, 'CONFIRMADA');
    assert.equal(compra.historial.length, 2);
    compra.entradas[2].estado = 'UTILIZADA';
    assert.equal(compra.estado, 'UTILIZADA');
    compra.entradas.forEach((e) => { e.estado = 'CANCELADA'; });
    compra.importeReembolsadoCentavos = compra.pago.importeCentavos;
    assert.equal(compra.estado, 'REEMBOLSADA');
    const pago = compra.pago;
    compra.pagar(INICIO);
    assert.equal(compra.pago, pago);
    assert.equal(compra.estado, 'REEMBOLSADA');
  });

  test('paga solo las entradas activas si el fixture contiene una cancelada antes de pagar', () => {
    const { servicios, repos } = preparar();
    const dto = servicios.compra.crear(datos({ cantidad: 3 }), 'ana');
    const compra = repos.compra.buscarPorId(dto.id);
    compra.entradas[0].estado = 'CANCELADA';
    compra.tipoEntrada.liberar(1);
    const pagada = servicios.compra.pagar(dto.id, 'ana');
    assert.equal(pagada.pago.importeCentavos, 2500000);
    assert.equal(pagada.pago.entradaIds.length, 2);
  });

  test('no mezcla compradores ni deja pagar una compra ajena', () => {
    const { servicios } = preparar();
    const compra = servicios.compra.crear(datos(), 'ana');
    assert.throws(() => servicios.compra.pagar(compra.id, 'bruno'), { code: 'FORBIDDEN' });
    assert.throws(() => servicios.compra.detalle(compra.id, 'bruno'), { code: 'FORBIDDEN' });
    assert.throws(() => servicios.compra.listar({ compradorId: 'ana' }, 'bruno'), { code: 'FORBIDDEN' });
    const pendientes = servicios.compra.listar({ compradorId: 'ana', estado: 'PENDIENTE' }, 'ana');
    assert.deepEqual(pendientes.map((c) => c.id), [compra.id]);
    assert.ok(servicios.compra.listar({ compradorId: 'bruno' }, 'bruno').every((c) => c.comprador.id === 'bruno'));
  });
});

describe('Catálogo, reputación y días calendario', () => {
  test('combina texto sin tildes y categoría; conserva agotados y excluye comenzados', () => {
    const { servicios } = preparar();
    assert.deepEqual(servicios.evento.listar({ texto: 'acustico', categoriaId: 'musica' }).map((e) => e.id), ['acustico', 'jazz']);
    assert.deepEqual(servicios.evento.listar({ texto: 'acustico', categoriaId: 'teatro' }), []);
    assert.equal(servicios.evento.listar({}).find((e) => e.id === 'acustico').agotado, true);
    assert.ok(!servicios.evento.listar({}).some((e) => e.id === 'sesion-anterior'));
    assert.equal(servicios.evento.detalle('sesion-anterior').tiempoEvento.etiqueta, 'Finalizado');
  });

  test('precio mínimo usa solo tipos con cupo, cero es precio válido y agotados quedan últimos', () => {
    const { servicios } = preparar();
    const lista = servicios.evento.listar({ orden: 'precio' });
    assert.equal(lista[0].id, 'encuentro');
    assert.equal(lista.at(-1).id, 'acustico');
    assert.equal(lista.find((e) => e.id === 'jazz').precioDesdeCentavos, 1800000);
    assert.deepEqual(lista.map((e) => e.id), ['encuentro', 'teatro', 'noche-indie', 'jazz', 'acustico']);
  });

  test('puntaje del organizador pondera cada reseña por igual y sin reseñas queda al final', () => {
    const { servicios, avanzar } = preparar();
    const evento = servicios.evento.crear({ organizadorId: 'lucia', titulo: 'Sesión para calificar', descripcion: 'Música en vivo.', categoriaId: 'musica',
      inicio: '2026-11-13T21:00:00Z', fin: '2026-11-13T22:00:00Z', tiposEntrada: [{ nombre: 'General', descripcion: 'Acceso.', precioCentavos: 100, cupo: 2 }] }, 'lucia');
    const compra = servicios.compra.crear({ compradorId: 'ana', eventoId: evento.id, tipoEntradaId: evento.tiposEntrada[0].id, cantidad: 1 }, 'ana');
    servicios.compra.pagar(compra.id, 'ana');
    avanzar(3600000);
    servicios.entrada.usar(compra.entradas[0].id, evento.id, 'lucia');
    avanzar(7200000);
    servicios.resena.crear(evento.id, { puntaje: 3, comentario: 'Buena experiencia.' }, 'ana');
    assert.deepEqual(servicios.resena.reputacion('lucia'), { puntaje: 4, cantidad: 3 });
    const lista = servicios.evento.listar({ orden: 'puntaje' });
    assert.equal(lista.at(-1).organizador.reputacion.puntaje, null);
    assert.ok(lista.slice(0, 3).every((e) => e.organizador.id === 'lucia'));
  });

  test('reseñas iniciales corresponden a evento finalizado con asistencia y pago', () => {
    const { repos } = preparar();
    for (const resena of repos.resena.todos()) {
      assert.ok(resena.fecha > resena.evento.fin);
      assert.ok(repos.compra.deComprador(resena.comprador.id).some((c) => c.evento.id === resena.evento.id && c.pago && c.entradas.some((e) => e.estado === 'UTILIZADA')));
    }
  });

  test('23:00 a 01:00 del día siguiente significa Mañana en Buenos Aires', () => {
    const { repos } = preparar();
    const evento = repos.evento.buscarPorId('noche-indie');
    evento.inicio = new Date('2026-11-14T01:00:00-03:00');
    evento.fin = new Date('2026-11-14T03:00:00-03:00');
    assert.deepEqual(tiempoEvento(evento, new Date('2026-11-13T23:00:00-03:00')), { situacion: 'PROXIMO', diasRestantes: 1, etiqueta: 'Mañana' });
    assert.equal(tiempoEvento(evento, new Date('2026-11-14T00:30:00-03:00')).etiqueta, 'Hoy');
    assert.deepEqual(tiempoEvento(evento, evento.inicio), { situacion: 'EN_CURSO', diasRestantes: null, etiqueta: 'En curso' });
    assert.equal(tiempoEvento(evento, evento.fin).etiqueta, 'Finalizado');
  });
});
