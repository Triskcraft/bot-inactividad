import { Router } from 'express'
import digs from '#/api/webhooks/digs/route.ts'
import link from '#/api/webhooks/link/route.ts'
import join from '#/api/webhooks/join/route.ts'
import { webhookAuth } from '#/api/webhook-auth.middleware.ts'
import { WEBHOOK_PERMISSIONS } from '#/config.ts'

const router = Router()

router.use('/digs', webhookAuth([WEBHOOK_PERMISSIONS.DIGS]), digs)
router.use('/link', webhookAuth([WEBHOOK_PERMISSIONS.LINK]), link)
router.use('/join', webhookAuth([WEBHOOK_PERMISSIONS.JOIN]), join)

export default router
