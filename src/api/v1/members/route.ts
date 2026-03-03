import { Router } from 'express'
import { getMembers } from '#/api/v1/members/get.ts'

const router = Router()

router.get('/', getMembers)

export default router
