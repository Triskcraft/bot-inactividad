import { Router } from 'express'

const router = Router()

router.post('/', async (req, res) => {
    return res.json({
        token_type: 'Bearer',
        expires_in: 60 * 60 * 24,
    })
})

export default router
