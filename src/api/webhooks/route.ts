import { Router } from 'express'
import members from '#/api/webhooks/digs/route.ts'
import link from '#/api/webhooks/link/route.ts'
import { webhookAuth } from '#/api/webhook-auth.middleware.ts'

const router = Router()

router.use('/digs', webhookAuth(['digs']), members)
router.use('/link', webhookAuth(['link']), link)

export default router
