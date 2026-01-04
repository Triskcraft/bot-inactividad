import { app } from './api/server.ts'
import { client } from './client.ts'
import { envs } from './config.ts'
import { registerInteractionHandlers } from './handlers/interactionHandler.ts'
import { logger } from './logger.ts'
import { db } from './prisma/database.ts'
import { InactivityService } from './services/inactivityService.ts'
import { RoleService } from './services/roleService.ts'
import { Scheduler } from './services/scheduler.ts'

/**
 * Punto de entrada principal del bot. Aquí se inicializan los servicios
 * compartidos (API HTTP, cliente de Discord, acceso a base de datos y
 * planificador) y se orquestan las tareas de arranque y apagado seguro.
 */
app.listen(envs.API_PORT, () => {
    logger.info(`api listening on port ${envs.API_PORT}`)
})

/**
 * Maneja el apagado ordenado del proceso, garantizando que cada componente
 * libere sus recursos antes de finalizar.
 */
async function shutdown(signal: string) {
    logger.info({ signal }, 'Cerrando bot')
    scheduler.stop()
    await client.destroy()
    await db.$disconnect()
    process.exit(0)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

/**
 * Los servicios principales se comparten en todo el proyecto para permitir
 * coordinación entre las interacciones de Discord y la API HTTP.
 */
const inactivityService = new InactivityService()
const roleService = new RoleService()
const scheduler = new Scheduler(inactivityService, roleService)
registerInteractionHandlers({ inactivityService, roleService })
if (envs.DEPLOY_INACTIVITY_PANEL) {
    // Despliega (o actualiza) el panel de botones en el canal configurado.
    await inactivityService.deployInactivityPanel()
} else {
    logger.info('Saltando el despliegue del panel de inactividad')
}
// Activa los jobs programados que mantienen el sistema actualizado.
scheduler.start()
