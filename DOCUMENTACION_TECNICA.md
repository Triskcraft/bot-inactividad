# Documentación técnica exhaustiva: Bot de inactividad

> Alcance: este documento describe el funcionamiento interno del bot y su API
> HTTP, explicando cada módulo y bloque funcional relevante del proyecto.

## Tabla de contenido

1. [Resumen ejecutivo](#resumen-ejecutivo)
2. [Convención de versionado](#convención-de-versionado)
3. [API HTTP v1](#api-http-v1)
4. [Flujo de arranque y apagado](#flujo-de-arranque-y-apagado)
5. [Configuración y dependencias](#configuración-y-dependencias)
6. [Componentes de Discord (clientes, interacciones y comandos)](#componentes-de-discord-clientes-interacciones-y-comandos)
7. [Servicios de dominio](#servicios-de-dominio)
8. [Scheduler y jobs recurrentes](#scheduler-y-jobs-recurrentes)
9. [Persistencia y Prisma](#persistencia-y-prisma)
10. [Utilidades comunes](#utilidades-comunes)
11. [Ejemplos de uso actualizados](#ejemplos-de-uso-actualizados)

---

## Resumen ejecutivo

El proyecto implementa un bot administrativo de Discord con un panel de
autogestión de inactividad, comandos para administradores y una API HTTP de
solo lectura. La arquitectura separa:

- **Capa de integración Discord**: cliente, panel interactivo, comandos.
- **Servicios de dominio**: reglas de negocio para inactividad, roles y
  snapshots.
- **API HTTP**: endpoints versionados bajo `/v1`.
- **Persistencia**: Prisma + PostgreSQL.
- **Scheduler**: jobs periódicos para recordatorios y estadísticas.

---

## Convención de versionado

### Versión de la API

- **Estrategia**: versionado por URL (`/v1`).
- **Motivación**: permite cambios incompatibles sin romper clientes existentes.
- **Estado actual**: la API publicada es **v1** (`/v1/members`).

### Versión del proyecto (runtime)

- **Estrategia**: SemVer (por ejemplo `1.0.0` en `package.json`).
- **Interpretación**:
  - **MAJOR**: cambios de comportamiento o contratos que rompen compatibilidad
    (por ejemplo, un cambio de schema o de payload en API v1).
  - **MINOR**: nuevas funcionalidades compatibles.
  - **PATCH**: correcciones sin cambios de contrato.

### Versionado de base de datos

- **Mecanismo**: migraciones de Prisma (cuando se ejecutan). El schema actual
  define las tablas necesarias para inactividad, roles y vinculación de
  usuarios.

---

## API HTTP v1

### Base URL

```
/v1
```

### Endpoint: `GET /v1/members`

Entrega la lista de miembros de Minecraft enriquecida con datos de Discord.

**Origen de datos**
- Tabla `MinecraftUser` con relaciones a `DiscordUser`, `Media` y `Role`.

**Respuesta**
- Formato JSON, con caché pública de 24 horas:
  - Header: `Cache-Control: public, max-age=86400`

**Modelo de respuesta**

```json
[
  {
    "description": "Texto libre",
    "digs": 123,
    "mc_name": "nombre-en-mc",
    "mc_uuid": "uuid",
    "medias": [{ "type": "youtube", "url": "https://..." }],
    "rank": "Miembro",
    "roles": ["Builder", "Streamer"]
  }
]
```

**Notas técnicas**
- El endpoint utiliza Prisma para cargar relaciones con `include`.
- La lista de roles se deriva de la relación N:M `LinkedRole`.
- La whitelist file-based está comentada en el código y **no** se utiliza en
  la implementación actual.

---

## Flujo de arranque y apagado

### `src/index.ts`

1. **Inicialización de la API HTTP**
   - Levanta el servidor Express en `API_PORT`.
2. **Registro de handlers de Discord**
   - Conecta botones, modales y slash commands.
3. **Instancias de servicios**
   - `InactivityService`, `RoleService` y `Scheduler`.
4. **Despliegue opcional del panel**
   - Controlado por `DEPLOY_INACTIVITY_PANEL`.
5. **Inicio del scheduler**
   - Activa jobs periódicos.
6. **Apagado ordenado**
   - Detiene jobs, cierra Discord y desconecta Prisma en SIGINT/SIGTERM.

---

## Configuración y dependencias

### `src/config.ts`

**Bloques clave**
- **Carga de `.env`**: usa `process.loadEnvFile()`. Si no existe, loguea error.
- **`loadConfig()`**: valida variables obligatorias y advierte faltantes
  recomendadas.
- **`envs`**: objeto inmutable que concentra configuración runtime.
- **`RANK_ROLES`**: orden de prioridad para determinar el rango del usuario.

**Variables críticas**
- `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID`,
  `DISCORD_INACTIVITY_CHANNEL_ID`, `DISCORD_ADMIN_LOG_CHANNEL_ID`,
  `WHITELIST_ROUTE`, `DATABASE_PATH`.

### `src/logger.ts`

- **Logger central**: `pino` con nivel configurable por `LOG_LEVEL`.
- **Modo desarrollo**: `pino-pretty` con timestamps legibles.

### `prisma.config.ts`

- **Define schema**: `src/prisma/schema.prisma`.
- **Datasource**: toma `DATABASE_PATH` desde `.env`.

---

## Componentes de Discord (clientes, interacciones y comandos)

### `src/client.ts`

**Bloques clave**
- **Instancia del cliente**: configura intents y partials necesarios para
  miembros, mensajes y reacciones.
- **Promise `ready`**: asegura que el bot esté listo antes de seguir.
- **Registro condicional de comandos**: se ejecuta si `DEPLOY_COMMAND=true`.
- **Login y exportación**: autentica con `DISCORD_TOKEN` y exporta `client`.

### `src/interactions/commands.ts`

**Bloques clave**
- **`registerCommands()`**: registra slash commands usando REST API v10.
- **Comandos definidos**:
  - `/inactividad listar`
  - `/inactividad estadisticas`
  - `/inactividad roles agregar|eliminar|listar`
  - `/dis-session`

### `src/interactions/inactivityPanel.ts`

**Bloques clave**
- **`buildInactivityPanel()`**: crea embed y botones del panel.
- **`buildInactivityModal()`**: modal con campos `duration` y `until`.

**Flujo de UI**
- Botones → modal o acciones directas (limpiar/mostrar).
- Modal → validación y persistencia de inactividad.

### `src/handlers/interactionHandler.ts`

**Bloques clave**
- **`registerInteractionHandlers()`**: enruta eventos a handlers específicos.
- **`handleButton()`**: gestiona `set/edit/clear/show` de inactividad.
- **`handleModal()`**: parsea y valida fecha o duración.
- **`handleCommand()`**: enruta a `/inactividad` o `/dis-session`.
- **`inactividadCommand()`**: valida permisos admin y subcomandos.
- **`handleList()`**: genera embed con miembros activos/inactivos.
- **`handleStats()`**: resume porcentajes por rol + historial.
- **`handleRoleAdd/Remove/List()`**: gestiona roles monitoreados.
- **`logAdminAction()`**: auditoría en canal admin.
- **Utilidades**: `buildBar`, `buildHistoryField`, `buildSparkline`.

### `src/commands/dis-session.command.ts`

**Bloques clave**
- **Generación de código**: random 6 dígitos.
- **Determinación de rango**: usando `RANK_ROLES` y jerarquía por posición.
- **Persistencia**: crea/actualiza `LinkCode` y `DiscordUser`.
- **Notificación**: DM al usuario + respuesta efímera en Discord.

---

## Servicios de dominio

### `src/services/inactivityService.ts`

**Bloques clave**
- **`markInactivity()`**: crea o actualiza periodo en DB con `upsert`.
- **`clearInactivity()`**: elimina registro por `user_id`.
- **`getInactivity()`**: consulta simple por usuario.
- **`listInactivities()`**: lista por `guild_id` ordenado por fecha.
- **`getExpired()`**: filtra inactividades vencidas no notificadas.
- **`describe()`**: genera texto para administradores.
- **`deployInactivityPanel()`**: inserta o actualiza mensaje del panel.
- **`mapRow()`**: deserializa `role_snapshot` en array utilizable.

### `src/services/roleService.ts`

**Bloques clave**
- **`addRole()`**: inserta rol monitoreado.
- **`removeRole()`**: borra rol monitoreado.
- **`listRoles()`**: devuelve lista de IDs de roles monitoreados.
- **`persistSnapshot()`**: inserta estadísticas por rol.
- **`getSnapshots()`**: obtiene historial de snapshots (30 días por defecto).

---

## Scheduler y jobs recurrentes

### `src/services/scheduler.ts`

**Bloques clave**
- **`start()`**: registra intervalos:
  - `reminders`: cada `REMINDER_INTERVAL_MINUTES`.
  - `snapshots`: cada 12 horas.
- **`stop()`**: limpia timers activos.
- **`runReminders()`**:
  - Busca inactividades vencidas.
  - Notifica en canal y DM.
  - Limpia el registro en DB.
- **`captureSnapshots()`**:
  - Recorre roles monitoreados.
  - Calcula activos/inactivos.
  - Persiste estadísticas en DB.

---

## Persistencia y Prisma

### `src/prisma/database.ts`

**Bloques clave**
- **Adapter `PrismaPg`**: conecta a PostgreSQL.
- **Exporta `db`**: instancia única para reutilizar conexión.

### `src/prisma/schema.prisma`

**Modelos esenciales**

- **`InactivityPeriod`**
  - Registra inactividades con `user_id`, `guild_id`, fechas y snapshot de roles.
- **`TrackedRole`**
  - Roles seleccionados por administradores para monitoreo.
- **`RoleStatistic`**
  - Snapshot de conteos activos/inactivos por rol.
- **`LinkCode`**
  - Código temporal de vinculación de sesiones.
- **`Role`, `LinkedRole`, `Media`, `MinecraftUser`, `DiscordUser`**
  - Representan datos de usuarios y su vínculo entre Discord/Minecraft.

---

## Utilidades comunes

### `src/utils/time.ts`

**Bloques clave**
- **`parseUserTime()`**: interpreta duración o fecha absoluta.
- **`parseDuration()`**: soporta `d/h/m/s`.
- **`parseAbsolute()`**: formatos `yyyy-MM-dd`, `dd/MM/yyyy`, ISO, etc.
- **`formatForUser()`**: formatea fechas para Discord usando `<t:...>`.

---

## Ejemplos de uso actualizados

### 1) Arranque del bot

```bash
npm install
npx prisma migrate deploy
npx prisma generate
npm start
```

### 2) Desplegar comandos y panel desde variables de entorno

```bash
export DEPLOY_COMMAND=true
export DEPLOY_INACTIVITY_PANEL=true
npm start
```

### 3) Ejemplos de interacción en Discord

- **Marcar inactividad**: botón "Marcar inactividad" → modal → `3d 6h`.
- **Fecha absoluta**: modal → `2024-12-31 18:00`.
- **Administrador**:
  - `/inactividad listar`
  - `/inactividad estadisticas`
  - `/inactividad roles agregar rol:@Moderadores`

### 4) Consumo de API v1

```bash
curl -s http://localhost:3000/v1/members | jq
```

### 5) Variables mínimas de entorno

```dotenv
DISCORD_TOKEN=...
DISCORD_CLIENT_ID=...
DISCORD_GUILD_ID=...
DISCORD_INACTIVITY_CHANNEL_ID=...
DISCORD_ADMIN_LOG_CHANNEL_ID=...
DATABASE_PATH=postgresql://user:pass@host:5432/db
WHITELIST_ROUTE=/path/whitelist.json
```
