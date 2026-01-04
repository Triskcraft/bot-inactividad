# Bot de inactividad para Discord (discord.js)

Bot administrativo para servidores de Discord que permite a los miembros
registrar periodos de inactividad y ofrece a los administradores un panel de
seguimiento por roles, estadísticas históricas y tareas automatizadas. Está
construido con [`discord.js`](https://discord.js.org/), usa PostgreSQL a través
de Prisma y expone una pequeña API HTTP para datos del servidor.

## Características

- **Panel interactivo**: publica un embed con botones para marcar, editar,
  eliminar o consultar tu inactividad; las respuestas son efímeras.
- **Recordatorios automáticos**: cuando expira una inactividad, el bot menciona
  al usuario en el canal configurado y limpia el registro.
- **Slash commands para admins**: listar inactivos, consultar estadísticas por
  rol (con histórico) y administrar los roles monitoreados.
- **Capturas periódicas**: genera snapshots de actividad por rol dos veces al
  día para alimentar el historial.
- **API HTTP**: endpoint `/members` que combina la whitelist de Minecraft con la
  información persistida en base de datos (roles, medios, descripción, etc.).
- **Configuración con toggles**: variables para decidir si se publican comandos
  o el panel en cada arranque, útil para entornos CI/CD.

## Requisitos

- Node.js **22.21+** (coincide con `engines` en `package.json`).
- PostgreSQL accesible mediante cadena de conexión.
- Una aplicación/bot en el
  [Portal de Desarrolladores de Discord](https://discord.com/developers/applications).

Instala dependencias con:

```bash
npm install
```

## Variables de entorno

Crea un archivo `.env` en la raíz con al menos estas claves obligatorias:

| Variable | Descripción |
| --- | --- |
| `DISCORD_TOKEN` | Token del bot de Discord. |
| `DISCORD_CLIENT_ID` | ID de cliente de la aplicación. |
| `DISCORD_GUILD_ID` | ID del servidor donde se registrarán comandos. |
| `DISCORD_INACTIVITY_CHANNEL_ID` | Canal donde se publica el panel y se envían recordatorios. |
| `DISCORD_ADMIN_LOG_CHANNEL_ID` | Canal opcional para registrar acciones administrativas. |
| `WHITELIST_ROUTE` | Ruta al archivo JSON de whitelist (lista de usuarios de Minecraft). |
| `DATABASE_PATH` | Cadena de conexión PostgreSQL para Prisma (ej. `postgresql://user:pass@host:5432/db`). |

Claves recomendadas y su valor por defecto:

| Variable | Descripción | Predeterminado |
| --- | --- | --- |
| `DEPLOY_COMMAND` | Si es `true`, registra/actualiza los slash commands en el arranque. | `false` |
| `DEPLOY_INACTIVITY_PANEL` | Si es `true`, publica/actualiza el panel de inactividad al iniciar. | `false` |
| `REMINDER_INTERVAL_MINUTES` | Frecuencia con la que se revisan inactividades vencidas. | `5` |
| `API_PORT` | Puerto para la API HTTP. | `3000` |
| `FRONT_ORIGIN` | Origen permitido por CORS para la API. | sin restricción |
| `NODE_ENV` | Entorno (`development`, `production`, etc.). | `development` |

Ejemplo de `.env`:

```dotenv
DISCORD_TOKEN=tu_token
DISCORD_CLIENT_ID=123456789012345678
DISCORD_GUILD_ID=123456789012345678
DISCORD_INACTIVITY_CHANNEL_ID=123456789012345678
DISCORD_ADMIN_LOG_CHANNEL_ID=123456789012345678
DATABASE_PATH=postgresql://user:pass@localhost:5432/bot_inactividad
WHITELIST_ROUTE=/ruta/whitelist.json
DEPLOY_COMMAND=true
DEPLOY_INACTIVITY_PANEL=true
REMINDER_INTERVAL_MINUTES=5
API_PORT=3000
```

## Puesta en marcha

1. Instala dependencias: `npm install`.
2. Genera el cliente de Prisma y aplica las migraciones (hay SQL inicial en
   `src/prisma/migrations`):

   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```

3. Arranca el bot (usa las variables `DEPLOY_COMMAND` y `DEPLOY_INACTIVITY_PANEL`
   según necesites desplegar comandos/panel):

   ```bash
   npm start
   ```

   La API HTTP quedará escuchando en `API_PORT` y el bot se conectará al
   servidor de Discord definido por `DISCORD_GUILD_ID`.

## Operación del bot

### Panel para miembros

Los usuarios interactúan con botones en el canal configurado:

- **Marcar/Editar inactividad**: abre un modal para definir duración
  (`3d`, `6h30m`) o fecha exacta (`2024-12-31 18:00`).
- **Desmarcar inactividad**: elimina el registro si vuelve antes de tiempo.
- **Mostrar estado**: responde con la fecha/hora hasta la que permanece inactivo.

### Comandos administrativos (`/inactividad`)

Requieren permisos de administrador:

- `listar`: lista miembros inactivos vs. activos dentro de los roles vigilados.
- `estadisticas`: calcula porcentajes por rol e incluye el historial de las
  últimas capturas.
- `roles agregar rol:<rol>` / `roles eliminar rol:<rol>` / `roles listar`:
  administra los roles que serán monitoreados.

Además, `/dis-session` genera y almacena un código de enlace para usuarios de
Minecraft, enviándolo por DM y respondiendo de forma efímera.

### API HTTP

- `GET /members`: lee la whitelist definida en `WHITELIST_ROUTE`, cruza los
  usuarios con la base de datos (rango, roles vinculados, medios, descripción) y
  devuelve la lista enriquecida. Incluye CORS con el origen configurado en
  `FRONT_ORIGIN`.

### Tareas automáticas

- **Recordatorios**: cada `REMINDER_INTERVAL_MINUTES` se revisan inactividades
  vencidas, se notifica al usuario y se limpia el registro.
- **Snapshots**: cada 12 horas se capturan estadísticas de actividad por rol
  monitoreado para construir el historial mostrado en `/inactividad estadisticas`.

## Estructura del proyecto (resumen)

```
src/
├── api/                   # API HTTP con Express (`/members`).
├── client.ts              # Inicializa Discord.js, intents y registro de comandos.
├── commands/              # Implementación de slash commands (p. ej. dis-session).
├── config.ts              # Carga y validación de variables de entorno.
├── handlers/              # Manejo centralizado de interacciones y slash commands.
├── interactions/          # Definición del panel, modales y registro de comandos.
├── prisma/                # Schema, migraciones y cliente generado.
├── services/              # Lógica de dominio: inactividad, roles, scheduler.
├── utils/                 # Utilidades comunes (tiempo, etc.).
└── index.ts               # Punto de entrada: API + bot + scheduler.
```

## Desarrollo y recomendaciones

- Ejecuta `npm run lint` para validar estilo y reglas de ESLint.
- Usa `npm run dev` para recargar automáticamente el bot durante el desarrollo.
- Ajusta `DEPLOY_COMMAND` y `DEPLOY_INACTIVITY_PANEL` a `false` en local si no
  quieres sobrescribir comandos/panel en el servidor de producción.

## Licencia

Este proyecto se distribuye bajo la licencia MIT. Consulta el archivo
[LICENSE](LICENSE) si deseas reutilizarlo o modificarlo.
