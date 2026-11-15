import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { crearContexto } from '../src/composicion.js';
import { crearAplicacion } from '../src/app.js';

const INICIO = new Date('2026-11-13T19:59:00Z');
const foto = (repos) => JSON.stringify(Object.fromEntries(Object.entries(repos).map(([nombre, repo]) => [nombre, repo.todos()])));
const datos = { compradorId: 'ana', eventoId: 'noche-indie', tipoEntradaId: 'indie-general', cantidad: 3 };
function preparar({ pagada = true, gratuita = false } = {}) {
  let ahora = new Date(INICIO);
  const contexto = crearContexto(() => new Date(ahora));
  contexto.repos.evento.buscarPorId('noche-indie').inicio = new Date('2026-11-13T21:00:00Z');
  if (gratuita) contexto.repos.tipoEntrada.buscarPorId('indie-general').precioCentavos = 0;
  const dto = contexto.servicios.compra.crear(datos, 'ana');
  if (pagada) contexto.servicios.compra.pagar(dto.id, 'ana');
  const compra = contexto.repos.compra.buscarPorId(dto.id);
  return { ...contexto, compra, ids: compra.entradas.map((entrada) => entrada.id),
    fijarHora: (iso) => { ahora = new Date(iso); } };
}

describe('Cancelación: dominio, coordinación y efectos únicos', () => {
  test('parcial pagada conserva pago/precio/fecha, reembolsa lo elegido y no inventa transición', () => {
    const { servicios, repos, compra, ids } = preparar();
    const pago = compra.pago;
    repos.tipoEntrada.buscarPorId('indie-general').precioCentavos = 9900000;
    const resultado = servicios.compra.cancelar(compra.id, [ids[0]], 'ana');
    assert.equal(resultado.estado, 'CONFIRMADA');
    assert.equal(resultado.totalCentavos, 3750000);
    assert.equal(resultado.importeReembolsadoCentavos, 1250000);
    assert.equal(resultado.importeNetoCentavos, 2500000);
    assert.equal(resultado.cantidadActiva, 2);
    assert.equal(resultado.cantidadCancelada, 1);
    assert.equal(compra.pago, pago);
    assert.equal(pago.importeCentavos, 3750000);
    assert.equal(pago.fecha.toISOString(), INICIO.toISOString());
    assert.equal(resultado.historial.length, 2);
    assert.equal(repos.tipoEntrada.buscarPorId('indie-general').disponibles, 6);
    assert.equal(repos.entrada.buscarPorId(ids[0]), compra.entradas[0]);
    assert.equal(repos.entrada.buscarPorId(ids[0]).estado, 'CANCELADA');
  });

  test('antes de pagar libera sin dinero; paga solo restantes y luego reembolsa solo las pagadas', () => {
    const { servicios, repos, compra, ids } = preparar({ pagada: false });
    const cancelada = servicios.compra.cancelar(compra.id, [ids[0]], 'ana');
    assert.equal(cancelada.estado, 'PENDIENTE');
    assert.equal(cancelada.importeAPagarCentavos, 2500000);
    assert.equal(cancelada.importeReembolsadoCentavos, 0);
    assert.equal(cancelada.importeNetoCentavos, 0);
    assert.equal(cancelada.historial.length, 1);
    assert.equal(cancelada.pago, null);
    const pagada = servicios.compra.pagar(compra.id, 'ana');
    assert.equal(pagada.pago.importeCentavos, 2500000);
    assert.deepEqual(pagada.pago.entradaIds, ids.slice(1));
    const parcial = servicios.compra.cancelar(compra.id, [ids[1]], 'ana');
    assert.equal(parcial.importeReembolsadoCentavos, 1250000);
    const completa = servicios.compra.cancelar(compra.id, [ids[2]], 'ana');
    assert.equal(completa.estado, 'REEMBOLSADA');
    assert.equal(completa.importeReembolsadoCentavos, 2500000);
    assert.equal(completa.importeNetoCentavos, 0);
    assert.deepEqual(completa.pago, pagada.pago);
    assert.equal(repos.tipoEntrada.buscarPorId('indie-general').disponibles, 8);
    assert.deepEqual(completa.historial.map((cambio) => cambio.estado), ['PENDIENTE', 'CONFIRMADA', 'REEMBOLSADA']);
  });

  for (const pagada of [false, true]) {
    test(`cancelación total ${pagada ? 'pagada' : 'sin pago'} y repetición sin ningún efecto`, () => {
      const { servicios, repos, compra, ids, fijarHora } = preparar({ pagada });
      const completa = servicios.compra.cancelar(compra.id, ids, 'ana');
      assert.equal(completa.estado, pagada ? 'REEMBOLSADA' : 'CANCELADA');
      assert.equal(completa.puedePagar, false);
      assert.equal(completa.puedeCancelar, false);
      assert.equal(completa.historial.at(-1).motivo, 'CANCELACION_COMPRADOR');
      assert.equal(completa.historial.at(-1).actor, 'ana');
      assert.equal(completa.historial.length, pagada ? 3 : 2);
      const antes = foto(repos);
      assert.throws(() => servicios.compra.cancelar(compra.id, ids, 'ana'), { code: 'TICKET_NOT_CANCELABLE' });
      assert.equal(foto(repos), antes);
      if (pagada) {
        fijarHora('2026-11-15T22:00:00Z');
        assert.deepEqual(servicios.compra.pagar(compra.id, 'ana').pago, completa.pago);
        assert.equal(compra.estado, 'REEMBOLSADA');
        assert.equal(foto(repos), antes);
      } else {
        assert.throws(() => servicios.compra.pagar(compra.id, 'ana'), { code: 'PURCHASE_NOT_PAYABLE' });
        fijarHora('2026-11-13T20:04:00Z');
        servicios.compra.procesarVencimientos();
        assert.equal(foto(repos), antes);
        assert.equal(servicios.compra.detalle(compra.id, 'ana').vencida, false);
      }
    });
  }

  for (const [hora, permitida] of [['19:59:59.999', true], ['20:00:00.000', true], ['20:00:00.001', false]]) {
    test(`evento 21:00, cancelación ${hora}: ${permitida ? 'admitida' : 'rechazada'} con reloj controlado`, () => {
      const { servicios, repos, compra, ids, fijarHora } = preparar();
      fijarHora(`2026-11-13T${hora}Z`);
      const antes = foto(repos);
      if (permitida) assert.equal(servicios.compra.cancelar(compra.id, [ids[0]], 'ana').cantidadCancelada, 1);
      else {
        assert.throws(() => servicios.compra.cancelar(compra.id, [ids[0]], 'ana'), { code: 'CANCELLATION_DEADLINE' });
        assert.equal(foto(repos), antes);
        assert.equal(servicios.compra.detalle(compra.id, 'ana').puedeCancelar, false);
      }
    });
  }

  for (const [nombre, prepararInvalida, code] of [
    ['inexistente', () => 'inexistente', 'TICKET_PURCHASE_MISMATCH'],
    ['de otra compra', ({ servicios }) => servicios.compra.crear({ ...datos, cantidad: 1 }, 'ana').entradas[0].id, 'TICKET_PURCHASE_MISMATCH'],
    ['utilizada', ({ compra, ids }) => { compra.entradas[1].estado = 'UTILIZADA'; return ids[1]; }, 'TICKET_NOT_CANCELABLE'],
    ['ya cancelada', ({ servicios, compra, ids }) => { servicios.compra.cancelar(compra.id, [ids[1]], 'ana'); return ids[1]; }, 'TICKET_NOT_CANCELABLE'],
  ]) {
    test(`selección mixta con ${nombre} rechaza todo sin tocar ningún repositorio`, () => {
      const contexto = preparar();
      const invalida = prepararInvalida(contexto);
      const antes = foto(contexto.repos);
      assert.throws(() => contexto.servicios.compra.cancelar(contexto.compra.id, [contexto.ids[0], invalida], 'ana'), { code });
      assert.equal(foto(contexto.repos), antes);
    });
  }

  for (const seleccion of [undefined, null, [], 'entrada', [null], [''], [' '], [42], ['repetida', 'repetida']]) {
    test(`rechaza selección mal formada ${JSON.stringify(seleccion)} sin cambios`, () => {
      const { servicios, repos, compra } = preparar();
      const antes = foto(repos);
      assert.throws(() => servicios.compra.cancelar(compra.id, seleccion, 'ana'), { code: 'INVALID_DATA' });
      assert.equal(foto(repos), antes);
    });
  }

  for (const [actor, code] of [[undefined, 'IDENTITY_REQUIRED'], ['nadie', 'NOT_FOUND'], ['bruno', 'FORBIDDEN'], ['lucia', 'FORBIDDEN']]) {
    test(`actor ${actor}: ${code}, también rechaza al organizador`, () => {
      const { servicios, repos, compra, ids } = preparar();
      const antes = foto(repos);
      assert.throws(() => servicios.compra.cancelar(compra.id, [ids[0]], actor), { code });
      assert.equal(foto(repos), antes);
    });
  }

  test('Compra y Entrada protegen sus reglas aun sin pasar por servicio ni HTTP', () => {
    const { compra, ids } = preparar();
    compra.entradas[1].estado = 'UTILIZADA';
    const antes = JSON.stringify(compra);
    assert.throws(() => compra.cancelar([ids[0], ids[1]], INICIO), { code: 'TICKET_NOT_CANCELABLE' });
    assert.throws(() => compra.entradas[1].cancelar(), { code: 'TICKET_NOT_CANCELABLE' });
    assert.equal(JSON.stringify(compra), antes);
  });

  test('una utilizada, una cancelada y una sin usar confirma; dos utilizadas y una cancelada utiliza', () => {
    const { servicios, compra, ids } = preparar();
    // Fixture de asistencia coherente con pago aprobado, sin publicar el bloque de ingreso.
    compra.entradas[0].estado = 'UTILIZADA';
    servicios.compra.cancelar(compra.id, [ids[1]], 'ana');
    assert.equal(compra.estado, 'CONFIRMADA');
    assert.equal(compra.historial.length, 2);
    compra.entradas[2].estado = 'UTILIZADA';
    compra.registrarCambio(INICIO, 'lucia', 'ASISTENCIA_DE_PRUEBA');
    assert.equal(compra.estado, 'UTILIZADA');
    assert.equal(compra.historial.length, 3);
  });

  test('cancelar la última sin usar entre otras utilizadas registra UTILIZADA, sin exigir toda la compra sin uso', () => {
    const { servicios, compra, ids } = preparar();
    compra.entradas[0].estado = 'UTILIZADA';
    compra.entradas[1].estado = 'UTILIZADA';
    const dto = servicios.compra.cancelar(compra.id, [ids[2]], 'ana');
    assert.equal(dto.estado, 'UTILIZADA');
    assert.equal(dto.historial.at(-1).estado, 'UTILIZADA');
    assert.equal(dto.importeReembolsadoCentavos, 1250000);
  });

  test('vencimiento posterior a cancelación parcial devuelve solo restantes, sin dinero', () => {
    const { servicios, repos, compra, ids, fijarHora } = preparar({ pagada: false });
    servicios.compra.cancelar(compra.id, [ids[0]], 'ana');
    fijarHora('2026-11-13T20:04:00Z');
    servicios.compra.procesarVencimientos();
    const antes = foto(repos);
    servicios.compra.procesarVencimientos();
    assert.equal(foto(repos), antes);
    assert.equal(compra.estado, 'CANCELADA');
    assert.equal(compra.importeReembolsadoCentavos, 0);
    assert.equal(repos.tipoEntrada.buscarPorId('indie-general').disponibles, 8);
    assert.deepEqual(compra.historial.map((cambio) => cambio.motivo), ['RESERVA', 'VENCIMIENTO']);
    assert.throws(() => servicios.compra.cancelar(compra.id, [ids[1]], 'ana'), { code: 'TICKET_NOT_CANCELABLE' });
    assert.equal(foto(repos), antes);
  });

  test('compra gratuita pagada termina REEMBOLSADA con cero dinero y cupo repuesto', () => {
    const { servicios, repos, compra, ids } = preparar({ gratuita: true });
    const dto = servicios.compra.cancelar(compra.id, ids, 'ana');
    assert.equal(dto.estado, 'REEMBOLSADA');
    assert.equal(dto.importeReembolsadoCentavos, 0);
    assert.equal(dto.importeNetoCentavos, 0);
    assert.equal(repos.tipoEntrada.buscarPorId('indie-general').disponibles, 8);
  });

  test('prevalida cupo antes de cancelar ante una inconsistencia interna', () => {
    const { servicios, repos, compra, ids } = preparar();
    compra.tipoEntrada.disponibles = compra.tipoEntrada.cupo; // Falla de invariante simulada.
    const antes = foto(repos);
    assert.throws(() => servicios.compra.cancelar(compra.id, [ids[0]], 'ana'), { code: 'CAPACITY_INVARIANT' });
    assert.equal(foto(repos), antes);
  });
});

