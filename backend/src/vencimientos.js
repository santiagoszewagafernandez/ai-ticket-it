// Comparte las mismas instancias en memoria que HTTP; no es un proceso separado.
export function iniciarVencimientos(compraService) {
  const timer = setInterval(() => {
    try { compraService.procesarVencimientos(); }
    catch (error) { console.error('No se pudieron procesar los vencimientos:', error); }
  }, 1000);
  timer.unref();
  return () => clearInterval(timer);
}
