import { Router } from 'express'
import { getPosts } from '#/api/v1/posts/get.ts'

const router = Router()

router.get('/', getPosts)

export default router
