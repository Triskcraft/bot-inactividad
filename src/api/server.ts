import Express from 'express'
import cors from 'cors'
import { getMembers } from './members/get.ts'

const app = Express()

app.use(Express.json())
app.use(
    cors({
        origin: process.env.FRONT_ORIGIN,
    }),
)

app.get('/members', getMembers)

export { app }
