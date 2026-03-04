# Webhooks y seguridad

## Qué resuelve este módulo

El sistema de webhooks permite que servicios externos (por ejemplo, backend web o procesos del servidor Minecraft) envíen datos al bot de forma segura.

## Endpoints

## `POST /webhooks/digs`

**Para qué existe:** actualizar de forma masiva y eficiente el contador `digs` de jugadores Minecraft.

**Cómo funciona:**

1. Recibe un array de objetos con `uuid` o `nickname` y `digs`.
2. Valida payload con Zod.
3. Encola actualizaciones en memoria (`Map`).
4. Un proceso cada 10 segundos consolida y persiste en BD.

**Por qué está diseñado así:** evita saturar la base con escrituras por cada evento individual.

## `POST /webhooks/link`

**Para qué existe:** cerrar el flujo de vinculación Discord ↔ Minecraft usando un código temporal (`/dis-session`).

**Cómo funciona:**

1. Valida `nickname` y `code`.
2. Busca `LinkCode` válido.
3. Obtiene miembro Discord y calcula rango actual.
4. Convierte nickname a UUID usando Mojang API.
5. Hace transacción: `upsert` de `minecraft_player` + eliminación del código.

**Por qué está diseñado así:** garantiza que el código se use una sola vez y que los datos queden consistentes.

## Capa de seguridad: `webhookAuth`

Cada webhook pasa por middleware de autenticación y firma.

## Requisitos de la request

- `Authorization: Bearer <jwt>`
- `x-timestamp: <epoch_seconds>`
- `x-signature: <hmac_sha256_hex>`
- body crudo JSON (`Express.raw`)

## Validaciones aplicadas

1. **JWT válido** (firma + claims).
2. **Permisos del token** (`digs`, `link`) según ruta.
3. **Ventana temporal** con tolerancia de drift (anti-replay).
4. **Firma HMAC** sobre `timestamp.body` con secreto cifrado en BD.
5. **Comparación segura** con `timingSafeEqual`.

## Panel de webhooks (Discord)

`src/services/webhook.service.ts` publica un panel administrativo para:

- listar tokens,
- crear token con permisos,
- eliminar token.

### Creación de token

- Se genera un `secret` aleatorio.
- Se cifra (`AES-256-GCM`) para guardar en BD.
- Se emite JWT firmado.
- Token y secret se muestran **solo una vez**.

**Por qué existe este patrón:** minimiza exposición de credenciales y permite revocación inmediata borrando el token.

## Riesgos mitigados

- Reutilización de requests viejas.
- Alteración de payload en tránsito.
- Uso de tokens en rutas no autorizadas.
- Ataques de timing en validación de firma.
