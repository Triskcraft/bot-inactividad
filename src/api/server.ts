import Express from 'express'
import cors from 'cors'
import { getMembers } from './members/get.ts'

/**
 * Servidor HTTP mínimo que expone endpoints de lectura para integraciones
 * externas (por ejemplo, paneles web). Se mantiene desacoplado del cliente
 * de Discord para permitir despliegues independientes.
 */
const app = Express()

app.use(Express.json())
app.use(
    cors({
        origin: process.env.FRONT_ORIGIN,
    }),
)

app.get('/members', getMembers)

export { app }