test('HTTP cancelaciones: permisos, atomicidad, concurrencia, pagos y vistas coherentes', async (t) => {
  let ahora = new Date(INICIO);
  const app = crearAplicacion({ reloj: () => new Date(ahora) });
  const { repos } = app.locals.contexto;
  repos.evento.buscarPorId('noche-indie').inicio = new Date('2026-11-13T21:00:00Z');
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  async function pedir(path, { method = 'GET', body, actor = 'ana' } = {}) {
    const response = await fetch(`${base}${path}`, { method,
      headers: { 'Content-Type': 'application/json', ...(actor ? { 'X-Usuario-Id': actor } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, datos: await response.json() };
  }
  const compra = (await pedir('/compras', { method: 'POST', body: datos })).datos;
  const url = `/compras/${compra.id}`;
  const ids = compra.entradas.map((entrada) => entrada.id);
  const pago = (await pedir(`${url}/pago`, { method: 'POST' })).datos.pago;
  const cancelar = (entradaIds, actor) => pedir(`${url}/cancelaciones`, { method: 'POST', body: { entradaIds }, actor });

  await t.test('401/403/404/400 y selección mixta no alteran memoria', async () => {
    const antes = foto(repos);
    assert.equal((await cancelar([ids[0]], null)).status, 401);
    assert.equal((await cancelar([ids[0]], 'lucia')).status, 403);
    assert.equal((await cancelar([ids[0]], 'bruno')).status, 403);
    assert.equal((await pedir('/compras/ausente/cancelaciones', { method: 'POST', body: { entradaIds: ids } })).status, 404);
    assert.equal((await cancelar([ids[0], 'ajena'])).datos.error.code, 'TICKET_PURCHASE_MISMATCH');
    for (const body of [{}, { entradaIds: [] }, { entradaIds: [ids[0], ids[0]] }, { entradaIds: [4] }, []]) {
      assert.equal((await pedir(`${url}/cancelaciones`, { method: 'POST', body })).status, 400);
    }
    assert.equal(foto(repos), antes);
  });

  await t.test('dos cancelaciones concurrentes de la misma entrada devuelven 200/409 y un único efecto', async () => {
    const resultados = await Promise.all([cancelar([ids[0]]), cancelar([ids[0]])]);
    assert.deepEqual(resultados.map((r) => r.status).sort(), [200, 409]);
    assert.equal(resultados.find((r) => r.status === 409).datos.error.code, 'TICKET_NOT_CANCELABLE');
    const actual = (await pedir(url)).datos;
    assert.equal(actual.importeReembolsadoCentavos, 1250000);
    assert.equal(actual.historial.length, 2);
    assert.equal(repos.tipoEntrada.buscarPorId('indie-general').disponibles, 6);
    assert.deepEqual(actual.pago, pago);
    const antes = foto(repos);
    assert.equal((await cancelar([ids[1], ids[0]])).status, 409);
    assert.equal(foto(repos), antes);
  });

  await t.test('comprador y organizador observan mismos importes/estados/entradas/cupos y filtros', async () => {
    const actual = (await pedir(url)).datos;
    const listado = (await pedir('/compras?compradorId=ana&estado=CONFIRMADA')).datos.find((c) => c.id === compra.id);
    const gestion = (await pedir('/eventos/noche-indie/compras?estado=CONFIRMADA', { actor: 'lucia' })).datos.find((c) => c.id === compra.id);
    assert.deepEqual(listado, actual);
    assert.deepEqual(gestion, actual);
    assert.deepEqual((await pedir(`${url}/entradas`, { actor: 'lucia' })).datos, actual.entradas);
    assert.deepEqual((await pedir(`${url}/historial`, { actor: 'lucia' })).datos, actual.historial);
    assert.equal((await pedir('/eventos/noche-indie/tipos-entrada')).datos[0].disponibles, 6);
    assert.deepEqual((await pedir(`${url}/pago`, { method: 'POST' })).datos.pago, pago);
  });

  await t.test('cancelación antes del pago cobra restantes; cancelación total pasa al filtro REEMBOLSADA', async () => {
    const reserva = (await pedir('/compras', { method: 'POST', body: { ...datos, cantidad: 2 } })).datos;
    const ruta = `/compras/${reserva.id}`;
    const parcial = await pedir(`${ruta}/cancelaciones`, { method: 'POST', body: { entradaIds: [reserva.entradas[0].id] } });
    assert.equal(parcial.status, 200);
    assert.equal(parcial.datos.pago, null);
    assert.equal(parcial.datos.importeReembolsadoCentavos, 0);
    assert.equal((await pedir(`${ruta}/pago`, { method: 'POST' })).datos.pago.importeCentavos, 1250000);
    assert.equal((await cancelar(ids.slice(1))).datos.estado, 'REEMBOLSADA');
    const filtrada = (await pedir('/eventos/noche-indie/compras?estado=REEMBOLSADA', { actor: 'lucia' })).datos;
    assert.equal(filtrada[0].id, compra.id);
    assert.equal(filtrada[0].importeNetoCentavos, 0);
    assert.deepEqual(filtrada[0].pago, pago);
  });

  await t.test('HTTP acepta el límite exacto y rechaza un milisegundo después sin efectos', async () => {
    const reserva = (await pedir('/compras', { method: 'POST', body: { ...datos, cantidad: 2 } })).datos;
    await pedir(`/compras/${reserva.id}/pago`, { method: 'POST' });
    const ruta = `/compras/${reserva.id}/cancelaciones`;
    ahora = new Date('2026-11-13T20:00:00.000Z');
    assert.equal((await pedir(ruta, { method: 'POST', body: { entradaIds: [reserva.entradas[0].id] } })).status, 200);
    ahora = new Date('2026-11-13T20:00:00.001Z');
    const antes = foto(repos);
    const rechazo = await pedir(ruta, { method: 'POST', body: { entradaIds: [reserva.entradas[1].id] } });
    assert.equal(rechazo.status, 409);
    assert.equal(rechazo.datos.error.code, 'CANCELLATION_DEADLINE');
    assert.equal(foto(repos), antes);
  });
});
