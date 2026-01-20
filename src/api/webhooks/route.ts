import { Router } from 'express'
import members from './digs/route.ts'

const router = Router()

router.use('/digs', members)

export default router
