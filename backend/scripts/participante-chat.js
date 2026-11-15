// Cliente de apoyo para la comprobación manual: no forma parte de la app.
// node scripts/participante-chat.js COMPRA_ID lucia
import { createInterface } from 'node:readline';
import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';

const [compraId, usuarioId = 'lucia'] = process.argv.slice(2);
if (!compraId) throw new Error('Indicá COMPRA_ID y el usuario participante.');
const base = process.env.API_URL ?? 'http://127.0.0.1:3000';
const ruta = `/compras/${encodeURIComponent(compraId)}`;
const socket = new WebSocket(`${base.replace(/^http/, 'ws')}${ruta}/chat`);
const terminal = createInterface({ input: process.stdin, output: process.stdout, terminal: false });
let listo = false;
const observados = new Set();
const mostrar = (mensaje) => {
  if (observados.has(mensaje.id)) return;
  observados.add(mensaje.id);
  console.info(JSON.stringify({ observadoDesde: 'PC-cliente-apoyo', ...mensaje }));
};
socket.on('open', () => socket.send(JSON.stringify({ tipo: 'identificar', usuarioId, plataforma: 'pc-chat-manual' })));
socket.on('message', async (data) => {
  const evento = JSON.parse(data.toString());
  if (evento.tipo === 'listo') {
    try {
      const respuesta = await fetch(`${base}${ruta}/mensajes`, { headers: { 'X-Usuario-Id': usuarioId, 'X-Client-Platform': 'pc-chat-manual' } });
      if (!respuesta.ok) throw new Error(`Historial HTTP ${respuesta.status}`);
      (await respuesta.json()).forEach(mostrar);
      listo = true;
      console.info(`LISTO: ${usuarioId}, compra ${compraId}. Cada línea envía un mensaje; /salir cierra.`);
    } catch (error) { console.error(error); socket.close(); }
  } else if (evento.tipo === 'mensaje') mostrar(evento.mensaje);
  else console.info(JSON.stringify(evento));
});
terminal.on('line', (texto) => {
  if (texto === '/salir') { socket.close(); terminal.close(); return; }
  if (!listo || socket.readyState !== WebSocket.OPEN) { console.info('Esperá a LISTO.'); return; }
  if (texto.trim()) socket.send(JSON.stringify({ tipo: 'enviar', idEnvio: randomUUID(), texto }));
});
socket.on('error', (error) => console.error(`Error de transporte: ${error.message}`));
socket.on('close', () => { console.info('Conexión cerrada.'); terminal.close(); });
