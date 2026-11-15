/** @param {string[]} seleccion @param {string} id */
export function alternarEntrada(seleccion, id) {
  return seleccion.includes(id) ? seleccion.filter((actual) => actual !== id) : [...seleccion, id];
}

/** Resumen orientativo; el backend vuelve a validar y calcula los importes definitivos.
 * @param {import('../api/tipos').Compra} compra @param {string[]} seleccion
 */
export function resumenCancelacion(compra, seleccion) {
  const entradas = seleccion.map((id) => compra.entradas.find((entrada) => entrada.id === id));
  return {
    cantidad: seleccion.length,
    invalida: entradas.some((entrada) => !entrada || entrada.estado !== 'SIN_UTILIZAR'),
    importeReembolsoCentavos: entradas.filter((entrada) => entrada?.estado === 'SIN_UTILIZAR'
      && compra.pago?.entradaIds.includes(entrada.id)).length * compra.precioUnitarioCentavos,
    importeLiberadoCentavos: entradas.filter((entrada) => entrada?.estado === 'SIN_UTILIZAR').length * compra.precioUnitarioCentavos,
  };
}
