import { BadRequestError } from '#/api/errors.ts'
import { envs, PRIVATE_KEY } from '#/config.ts'
import { db } from '#/db/prisma.ts'
import { verifyPKCE } from '#/utils/encript.ts'
import { Router } from 'express'
import { SignJWT } from 'jose'

const router = Router()

router.post('/', async (req, res) => {
    const { grant_type, code, redirect_uri, client_id, code_verifier } =
        req.body
    if (grant_type !== 'authorization_code') {
        throw new BadRequestError(
            'Invalid grant_type. Expected "authorization_code".',
        )
    }
    if (!code) {
        throw new BadRequestError('Missing parameter: code is required.')
    }
    if (!client_id) {
        throw new BadRequestError('Missing parameter: client_id is required.')
    }
    if (!redirect_uri) {
        throw new BadRequestError(
            'Missing parameter: redirect_uri is required.',
        )
    }
    if (!code_verifier) {
        throw new BadRequestError(
            'Missing parameter: code_verifier is required (PKCE).',
        )
    }
    const authCode = await db.authorizationCode.findUnique({
        where: { code },
    })
    if (!authCode) {
        throw new BadRequestError(
            'The provided authorization code is invalid or not found.',
        )
    }

    if (authCode.expires_at < new Date()) {
        await db.authorizationCode.delete({
            where: { code },
        })
        throw new BadRequestError(
            'The authorization code has expired. Please request a new one.',
        )
    }

    if (!verifyPKCE(code_verifier, authCode.code_challenge)) {
        throw new BadRequestError(
            'PKCE verification failed: code_verifier does not match code_challenge.',
        )
    }
    const { user_id } = await db.authorizationCode.delete({
        where: { code },
    })

    const expires_at = new Date(
        Temporal.Now.instant().add({
            days: 7,
        }).epochMilliseconds,
    )

    const session = await db.session.create({
        data: {
            expires_at,
            client_id,
            user_id,
        },
    })

    const access_token = await new SignJWT({
        session_id: session.id,
        sub: authCode.user_id,
        client_id,
    })
        .setProtectedHeader({ alg: 'RS256' })
        .setIssuedAt()
        .setIssuer(envs.API_URL)
        .setAudience(client_id)
        .setExpirationTime('1d')
        .sign(PRIVATE_KEY)

    const refresh_token = await new SignJWT({
        session_id: session.id,
        sub: authCode.user_id,
        client_id,
    })
        .setProtectedHeader({ alg: 'RS256' })
        .setIssuedAt()
        .setIssuer(envs.API_URL)
        .setAudience(client_id)
        .setExpirationTime('7d')
        .sign(PRIVATE_KEY)

    return res.json({
        access_token,
        token_type: 'Bearer',
        expires_in: 60 * 60 * 24,
        refresh_token,
    })
})

export default router
