import Express from 'express'
import cors from 'cors'
import v1 from './v1/route.ts'
import webhooks from './webhooks/route.ts'
import { webhookAuth } from './webhook-auth.middleware.ts'

/**
 * Servidor HTTP mínimo que expone endpoints de lectura para integraciones
 * externas (por ejemplo, paneles web). Se mantiene desacoplado del cliente
 * de Discord para permitir despliegues independientes.
 */
const app = Express()

app.use(
    cors({
        origin: process.env.FRONT_ORIGIN,
    }),
)

app.use('/v1', Express.json({ type: 'application/json' }), v1)
app.use(
    '/webhooks',
    Express.raw({ type: 'application/json' }),
    webhookAuth,
    webhooks,
)

export { app }
