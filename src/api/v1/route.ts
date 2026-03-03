import { Router } from 'express'
import members from '#/api/v1/members/route.ts'

const router = Router()

router.use('/members', members)

export default router
