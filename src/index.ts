import { app } from './api/server.js'
import { client } from './client.js'
import { envs } from './config.js'
import { registerInteractionHandlers } from './handlers/interactionHandler.js'
import { logger } from './logger.js'
import { db } from './prisma/database.js'
import { InactivityService } from './services/inactivityService.js'
import { RoleService } from './services/roleService.js'
import { Scheduler } from './services/scheduler.js'

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
scheduler.start()
