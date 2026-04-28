import { Router } from 'express'
import members from '#/api/auth/authorize/route.ts'

const router = Router()

router.use('/members', members)

export default router
