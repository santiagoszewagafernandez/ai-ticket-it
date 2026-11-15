import { exigir } from '../domain/ErrorNegocio.js';
import { categoriaDTO, usuarioDTO } from './dto.js';
import { tiempoEvento, ZONA_HORARIA } from './tiempo.js';
import { randomUUID } from 'node:crypto';
import { Evento } from '../domain/Evento.js';
import { tipoDTO } from './dto.js';

function fechaUTC(valor) {
  exigir(typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(valor), 'INVALID_DATA', 'Enviá inicio y fin como fechas ISO UTC.');
  const fecha = new Date(valor);
  exigir(Number.isFinite(fecha.getTime()) && fecha.toISOString() === (valor.includes('.') ? valor : valor.replace('Z', '.000Z')), 'INVALID_DATA', 'La fecha no es válida.');
  return fecha;
}

export class EventoService {
  constructor(repository, tipoRepository, resenaService, categoriaService, reloj, usuarioService, tipoService) {
    Object.assign(this, { repository, tipoRepository, resenaService, categoriaService, reloj, usuarioService, tipoService });
  }
  obtener(id) {
    const evento = this.repository.buscarPorId(id);
    exigir(evento, 'NOT_FOUND', 'El evento no existe.');
    return evento;
  }
  propio(id, actorId) {
    const actor = this.usuarioService.identificar(actorId);
    const evento = this.obtener(id);
    exigir(actor.esOrganizadorDe(evento), 'FORBIDDEN', 'Solo el organizador puede gestionar este evento.');
    return evento;
  }
  crear(datos, actorId) {
    const organizador = this.usuarioService.identificar(actorId);
    exigir(datos.organizadorId === organizador.id, 'FORBIDDEN', 'El organizador debe coincidir con el usuario seleccionado.');
    const categoria = this.categoriaService.obtener(datos.categoriaId);
    const evento = new Evento({ id: randomUUID(), organizador, categoria, titulo: datos.titulo,
      descripcion: datos.descripcion, lugar: datos.lugar, inicio: fechaUTC(datos.inicio), fin: fechaUTC(datos.fin), multimedia: datos.multimedia });
    const tipos = this.tipoService.preparar(evento.id, datos.tiposEntrada);
    // El conjunto completo ya es válido. Map síncrono y sin await entre estas escrituras.
    this.repository.guardar(evento);
    this.tipoService.registrar(tipos);
    return { ...this.dto(evento, this.reloj()), tiposEntrada: tipos.map(tipoDTO) };
  }
  deOrganizador(organizadorId, actorId) {
    const actor = this.usuarioService.identificar(actorId);
    exigir(actor.id === organizadorId, 'FORBIDDEN', 'Solo podés consultar tus propios eventos.');
    const ahora = this.reloj();
    return this.repository.deOrganizador(organizadorId)
      .sort((a, b) => b.inicio - a.inicio || a.id.localeCompare(b.id)).map((evento) => this.dto(evento, ahora));
  }
  dto(evento, ahora) {
    const disponibles = this.tipoRepository.deEvento(evento.id).filter((tipo) => tipo.disponibles > 0);
    return {
      id: evento.id, titulo: evento.titulo, descripcion: evento.descripcion, lugar: evento.lugar,
      organizador: { ...usuarioDTO(evento.organizador), reputacion: this.resenaService.reputacion(evento.organizador.id) },
      categoria: categoriaDTO(evento.categoria), inicio: evento.inicio.toISOString(), fin: evento.fin.toISOString(),
      multimedia: evento.multimedia.map((medio) => ({ ...medio })), moneda: 'ARS',
      precioDesdeCentavos: disponibles.length ? Math.min(...disponibles.map((tipo) => tipo.precioCentavos)) : null,
      agotado: disponibles.length === 0, puedeReservar: disponibles.length > 0 && !evento.comenzo(ahora),
      tiempoEvento: tiempoEvento(evento, ahora), zonaHoraria: ZONA_HORARIA,
    };
  }
  detalle(id) { return this.dto(this.obtener(id), this.reloj()); }
  listar({ texto = '', categoriaId, orden = 'fecha' }) {
    exigir(['fecha', 'precio', 'puntaje'].includes(orden), 'INVALID_DATA', 'El orden debe ser fecha, precio o puntaje.');
    if (categoriaId) this.categoriaService.obtener(categoriaId);
    const ahora = this.reloj();
    const eventos = this.repository.todos()
      .filter((evento) => !evento.comenzo(ahora) && evento.coincideTexto(texto) && (!categoriaId || evento.categoria.id === categoriaId))
      .map((evento) => this.dto(evento, ahora));
    const porFecha = (a, b) => a.inicio.localeCompare(b.inicio) || a.id.localeCompare(b.id);
    return eventos.sort((a, b) => {
      if (orden === 'precio') return (a.precioDesdeCentavos ?? Infinity) - (b.precioDesdeCentavos ?? Infinity) || porFecha(a, b);
      if (orden === 'puntaje') return (b.organizador.reputacion.puntaje ?? -1) - (a.organizador.reputacion.puntaje ?? -1) || porFecha(a, b);
      return porFecha(a, b);
    });
  }
}
