# Bot de inactividad para Discord (discord.js)

Este repositorio contiene un bot de Discord desarrollado con
[`discord.js`](https://discord.js.org/) que permite a los miembros informar
períodos de inactividad, mientras que los administradores disponen de
herramientas de seguimiento y estadísticas por rol. El objetivo es proporcionar
una solución modular, extensible y completamente documentada, capaz de operar en
servidores donde la organización del personal depende de conocer la
disponibilidad de los integrantes.

## Características principales

- **Panel interactivo dedicado**: el bot publica un embed con botones en el
  canal designado para que cada usuario marque, modifique, consulte o elimine su
  inactividad. Todas las respuestas se envían como mensajes efímeros para
  respetar la privacidad.
- **Notificaciones automáticas**: cuando finaliza el periodo marcado, el bot
  menciona al usuario en el canal del panel avisándole que la inactividad concluyó.
- **Comandos administrativos**: slash commands para listar inactivos, registrar
  roles a monitorear, eliminar registros y consultar estadísticas con historial
  de hasta 30 días.
- **Persistencia local**: se usa SQLite (mediante `better-sqlite3`) para guardar
  las inactividades, los roles vigilados y los snapshots estadísticos.
- **Tareas programadas**: un scheduler revisa periódicamente las inactividades
  vencidas y genera snapshots de actividad dos veces al día.
- **Arquitectura modular**: servicios de dominio, utilidades de tiempo y
  manejadores de interacciones separados en archivos autocontenidos.

## Requisitos

- Node.js 18.17 o superior.
- Una aplicación/bot registrados en el
  [Portal de Desarrolladores de Discord](https://discord.com/developers/applications).

Instala las dependencias con:

```bash
npm install
```

## Configuración

Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:

| Variable | Descripción |
| --- | --- |
| `DISCORD_TOKEN` | Token del bot proporcionado por Discord. |
| `DISCORD_CLIENT_ID` | ID del cliente de la aplicación. |
| `DISCORD_GUILD_ID` | ID del servidor principal donde operará el bot. |
| `DISCORD_INACTIVITY_CHANNEL_ID` | Canal donde se mostrará el panel de inactividad y se enviarán recordatorios. |
| `DISCORD_ADMIN_LOG_CHANNEL_ID` | Canal de administración para registros y posibles extensiones (reservado). |
| `DATABASE_PATH` | Ruta al archivo SQLite (opcional, por defecto `./data/inactividad.db`). |
| `REMINDER_INTERVAL_MINUTES` | Frecuencia para revisar inactividades vencidas (opcional, por defecto `5`). |

Ejemplo de `.env`:

```
DISCORD_TOKEN=tu_token
DISCORD_CLIENT_ID=123456789012345678
DISCORD_GUILD_ID=123456789012345678
DISCORD_INACTIVITY_CHANNEL_ID=123456789012345678
DISCORD_ADMIN_LOG_CHANNEL_ID=123456789012345678
DATABASE_PATH=./data/inactividad.db
REMINDER_INTERVAL_MINUTES=5
```

## Puesta en marcha

1. Instala dependencias con `npm install`.
2. Configura las variables de entorno en `.env`.
3. Registra los slash commands y arranca el bot ejecutando:

   ```bash
   npm start
   ```

Al iniciarse, el bot registrará los comandos en el servidor configurado y
publicará (o actualizará) automáticamente el panel interactivo en el canal de
inactividad.

## Uso

### Opciones para miembros

Desde el panel interactivo, cada usuario puede:

- **Marcar inactividad**: define una duración (ej. `3d`, `6h30m`) o una fecha
  exacta (ej. `2024-05-31 18:00`).
- **Modificar inactividad**: vuelve a abrir el modal para ajustar la duración o
  fecha final.
- **Desmarcar inactividad**: borra el registro si el usuario regresa antes de lo
  previsto.
- **Mostrar estado**: informa la fecha/hora hasta la que permanece inactivo.

### Comandos administrativos

Todos los comandos se agrupan bajo `/inactividad` y requieren permisos de
administrador:

- `/inactividad listar`: lista a los miembros actualmente inactivos.
- `/inactividad estadisticas`: calcula inactivos/activos para cada rol vigilado y
  adjunta un historial (últimos 30 días).
- `/inactividad roles agregar rol:<rol>`: añade un rol a la lista de seguimiento.
- `/inactividad roles eliminar rol:<rol>`: deja de monitorear un rol.
- `/inactividad roles listar`: muestra los roles actualmente registrados.

## Estructura del proyecto

```
src/
├── config.js              # Lectura de variables de entorno y valores por defecto.
├── database.js            # Inicialización de SQLite y definición de tablas.
├── handlers/
│   └── interactionHandler.js  # Manejo centralizado de botones, modales y slash commands.
├── index.js               # Punto de entrada: wiring de servicios, cliente y scheduler.
├── interactions/
│   ├── commands.js        # Registro de comandos vía REST.
│   └── inactivityPanel.js # Embed, botones y modales del panel principal.
├── logger.js              # Configuración de pino para logging estructurado.
├── services/
│   ├── inactivityService.js # Persistencia y lógica de inactividad.
│   ├── roleService.js       # Gestión de roles vigilados y snapshots.
│   └── scheduler.js         # Recordatorios y snapshots periódicos.
└── utils/
    └── time.js             # Utilidades para parsear duraciones/fechas y formatear salidas.
```

## Desarrollo y extensiones sugeridas

- Añadir pruebas unitarias con Jest para los servicios de dominio.
- Generar recordatorios proactivos minutos antes de la fecha de retorno.
- Exponer un panel web o dashboard externo con las estadísticas almacenadas.
- Integrar webhooks o integraciones con herramientas de gestión del equipo.

## Licencia

Este proyecto se distribuye bajo la licencia MIT. Consulta el archivo
[LICENSE](LICENSE) si deseas reutilizarlo o modificarlo.
