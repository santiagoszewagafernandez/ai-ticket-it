import { networkInterfaces } from 'node:os';
import { crearAplicacion } from './app.js';
import { iniciarVencimientos } from './vencimientos.js';
import { conectarChat } from './chat.js';

const host = process.env.HOST ?? '0.0.0.0';
const port = Number(process.env.PORT ?? 3000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT debe ser un entero entre 1 y 65535.');
}

const app = crearAplicacion({ registrarSolicitudes: true });
const detenerVencimientos = iniciarVencimientos(app.locals.contexto.servicios.compra);

const server = app.listen(port, host, () => {
  console.info(`Express escuchando en ${host}:${port}`);
  console.info(`PC: http://127.0.0.1:${port}/health`);
  if (host === '0.0.0.0') {
    for (const [name, addresses] of Object.entries(networkInterfaces())) {
      for (const address of addresses) {
        if (address.family === 'IPv4' && !address.internal) {
          console.info(`Red local (${name}): http://${address.address}:${port}/health`);
        }
      }
    }
  }
});
conectarChat(server, app.locals.contexto.servicios.mensaje, { registrar: true });

server.on('error', (error) => {
  detenerVencimientos();
  console.error(`No se pudo iniciar Express: ${error.message}`);
  process.exitCode = 1;
});

server.on('close', detenerVencimientos);
