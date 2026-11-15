import express from 'express';
import { crearContexto } from './composicion.js';
import { ErrorNegocio } from './domain/ErrorNegocio.js';
import { UsuarioController } from './controllers/UsuarioController.js';
import { CategoriaController } from './controllers/CategoriaController.js';
import { EventoController } from './controllers/EventoController.js';
import { TipoEntradaController } from './controllers/TipoEntradaController.js';
import { CompraController } from './controllers/CompraController.js';
import { EntradaController } from './controllers/EntradaController.js';
import { CambioEstadoCompraController } from './controllers/CambioEstadoCompraController.js';
import { ResenaController } from './controllers/ResenaController.js';
import { MensajeController } from './controllers/MensajeController.js';

const estadosHTTP = {
  INVALID_DATA: 400, IDENTITY_REQUIRED: 401, FORBIDDEN: 403, NOT_FOUND: 404,
  TYPE_EVENT_MISMATCH: 400, INSUFFICIENT_CAPACITY: 409, EVENT_STARTED: 409,
  RESERVATION_EXPIRED: 409, PURCHASE_NOT_PAYABLE: 409,
  TICKET_PURCHASE_MISMATCH: 400, TICKET_NOT_CANCELABLE: 409, CANCELLATION_DEADLINE: 409,
  TICKET_EVENT_MISMATCH: 409, TICKET_ALREADY_USED: 409, TICKET_CANCELED: 409, TICKET_UNPAID: 409,
  EVENT_NOT_FINISHED: 409, ATTENDANCE_REQUIRED: 409, REVIEW_ALREADY_EXISTS: 409,
};

export function crearAplicacion({ reloj = () => new Date(), registrarSolicitudes = false } = {}) {
  const app = express();
  const contexto = crearContexto(reloj);
  const { servicios } = contexto;
  app.locals.contexto = contexto;
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (registrarSolicitudes && req.path !== '/health') {
      res.on('finish', () => console.info(`[api] ${new Date().toISOString()} cliente=${req.ip} plataforma=${req.get('X-Client-Platform') ?? 'sin indicar'} usuario=${req.get('X-Usuario-Id') ?? '-'} ${req.method} ${req.originalUrl} HTTP=${res.statusCode}`));
    }
    next();
  });
  app.use(express.json({ limit: '16kb' }));
  app.get('/health', (req, res) => {
    const timestamp = new Date().toISOString();
    console.info(`[health] ${timestamp} cliente=${req.ip} plataforma=${req.get('X-Client-Platform') ?? 'sin indicar'}`);
    res.json({ status: 'ok', service: 'ai-ticket-it', timestamp });
  });
  app.use((req, res, next) => { servicios.compra.procesarVencimientos(); next(); });
  const usuarios = new UsuarioController(servicios.usuario);
  const categorias = new CategoriaController(servicios.categoria);
  const eventos = new EventoController(servicios.evento);
  const tipos = new TipoEntradaController(servicios.tipoEntrada);
  const compras = new CompraController(servicios.compra);
  const entradas = new EntradaController(servicios.entrada);
  const cambios = new CambioEstadoCompraController(servicios.cambio);
  const resenas = new ResenaController(servicios.resena);
  const mensajes = new MensajeController(servicios.mensaje);
  app.get('/usuarios', usuarios.listar);
  app.get('/usuarios/:id/favoritos', usuarios.favoritos);
  app.put('/usuarios/:id/favoritos/:eventoId', usuarios.agregarFavorito);
  app.delete('/usuarios/:id/favoritos/:eventoId', usuarios.quitarFavorito);
  app.get('/categorias', categorias.listar);
  app.get('/eventos', eventos.listar);
  app.post('/eventos', eventos.crear);
  app.get('/usuarios/:id/eventos', eventos.deOrganizador);
  app.get('/eventos/:id/compras', compras.deEvento);
  app.get('/eventos/:id', eventos.detalle);
  app.get('/eventos/:id/tipos-entrada', tipos.listar);
  app.get('/resenas', resenas.listar);
  app.post('/eventos/:id/resenas', resenas.crear);
  app.post('/compras', compras.crear);
  app.get('/compras', compras.listar);
  app.get('/compras/:id', compras.detalle);
  app.post('/compras/:id/pago', compras.pagar);
  app.post('/compras/:id/cancelaciones', compras.cancelar);
  app.get('/compras/:id/entradas', entradas.listar);
  app.get('/entradas/:id/validacion', entradas.validar);
  app.post('/entradas/:id/uso', entradas.usar);
  app.get('/compras/:id/historial', cambios.listar);
  app.get('/compras/:id/mensajes', mensajes.listar);
  app.use((req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'La ruta solicitada no existe.' } }));
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    const codigo = err instanceof ErrorNegocio ? err.code : err.type === 'entity.parse.failed' ? 'INVALID_DATA' : err.type === 'entity.too.large' ? 'PAYLOAD_TOO_LARGE' : 'INTERNAL_ERROR';
    const status = codigo === 'PAYLOAD_TOO_LARGE' ? 413 : estadosHTTP[codigo] ?? 500;
    if (status === 500) console.error(err);
    res.status(status).json({ error: {
      code: codigo,
      message: status === 500 ? 'Ocurrió un error inesperado.' : err instanceof ErrorNegocio ? err.message : 'Revisá el cuerpo JSON de la solicitud.',
    } });
  });
  return app;
}
