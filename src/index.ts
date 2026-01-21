import { app } from './api/server.ts'
import { client } from './client.ts'
import { envs } from './config.ts'
import { logger } from '#logger'
import { db } from './prisma/database.ts'
import { inactivityService } from '#inactivity.service'
import { interactionService } from '#interactions.service'
import { deployAdminPanel } from './services/panel.ts'
import { roleService } from '#role.service'
import { Scheduler } from './services/scheduler.ts'
import { createHmac } from 'node:crypto'

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
 * Punto de entrada principal del bot. Aquí se inicializan los servicios
 * compartidos (API HTTP, cliente de Discord, acceso a base de datos y
 * planificador) y se orquestan las tareas de arranque y apagado seguro.
 */
app.listen(envs.API_PORT, async () => {
    logger.info(`api listening on port ${envs.API_PORT}`)

    function signPayload(secret: string, payload: string) {
        return createHmac('sha256', secret).update(payload).digest('hex')
    }

    const WEBHOOK_URL = 'http://localhost:3000/webhooks/digs'

    const JWT =
        'eyJhbGciOiJIUzI1NiJ9.eyJpZCI6Ijg0ODA4Njc2MTQ5Mjk3MTU2IiwidXNlciI6IjUzNDYxNDAyNTI3MTc3MTE1OCIsInBlcm1pc3Npb25zIjpbImRpZ3MiXSwibmFtZSI6InRlc3QiLCJpYXQiOjE3Njg5NTU5NjR9.KW955EptswY2c4zMQYKPi3S1MQsrOQHkaLZBiWZGxhQ'
    const SECRET =
        '205c73836d444ece9480019e745a225f815f17197c1c17d661ca9c8f794e4dc4'

    const payload = [
        {
            nickname: 'eliyya',
            digs: 5,
        },
        {
            uuid: '3151a5bc-15ff-48ba-8683-5cd7901f1381',
            digs: 69,
        },
    ]

    // ⚠️ stringify UNA sola vez
    const body = JSON.stringify(payload)

    const timestamp = Math.floor(Date.now() / 1000)

    // firma sobre el raw body
    const signature = signPayload(SECRET, `${timestamp}.${body}`)

    const res = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${JWT}`,
            'X-Signature': signature,
            'X-Timestamp': timestamp.toString(),
            'Content-Type': 'application/json',
        },
        body,
    })

    const text = await res.text()

    console.log(res.status, text)
})

/**
 * Los servicios principales se comparten en todo el proyecto para permitir
 * coordinación entre las interacciones de Discord y la API HTTP.
 */
const scheduler = new Scheduler(inactivityService, roleService)
await interactionService.registerInteractionHandlers()

if (envs.DEPLOY_INACTIVITY_PANEL) {
    // Despliega (o actualiza) el panel de botones en el canal configurado.
    await inactivityService.deployInactivityPanel()
} else {
    logger.info('Saltando el despliegue del panel de inactividad')
}
await deployAdminPanel()
// Activa los jobs programados que mantienen el sistema actualizado.
scheduler.start()
