# Sistema de inactividad y estadísticas

## Qué problema resuelve

Permite que miembros reporten ausencias sin intervención manual de staff, mientras los administradores obtienen control y métricas históricas.

## Flujo de usuario (autogestión)

Panel de inactividad (`src/services/inactivity.service.ts` + botón `src/interactions/buttons/inactivity.ts`):

- **Marcar/Modificar**: abre modal con fecha o duración.
- **Desmarcar**: elimina registro vigente.
- **Mostrar estado**: consulta fecha final de inactividad.

El modal procesa entradas en `src/interactions/modals/inactive.ts`, usando utilidades de tiempo (`src/utils/time.ts`).

## Flujo administrativo

Slash command `inactividad` (`src/interactions/commands/inactividad.command.ts`):

- `listar`: miembros activos vs inactivos para roles monitorizados.
- `estadisticas`: porcentajes por rol + historial tipo sparkline.
- `roles agregar/eliminar/listar`: administración de alcance de monitoreo.

## Persistencia

Tabla principal: `InactivityPeriod`.

Campos clave:

- `user_id`: único por usuario (una inactividad activa por usuario).
- `role_snapshot`: copia de roles al momento de declarar.
- `ends_at` y `notified`: control de vencimiento y notificación.

## Recordatorios automáticos

`Scheduler.runReminders()`:

1. Consulta inactividades vencidas y no notificadas.
2. Envía aviso en canal de inactividad.
3. Intenta DM al usuario.
4. Limpia registro para devolverlo al estado activo.

**Por qué existe:** cerrar el ciclo automáticamente y evitar registros obsoletos.

## Estadísticas históricas

`Scheduler.captureSnapshots()` crea snapshots por rol monitorizado cada 12 horas:

- `inactive_count`
- `active_count`
- `captured_at`

Esas capturas alimentan el histórico en `/inactividad estadisticas`.

**Por qué existe:** ver tendencia, no solo foto puntual.

## Relación con `monitored.service.ts`

Ese servicio define qué roles entran al análisis y administra snapshots en BD.
