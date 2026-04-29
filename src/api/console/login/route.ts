import { envs } from '#/config.ts'
import type { DiscordAccessTokenResponse } from '#/utils/api.ts'
import { Router } from 'express'

const router = Router()

router.get('/', async (req, res) => {
    const { code } = req.query

    if (!code) {
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

    const request = await fetch('/auth/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: JSON.stringify({
            grant_type: 'authorization_code',
            code,
            redirect_uri: envs.CONSOLE_LOGIN_REDIRECT,
            client_id: 'api-console',
            code_verifier: '',
        }),
    })

    const response = (await request.json()) as Omit<
        DiscordAccessTokenResponse,
        'scope'
    >

    res.cookie('console-session', JSON.stringify(response))

    res.redirect('/console')
})

export default router
