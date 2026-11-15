import { UsuarioRepository } from './repositories/UsuarioRepository.js';
import { CategoriaRepository } from './repositories/CategoriaRepository.js';
import { EventoRepository } from './repositories/EventoRepository.js';
import { TipoEntradaRepository } from './repositories/TipoEntradaRepository.js';
import { CompraRepository } from './repositories/CompraRepository.js';
import { EntradaRepository } from './repositories/EntradaRepository.js';
import { CambioEstadoCompraRepository } from './repositories/CambioEstadoCompraRepository.js';
import { ResenaRepository } from './repositories/ResenaRepository.js';
import { UsuarioService } from './services/UsuarioService.js';
import { CategoriaService } from './services/CategoriaService.js';
import { EventoService } from './services/EventoService.js';
import { TipoEntradaService } from './services/TipoEntradaService.js';
import { CompraService } from './services/CompraService.js';
import { EntradaService } from './services/EntradaService.js';
import { CambioEstadoCompraService } from './services/CambioEstadoCompraService.js';
import { ResenaService } from './services/ResenaService.js';
import { cargarDatosIniciales } from './datosIniciales.js';
import { MensajeRepository } from './repositories/MensajeRepository.js';
import { MensajeService } from './services/MensajeService.js';

export function crearContexto(reloj = () => new Date()) {
  const repos = {
    usuario: new UsuarioRepository(), categoria: new CategoriaRepository(), evento: new EventoRepository(),
    tipoEntrada: new TipoEntradaRepository(), compra: new CompraRepository(), entrada: new EntradaRepository(),
    cambio: new CambioEstadoCompraRepository(), resena: new ResenaRepository(), mensaje: new MensajeRepository(),
  };
  // La consulta se invoca después de componer los servicios. Reutiliza el DTO vigente
  // de Evento sin hacer que Usuario conozca cupos, reputación o sus repositorios.
  const usuario = new UsuarioService(repos.usuario, (id) => evento.detalle(id));
  const categoria = new CategoriaService(repos.categoria);
  const resena = new ResenaService(repos.resena, usuario, repos.evento, repos.compra, reloj);
  const tipoEntrada = new TipoEntradaService(repos.tipoEntrada, repos.evento);
  const evento = new EventoService(repos.evento, repos.tipoEntrada, resena, categoria, reloj, usuario, tipoEntrada);
  const compra = new CompraService({
    repository: repos.compra, entradaRepository: repos.entrada, cambioRepository: repos.cambio,
    usuarioService: usuario, eventoService: evento, tipoService: tipoEntrada, resenaService: resena, reloj,
  });
  const entrada = new EntradaService(repos.entrada, compra, evento, reloj);
  const cambio = new CambioEstadoCompraService(repos.cambio, compra);
  const mensaje = new MensajeService(repos.mensaje, compra, usuario, reloj);
  cargarDatosIniciales(repos, compra, reloj());
  return { repos, servicios: { usuario, categoria, resena, evento, tipoEntrada, compra, entrada, cambio, mensaje } };
}
