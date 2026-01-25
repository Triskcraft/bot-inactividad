import { Router } from 'express'
import members from './digs/route.ts'
import link from './link/route.ts'
import { webhookAuth } from '../webhook-auth.middleware.ts'

const router = Router()

router.use('/digs', webhookAuth(['digs']), members)
router.use('/link', webhookAuth(['link']), link)

export default router
