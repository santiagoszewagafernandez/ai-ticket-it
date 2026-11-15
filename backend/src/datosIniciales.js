import { Usuario } from './domain/Usuario.js';
import { Categoria } from './domain/Categoria.js';
import { Evento } from './domain/Evento.js';
import { TipoEntrada } from './domain/TipoEntrada.js';
import { Compra } from './domain/Compra.js';
import { Resena } from './domain/Resena.js';

export function cargarDatosIniciales(repos, compraService, ahora) {
  const ana = repos.usuario.guardar(new Usuario({ id: 'ana', nombre: 'Ana Torres' }));
  const bruno = repos.usuario.guardar(new Usuario({ id: 'bruno', nombre: 'Bruno Díaz' }));
  const lucia = repos.usuario.guardar(new Usuario({ id: 'lucia', nombre: 'Lucía Producciones' }));
  const musica = repos.categoria.guardar(new Categoria({ id: 'musica', nombre: 'Música' }));
  const teatro = repos.categoria.guardar(new Categoria({ id: 'teatro', nombre: 'Teatro' }));
  const tecnologia = repos.categoria.guardar(new Categoria({ id: 'tecnologia', nombre: 'Tecnología' }));
  const dia = 86400000;
  // Mismos identificadores y desplazamientos desde el arranque, siempre temporalmente coherentes.
  const evento = (id, titulo, descripcion, categoria, organizador, dias, lugar) => repos.evento.guardar(new Evento({
    id, titulo, descripcion, categoria, organizador, lugar,
    inicio: new Date(ahora.getTime() + dias * dia), fin: new Date(ahora.getTime() + dias * dia + 3 * 3600000),
    multimedia: [{ tipo: 'imagen', url: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1000&q=80' }],
  }));
  const tipo = (id, evento, nombre, precioCentavos, cupo, descripcion) => repos.tipoEntrada.guardar(new TipoEntrada({
    id, eventoId: evento.id, nombre, precioCentavos, cupo, descripcion,
  }));
  const indie = evento('noche-indie', 'Noche indie en Buenos Aires', 'Bandas en vivo y nuevas canciones en una noche para compartir.', musica, lucia, 1, 'Sala Río · Palermo');
  tipo('indie-general', indie, 'General', 1250000, 8, 'Acceso al salón principal, sin ubicación asignada.');
  tipo('indie-vip', indie, 'VIP', 2000000, 3, 'Sector elevado con vista al escenario.');
  const escena = evento('teatro', 'Una noche en escena', 'Una comedia sobre encuentros inesperados. Función de teatro independiente.', teatro, bruno, 3, 'Teatro del Sur · San Telmo');
  tipo('teatro-platea', escena, 'Platea', 800000, 6, 'Butaca en la sala principal.');
  const jazz = evento('jazz', 'Jazz bajo las estrellas', 'Un cuarteto de jazz y un repertorio acústico al aire libre.', musica, lucia, 5, 'Patio Norte · Belgrano');
  const jazzGeneral = tipo('jazz-general', jazz, 'General', 900000, 2, 'Sector general.');
  tipo('jazz-mesa', jazz, 'Mesa', 1800000, 4, 'Ubicación junto al escenario.');
  const encuentro = evento('encuentro', 'Ideas que conectan', 'Encuentro de tecnología y diseño con charlas y experiencias locales.', tecnologia, bruno, 7, 'Espacio Abierto · Chacarita');
  tipo('encuentro-general', encuentro, 'General', 0, 10, 'Acceso gratuito, con reserva y confirmación.');
  const agotado = evento('acustico', 'Acústico íntimo', 'Una sesión de música para un público pequeño.', musica, lucia, 2, 'Estudio Central · Almagro');
  const acustico = tipo('acustico-general', agotado, 'General', 600000, 2, 'Acceso único al estudio.');
  const anterior = evento('sesion-anterior', 'Sesión del río · edición anterior', 'Edición histórica de música en vivo.', musica, lucia, -7, 'Sala Río · Palermo');
  const historico = tipo('anterior-general', anterior, 'General', 1000000, 10, 'Acceso de la edición anterior.');
  function compraPagada(id, comprador, evento, tipoEntrada, cantidad, fecha) {
    const compra = new Compra({ id, comprador, evento, tipoEntrada, cantidad, creacion: fecha });
    tipoEntrada.reservar(cantidad);
    compra.pagar(new Date(fecha.getTime() + 60000));
    compraService.guardar(compra);
    return compra;
  }
  // Estas ventas justifican el agotamiento; no se inventa disponibilidad incompatible con las compras.
  compraPagada('demo-jazz', bruno, jazz, jazzGeneral, 2, new Date(ahora.getTime() - 3600000));
  compraPagada('demo-agotada', bruno, agotado, acustico, 2, new Date(ahora.getTime() - 3600000));
  for (const [indice, comprador, puntaje, comentario] of [
    [1, ana, 5, 'Muy buen sonido y una organización cercana.'],
    [2, bruno, 4, 'Disfruté la selección de bandas y el espacio.'],
  ]) {
    const compra = compraPagada(`demo-historica-${indice}`, comprador, anterior, historico, 1, new Date(anterior.inicio.getTime() - dia));
    compra.confirmarIngreso(compra.entradas[0].id, anterior.inicio, lucia.id);
    compraService.guardar(compra);
    repos.resena.guardar(new Resena({
      id: `resena-${indice}`, comprador, evento: anterior, puntaje, comentario,
      compras: [compra],
      fecha: new Date(anterior.fin.getTime() + 3600000),
    }));
  }
  // Demo de reseña sin publicar: compras/pago antes del inicio y uso durante el evento pasado.
  // Una usada y otra sin usar conservan CONFIRMADA; la segunda compra comparte elegibilidad.
  const taller = evento('taller-anterior', 'Diseño en comunidad · edición anterior', 'Encuentro histórico para compartir experiencias de diseño.', tecnologia, bruno, -2, 'Espacio Abierto');
  const tallerGeneral = tipo('taller-general', taller, 'General', 500000, 6, 'Acceso al encuentro.');
  const asistio = compraPagada('demo-resena-pendiente', ana, taller, tallerGeneral, 2, new Date(taller.inicio.getTime() - dia));
  asistio.confirmarIngreso(asistio.entradas[0].id, taller.inicio, bruno.id);
  compraService.guardar(asistio);
  compraPagada('demo-resena-otra-compra', ana, taller, tallerGeneral, 1, new Date(taller.inicio.getTime() - dia + 120000));
}
