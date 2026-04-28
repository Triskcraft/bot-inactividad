import type { Request } from 'express'

export function getSession(req: Request) {
    const discord = getDiscordAccessCookie(req)
    return { discord }
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
