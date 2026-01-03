import { app } from './api/server.ts'
import { client } from './client.ts'
import { envs } from './config.ts'
import { registerInteractionHandlers } from './handlers/interactionHandler.ts'
import { logger } from './logger.ts'
import { db } from './prisma/database.ts'
import { InactivityService } from './services/inactivityService.ts'
import { RoleService } from './services/roleService.ts'
import { Scheduler } from './services/scheduler.ts'

app.listen(envs.API_PORT, () => {
    logger.info(`api listening on port ${envs.API_PORT}`)
})

async function shutdown(signal: string) {
    logger.info({ signal }, 'Cerrando bot')
    scheduler.stop()
    await client.destroy()
    await db.$disconnect()
    process.exit(0)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

const inactivityService = new InactivityService()
const roleService = new RoleService()
const scheduler = new Scheduler(inactivityService, roleService)
registerInteractionHandlers({ inactivityService, roleService })
if (envs.DEPLOY_INACTIVITY_PANEL) {
    await inactivityService.deployInactivityPanel()
} else {
    logger.info('Saltando el despliegue del panel de inactividad')
}
scheduler.start()
