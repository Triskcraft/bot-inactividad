import { Router } from 'express'

const router = Router()

router.post('/', (req, res) => {
    res.send('ok')
})

export default router
