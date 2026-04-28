import { Router } from 'express'

const router = Router()

router.get('/', (req, res) => {
    const {
        response_type,
        client_id,
        redirect_uri,
        code_challenge,
        code_challenge_method,
        state,
    } = req.query
    res.send('in progress')
})

export default router
