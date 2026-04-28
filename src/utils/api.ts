import { PUBLIC_KEY } from '#/config.ts'
import type { Request } from 'express'
import { jwtVerify } from 'jose'

export async function getSession(req: Request) {
    const discord = getDiscordAccessCookie(req)
    const session = await getSessionCookie(req)
    return { discord, session }
}

export function getOauthCtxCookie(req: Request) {
    try {
        return JSON.parse(req.cookies['oauth_ctx']) // TODO: validate this
    } catch {
        return null
    }
}

interface DiscordAccessTokenResponse {
    token_type: 'Bearer'
    access_token: string
    expires_in: number
    refresh_token: string
    scope: string
}
export function getDiscordAccessCookie(req: Request) {
    try {
        return JSON.parse(
            req.cookies['discord_access'],
        ) as DiscordAccessTokenResponse // TODO: validate this as {DiscordAccessTokenResponse}
    } catch {
        return null
    }
}
// interface DiscordAccessTokenResponse {
//     token_type: 'Bearer'
//     access_token: string
//     expires_in: number
//     refresh_token: string
//     scope: string
// }
export async function getSessionCookie(req: Request) {
    try {
        const cookie = req.cookies['session'] ?? '' // TODO: validate this as {DiscordAccessTokenResponse}
        return await jwtVerify(cookie, PUBLIC_KEY)
    } catch {
        return null
    }
}
