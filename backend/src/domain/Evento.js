import { exigir, validarTexto } from './ErrorNegocio.js';

export class Evento {
  constructor({ id, titulo, descripcion, lugar = '', organizador, categoria, inicio, fin, multimedia = [] }) {
    titulo = validarTexto(titulo, 'El título');
    descripcion = validarTexto(descripcion, 'La descripción');
    exigir(organizador?.id && categoria?.id, 'INVALID_DATA', 'El evento requiere organizador y categoría.');
    exigir(typeof lugar === 'string', 'INVALID_DATA', 'El lugar debe ser un texto.');
    exigir(inicio instanceof Date && fin instanceof Date && Number.isFinite(inicio.getTime()) && Number.isFinite(fin.getTime()) && fin > inicio, 'INVALID_DATA', 'El fin debe ser posterior al inicio y ambas fechas deben ser válidas.');
    exigir(Array.isArray(multimedia), 'INVALID_DATA', 'Multimedia debe ser una lista de URLs de imágenes o videos.');
    const medios = multimedia.map((medio) => {
      exigir(medio && ['imagen', 'video'].includes(medio.tipo), 'INVALID_DATA', 'Indicá imagen o video para cada URL.');
      const url = validarTexto(medio.url, 'La URL multimedia');
      let direccion;
      try { direccion = new URL(url); } catch { /* Se informa como error de dominio. */ }
      exigir(direccion && ['http:', 'https:'].includes(direccion.protocol) && !direccion.username && !direccion.password, 'INVALID_DATA', 'La URL multimedia debe ser HTTP o HTTPS sin credenciales.');
      return { tipo: medio.tipo, url };
    });
    Object.assign(this, { id, titulo, descripcion, lugar: lugar.trim(), organizador, categoria,
      inicio: new Date(inicio), fin: new Date(fin), multimedia: medios });
  }

  comenzo(ahora) { return ahora >= this.inicio; }
  finalizo(ahora) { return ahora >= this.fin; }

  exigirVentaAbierta(ahora) {
    exigir(!this.comenzo(ahora), 'EVENT_STARTED', 'El evento ya comenzó. No admite nuevas reservas ni pagos.');
  }

  coincideTexto(texto) {
    const normalizar = (valor) => valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return normalizar(`${this.titulo} ${this.descripcion}`).includes(normalizar(texto));
  }
}
