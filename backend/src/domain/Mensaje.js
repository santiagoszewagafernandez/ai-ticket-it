import { randomUUID } from 'node:crypto';
import { exigir, validarTexto } from './ErrorNegocio.js';

export class Mensaje {
  constructor({ compraId, autor, texto, idEnvio, fecha, id = randomUUID() }) {
    this.compraId = validarTexto(compraId, 'compraId');
    exigir(autor?.id, 'INVALID_DATA', 'El mensaje necesita un autor.');
    this.autor = autor;
    this.texto = validarTexto(texto, 'texto');
    this.idEnvio = validarTexto(idEnvio, 'idEnvio');
    exigir(fecha instanceof Date && Number.isFinite(fecha.getTime()), 'INVALID_DATA', 'La fecha del mensaje no es válida.');
    this.fecha = new Date(fecha);
    this.id = id;
  }
  exigirMismoTexto(texto) {
    exigir(this.texto === validarTexto(texto, 'texto'), 'SEND_ID_CONFLICT', 'Ese idEnvio ya identifica otro texto. Reintentá el mensaje original.');
  }
}
