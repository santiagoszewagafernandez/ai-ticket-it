/** @typedef {{nombre: string, descripcion: string, precio: string, cupo: string}} TipoFormulario */
/** @typedef {{titulo: string, descripcion: string, lugar: string, categoriaId: string, inicioFecha: string, inicioHora: string, finFecha: string, finHora: string, multimedia: {tipo: string, url: string}[], tiposEntrada: TipoFormulario[]}} FormularioEvento */

/** @returns {TipoFormulario} */
export const tipoVacio = () => ({ nombre: '', descripcion: '', precio: '', cupo: '' });
/** @returns {FormularioEvento} */
export const formularioVacio = () => ({ titulo: '', descripcion: '', lugar: '', categoriaId: '', inicioFecha: '', inicioHora: '', finFecha: '', finHora: '', multimedia: [], tiposEntrada: [tipoVacio()] });

/** @param {string} valor @param {string} nombre */
function requerido(valor, nombre) {
  if (!valor.trim()) throw new Error(`Completá ${nombre}.`);
  return valor.trim();
}

/** @param {string} dia @param {string} hora @param {string} nombre */
export function fechaFormulario(dia, hora, nombre) {
  const partes = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dia.trim());
  if (!partes || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora.trim())) throw new Error(`${nombre}: usá DD/MM/AAAA y HH:mm (24 horas).`);
  const [, d, m, a] = partes;
  const local = `${a}-${m}-${d}T${hora.trim()}:00`;
  const fecha = new Date(`${local}-03:00`);
  if (!Number.isFinite(fecha.getTime()) || new Date(fecha.getTime() - 3 * 3600000).toISOString().slice(0, 19) !== local) throw new Error(`${nombre}: la fecha no existe.`);
  return fecha.toISOString();
}

/** @param {FormularioEvento} formulario */
export function datosEvento(formulario) {
  const titulo = requerido(formulario.titulo, 'el título');
  const descripcion = requerido(formulario.descripcion, 'la descripción');
  const categoriaId = requerido(formulario.categoriaId, 'la categoría');
  const inicio = fechaFormulario(formulario.inicioFecha, formulario.inicioHora, 'Inicio');
  const fin = fechaFormulario(formulario.finFecha, formulario.finHora, 'Fin');
  if (fin <= inicio) throw new Error('El fin debe ser posterior al inicio.');
  const multimedia = formulario.multimedia.map((medio, i) => {
    const url = requerido(medio.url, `la URL ${i + 1}, o quitá ese medio`);
    let direccion;
    try { direccion = new URL(url); } catch { /* Se muestra ayuda en el formulario. */ }
    if (!direccion || !['http:', 'https:'].includes(direccion.protocol) || direccion.username || direccion.password) throw new Error(`La URL ${i + 1} debe ser HTTP o HTTPS sin credenciales.`);
    return { tipo: medio.tipo, url };
  });
  return { titulo, descripcion, categoriaId, inicio, fin, multimedia, lugar: formulario.lugar.trim() };
}

/** @param {FormularioEvento} formulario @param {string} organizadorId @returns {import('../api/tipos').AltaEvento} */
export function altaEvento(formulario, organizadorId) {
  const datos = datosEvento(formulario);
  if (!formulario.tiposEntrada.length) throw new Error('Agregá al menos un tipo de entrada.');
  const tiposEntrada = formulario.tiposEntrada.map((tipo, i) => {
    const nombre = requerido(tipo.nombre, `el nombre del tipo ${i + 1}`);
    const descripcion = requerido(tipo.descripcion, `la descripción del tipo ${i + 1}`);
    if (!/^\d+([.,]\d{1,2})?$/.test(tipo.precio.trim())) throw new Error(`Tipo ${i + 1}: ingresá un precio en pesos, con hasta dos decimales.`);
    const [pesos, fraccion = ''] = tipo.precio.trim().replace(',', '.').split('.');
    const precioCentavos = Number(pesos) * 100 + Number(fraccion.padEnd(2, '0'));
    const cupo = Number(tipo.cupo.trim());
    if (!Number.isSafeInteger(precioCentavos)) throw new Error(`Tipo ${i + 1}: el precio es demasiado grande.`);
    if (!/^\d+$/.test(tipo.cupo.trim()) || !Number.isSafeInteger(cupo)) throw new Error(`Tipo ${i + 1}: el cupo debe ser un entero no negativo.`);
    return { nombre, descripcion, precioCentavos, cupo };
  });
  return { ...datos, organizadorId, tiposEntrada };
}
