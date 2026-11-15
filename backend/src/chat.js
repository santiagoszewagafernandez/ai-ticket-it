import { WebSocketServer, WebSocket } from 'ws';
import { MensajeController } from './controllers/MensajeController.js';
import { ErrorNegocio, exigir } from './domain/ErrorNegocio.js';

// Transporte: las reglas y el registro permanecen en MensajeService/Mensaje.
export function conectarChat(server, service, { registrar = false } = {}) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024, perMessageDeflate: false });
  const controller = new MensajeController(service);
  const sesiones = new Map();
  const enviar = (socket, datos) => {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(datos));
  };
  const fallo = (socket, error, idEnvio, fatal = false) => {
    const conocido = error instanceof ErrorNegocio;
    if (!conocido) console.error(error);
    enviar(socket, { tipo: 'error', ...(typeof idEnvio === 'string' ? { idEnvio } : {}), fatal,
      error: { code: conocido ? error.code : 'INTERNAL_ERROR', message: conocido ? error.message : 'Ocurrió un error inesperado.' } });
    if (fatal) socket.close(1008, 'Acceso rechazado');
  };
  const log = (accion, sesion, detalle = '') => {
    if (registrar) console.info(`[chat] ${new Date().toISOString()} ${accion} compra=${sesion.compraId} usuario=${sesion.actorId ?? '-'} cliente=${sesion.cliente} plataforma=${sesion.plataforma ?? '-'} ${detalle}`);
  };
  const upgrade = (req, socket, head) => {
    const ruta = new URL(req.url, 'http://localhost').pathname.match(/^\/compras\/([^/]+)\/chat$/);
    if (!ruta) { socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n'); return; }
    let compraId;
    try { compraId = decodeURIComponent(ruta[1]); }
    catch { socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'); return; }
    wss.handleUpgrade(req, socket, head, (ws) => {
      const sesion = { compraId, actorId: null, cliente: req.socket.remoteAddress, plataforma: null, vivo: true };
      sesiones.set(ws, sesion);
      const plazo = setTimeout(() => { fallo(ws, new ErrorNegocio('IDENTITY_REQUIRED', 'No se recibió la identidad.'), undefined, true); }, 8000);
      ws.on('error', (error) => { if (registrar) console.error(`[chat] transporte: ${error.message}`); });
      ws.on('pong', () => { sesion.vivo = true; });
      ws.on('close', () => { clearTimeout(plazo); sesiones.delete(ws); log('cerrado', sesion); });
      ws.on('message', (data, binario) => {
        let body;
        try {
          exigir(!binario, 'INVALID_DATA', 'Enviá JSON como texto.');
          try { body = JSON.parse(data.toString()); }
          catch { throw new ErrorNegocio('INVALID_DATA', 'Enviá un objeto JSON válido.'); }
          if (!sesion.actorId) {
            sesion.actorId = controller.identificar(compraId, body);
            sesion.plataforma = typeof body.plataforma === 'string' ? body.plataforma.replace(/[\r\n]/g, '') : '-';
            clearTimeout(plazo);
            log('suscrito', sesion);
            // La suscripción ya está activa ANTES de que el cliente consulte historial.
            enviar(ws, { tipo: 'listo', compraId, usuarioId: sesion.actorId });
            return;
          }
          const { mensaje, nuevo } = controller.enviar(compraId, sesion.actorId, body);
          log(nuevo ? 'registrado' : 'reintento', sesion, `mensaje=${mensaje.id} idEnvio=${mensaje.idEnvio}`);
          for (const [destino, participante] of sesiones) {
            if (participante.compraId !== compraId || !participante.actorId || (!nuevo && destino !== ws)) continue;
            try { service.autorizar(compraId, participante.actorId); }
            catch (error) { fallo(destino, error, undefined, true); continue; }
            // Guardado antes de distribuir; el propio mensaje confirma al emisor.
            enviar(destino, { tipo: 'mensaje', mensaje });
          }
        } catch (error) { fallo(ws, error, body?.idEnvio, !sesion.actorId); }
      });
    });
  };
  server.on('upgrade', upgrade);
  const latido = setInterval(() => {
    for (const [socket, sesion] of sesiones) {
      if (!sesion.vivo) { socket.terminate(); continue; }
      sesion.vivo = false;
      if (socket.readyState === WebSocket.OPEN) socket.ping();
    }
  }, 25000);
  latido.unref();
  const cerrar = () => {
    clearInterval(latido);
    server.off('upgrade', upgrade);
    for (const socket of sesiones.keys()) socket.terminate();
    sesiones.clear();
    wss.close();
  };
  server.once('close', cerrar);
  return { cerrar, conexiones: () => sesiones.size };
}
