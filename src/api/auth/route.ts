import { Router } from 'express'
import authorize from '#/api/auth/authorize/route.ts'
import discord from '#/api/auth/discord/route.ts'
import token from '#/api/auth/token/route.ts'

const router = Router()

router.use('/authorize', authorize)
router.use('/discord', discord)
router.use('/token', token)

export default router
