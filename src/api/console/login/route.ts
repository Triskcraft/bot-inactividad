import { render } from '#/utils/html.ts'
import { Layout } from '#/web/components/layout.ts'
import { Router } from 'express'

const router = Router()

router.get('/', (req, res) => {
    if (req.query.code) {
        return res.redirect(
            `/auth/authorize?${new URLSearchParams({
                response_type: 'code',
                client_id: 'api-panel',
                code_challenge: 'eIVsW83uLPZmbiKwsR7J86HuUoMqpAWFuoLyo36gpaU', // TODO: dynamic
                code_challenge_method: 'S256',
                redirect_uri: 'http://localhost:8080/console/login',
            })}`,
        )
    }

    render(
        res,
        Layout({
            children: 'ok',
        }),
    )
})

export default router
