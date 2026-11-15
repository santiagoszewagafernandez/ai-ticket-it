import { validarTexto } from './ErrorNegocio.js';

export class Usuario {
  #favoritos = new Set();
  constructor({ id, nombre }) {
    this.id = id;
    this.nombre = nombre;
  }

  esCompradorDe(compra) {
    return compra.comprador.id === this.id;
  }

  esOrganizadorDe(evento) { return evento.organizador.id === this.id; }

  get favoritos() { return [...this.#favoritos]; }
  agregarFavorito(eventoId) { this.#favoritos.add(validarTexto(eventoId, 'El evento')); }
  quitarFavorito(eventoId) { this.#favoritos.delete(validarTexto(eventoId, 'El evento')); }
}
