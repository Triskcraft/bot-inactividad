import { Router } from 'express'
import members from './members/route.ts'

const router = Router()

router.use('/members', members)

export default router
