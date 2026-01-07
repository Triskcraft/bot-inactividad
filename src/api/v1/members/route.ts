import { Router } from 'express'
import { getMembers } from './get.ts'

const router = Router()

router.get('/', getMembers)

export default router
