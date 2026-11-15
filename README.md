# AI Ticket It

Trabajo Práctico Individual de Desarrollo con Inteligencia Artificial — DDS UTN, 2C 2026.

**Autor:** [Santiago Szewaga Fernandez](https://github.com/santiagoszewagafernandez).

Aplicación para descubrir y organizar eventos y administrar entradas. El backend está desarrollado en **Node.js y Express** y el frontend en **React Native, Expo y Expo Router**. Se ejecuta localmente en un dispositivo móvil y almacena los datos **en memoria**.

## Funcionalidades

- Catálogo con búsqueda, categorías, ordenamientos y favoritos.
- Creación de eventos y tipos de entrada con precios y cupos.
- Reserva, pago simulado, compras y gestión para el organizador.
- Cancelación por entradas, reembolso simulado y devolución de cupo.
- Chat por compra con historial HTTP y mensajes por WebSocket.
- Entradas QR, confirmación de ingreso, reseñas y reputación.

La identidad se elige mediante usuarios de demostración. Los pagos y reembolsos son simulados. Reiniciar el backend restablece los datos iniciales y pierde los cambios de la sesión.

## Requisitos

- Node.js 24 o posterior y npm.
- PC y teléfono conectados a la misma red local.
- Expo Go compatible con el SDK 58 del proyecto para probarlo en el móvil. El desarrollo y las comprobaciones documentadas se realizaron en Windows y iPhone.

## Ejecutar localmente

Clonar este repositorio y abrir una terminal en su carpeta:

```powershell
git clone https://github.com/santiagoszewagafernandez/ai-ticket-it.git
cd ai-ticket-it
```

Backend, desde la raíz del proyecto:

```powershell
cd backend
npm ci
npm start
```

Por defecto Express escucha en `0.0.0.0:3000`. Al iniciar muestra las direcciones disponibles. `backend/.env.example` documenta las opciones; crear `backend/.env` es opcional.

En otra terminal, también desde la raíz del proyecto:

```powershell
cd frontend
npm ci
Copy-Item .env.example .env
```

Editar `frontend/.env` y reemplazar `IP-DE-TU-PC` por la IPv4 Wi-Fi de la computadora:

```dotenv
EXPO_PUBLIC_API_URL=http://IP-DE-TU-PC:3000
```

Después ejecutar:

```powershell
npm start
```

Abrir el proyecto desde Expo Go con el QR de Metro. En el teléfono la URL del backend debe usar la IP de la PC; `localhost` apunta al propio teléfono. El selector de usuarios incluye un diagnóstico de conexión y permite cambiar la URL durante la sesión.

El lockfile del frontend conserva un conflicto de peer dependencies entre React y `react-dom` transitivo documentado durante el desarrollo. Si `npm ci` falla con `ERESOLVE`, ejecutar `npm ci --force`, manteniendo las versiones del `package-lock.json`. No es necesario instalar paquetes globales ni crear una compilación paga.

Antes de iniciar otros procesos, comprobar si Express o Metro ya están ejecutándose. Express utiliza el puerto 3000 y Metro el 8081; reutilizar los procesos que correspondan a este proyecto.

## Estructura

```text
backend/
  src/domain/          Entidades y reglas del negocio
  src/services/        Casos de uso y coordinación
  src/controllers/     Entrada HTTP y respuestas
  src/repositories/    Persistencia en memoria
  test/                Pruebas de dominio, servicios y HTTP/WebSocket
frontend/
  src/app/             Pantallas y rutas de Expo Router
  src/api/             Cliente HTTP
  src/hooks/           Estado y coordinación de la interfaz
  src/ui/              Componentes compartidos
  test/                Pruebas de lógica del frontend
docs/                  Consigna, decisiones, contratos y verificaciones
```

## Verificaciones

Desde `backend`:

```powershell
npm test
```

Desde `frontend`:

```powershell
node --test test/*.test.mjs
npm run lint
npm run typecheck
```

La [matriz de cobertura](docs/COBERTURA.md) distingue pruebas automáticas, comprobaciones manuales en iPhone y sus límites. Las pruebas de lógica del frontend no representan una automatización de la interfaz nativa.

## Documentación

- [Consigna del TP](docs/CONSIGNA.md).
- [Especificación y decisiones del proyecto](docs/ESPECIFICACION.md).
- [Contratos de la API](docs/API.md).
- [Cobertura de funcionalidades y verificaciones](docs/COBERTURA.md).

## Video de entrega

El video final fue preparado el 15/11/2026: **AI Ticket It - Santiago Szewaga Fernandez.mp4**, de **08:29,867**. Muestra el recorrido de reserva, pago y cancelación parcial, su implementación y una reflexión sobre el uso de IA.

El MP4 y las grabaciones se conservan localmente y se entregan por separado. Este repositorio contiene el código y la documentación del TP.
