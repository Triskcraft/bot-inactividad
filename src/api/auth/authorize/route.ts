import { envs } from '#/config.ts'
import { db } from '#/db/prisma.ts'
import { getSession } from '#/utils/api.ts'
import { render } from '#/utils/html.ts'
import { ErrorCard } from '#/web/components/error-card.ts'
import { Layout } from '#/web/components/layout.ts'
import { Router } from 'express'
import cookieParser from 'cookie-parser'
import type { APIUser } from 'discord.js'

const router = Router()

router.get('/', cookieParser(), async (req, res) => {
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

    const session = getSession(req)
    if (!session.discord) {
        // login
        res.cookie(
            'oauth_ctx',
            JSON.stringify({
                response_type,
                client_id,
                redirect_uri,
                code_challenge,
                code_challenge_method,
                state,
            }),
            {
                httpOnly: true,
                secure: true,
                sameSite: 'lax',
            },
        )
        return res.redirect(
            `https://discord.com/oauth2/authorize?client_id=${envs.DISCORD_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(envs.DISCORD_REDIRECT_URI)}&scope=identify`,
        )
    }

    const request = await fetch('https://discord.com/api/v10/users/@me', {
        headers: {
            Authorization: `Bearer ${session.discord.access_token}`,
        },
    })
    const discordUser = (await request.json()) as APIUser

    const user = await db.user.upsert({
        create: {
            discord_user: {
                connectOrCreate: {
                    where: { id: discordUser.id },
                    create: {
                        id: discordUser.id,
                        username: discordUser.username,
                    },
                },
            },
        },
        where: {
            discord_user_id: discordUser.id,
        },
        update: {
            discord_user: {
                update: {
                    username: discordUser.username,
                },
            },
        },
    })

    console.log(user)

    res.json(user)
    // render(
    //     res,
    //     Layout({
    //         children: ErrorCard({
    //             title: 'Not Finished',
    //             message: 'The authorization endpoint is not finished yet.',
    //         }),
    //     }),
    // )
})

export default router

// test http://localhost:8080/auth/authorize?response_type=code&client_id=api-panel&code_challenge=eIVsW83uLPZmbiKwsR7J86HuUoMqpAWFuoLyo36gpaU&code_challenge_method=S256&redirect_uri=http://localhost:8080/auth/callback
