import Express, { type ErrorRequestHandler } from 'express'
import cors from 'cors'
import v1 from './v1/route.ts'
import webhooks from './webhooks/route.ts'
import { AppError } from './errors.ts'
import { logger } from '#logger'

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

const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
    if (err instanceof AppError) {
        const details = err.cause ?? {}
        return res.status(err.statusCode).json({
            ...details,
            error: err.message,
        })
    }

    logger.error(err, `Error en la ruta ${req.path}`)

    return res.status(500).json({
        error: 'Internal Server Error',
    })
}

app.use(errorHandler)

app.use('/v1', Express.json({ type: 'application/json' }), v1)
app.use('/webhooks', Express.raw({ type: 'application/json' }), webhooks)

export { app }
