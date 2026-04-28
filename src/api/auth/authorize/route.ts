import { db } from '#/db/prisma.ts'
import { render } from '#/utils/html.ts'
import { ErrorCard } from '#/web/components/error-card.ts'
import { Layout } from '#/web/components/layout.ts'
import { Router } from 'express'

const router = Router()

router.get('/', async (req, res) => {
    const {
        response_type,
        client_id,
        redirect_uri,
        code_challenge,
        code_challenge_method,
        state,
    } = req.query

    if (response_type !== 'code') {
        return render(
            res,
            Layout({
                children: ErrorCard({
                    code: 400,
                    title: 'Bad Request',
                    message: 'Invalid response_type. Only "code" is supported.',
                }),
            }),
        )
    }
    if (!client_id) {
        return render(
            res,
            Layout({
                children: ErrorCard({
                    code: 400,
                    title: 'Bad Request',
                    message: 'Missing client_id.',
                }),
            }),
        )
    }
    if (typeof client_id !== 'string') {
        return render(
            res,
            Layout({
                children: ErrorCard({
                    code: 400,
                    title: 'Bad Request',
                    message: 'Invalid client_id.',
                }),
            }),
        )
    }
    if (!redirect_uri) {
        return render(
            res,
            Layout({
                children: ErrorCard({
                    code: 400,
                    title: 'Bad Request',
                    message: 'Missing redirect_uri.',
                }),
            }),
        )
    }
    if (typeof redirect_uri !== 'string') {
        return render(
            res,
            Layout({
                children: ErrorCard({
                    code: 400,
                    title: 'Bad Request',
                    message: 'Invalid redirect_uri.',
                }),
            }),
        )
    }
    if (!code_challenge) {
        return render(
            res,
            Layout({
                children: ErrorCard({
                    code: 400,
                    title: 'Bad Request',
                    message: 'Missing code_challenge.',
                }),
            }),
        )
    }
    if (code_challenge_method !== 'S256') {
        return render(
            res,
            Layout({
                children: ErrorCard({
                    code: 400,
                    title: 'Bad Request',
                    message:
                        'Invalid code_challenge_method. Only "S256" is supported.',
                }),
            }),
        )
    }

    const client = await db.client.findUnique({
        where: { key: client_id },
    })

    if (!client) {
        return render(
            res,
            Layout({
                children: ErrorCard({
                    code: 400,
                    title: 'Bad Request',
                    message:
                        'Invalid client_id. No client found with the provided client_id.',
                }),
            }),
        )
    }

    if (!client.redirect_uris.includes(redirect_uri)) {
        return render(
            res,
            Layout({
                children: ErrorCard({
                    code: 400,
                    title: 'Bad Request',
                    message:
                        'Invalid redirect_uri. The provided redirect_uri is not registered for the given client_id.',
                }),
            }),
        )
    }

    render(
        res,
        Layout({
            children: ErrorCard({
                title: 'Not Implemented',
                message: 'The authorization endpoint is not implemented yet.',
            }),
        }),
    )
})

export default router
