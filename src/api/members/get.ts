import type { Request, Response } from "express";
import { readFile } from "fs/promises";
import { envs } from "../../config.js";
import { db } from "../../prisma/database.js";
import type { Link } from "../../prisma/generated/client.js";
import { client } from "../../client.js";
import type { GuildMember, Role } from "discord.js";
import { logger } from "../../logger.js";

type Whitelist = { uuid: string; name: string }
type McId = string
type DiscordId = string

const RANK_ROLES: string[] = ["1202733002195734538", "1237979602153115728", "1355617895480164472", "1453448897136427251", "1202775128006459453", "1202775706912948264"]
const RankRolesCache = new Map<string, Role>()

export async function getMembers(req: Request, res: Response) {
    const whitelist: Whitelist[] = JSON.parse(
        await readFile(envs.WHITELIST_ROUTE, {
            encoding: 'utf-8',
        }),
    )
    const players_log = await readFile(envs.PLAYER_LIST_ROUTE, {
        encoding: 'utf-8',
    })
    const players = players_log.split('\n').filter(Boolean)
    const players_whitelis = whitelist.filter(({ name }) => players.includes(name))

    res.json(await getRank(players_whitelis))
}

async function getRank(users: Whitelist[]) {
    if (RankRolesCache.size === 0) {
        await cacheRoles()
    }
    const discord_ids = await db.link.findMany()
    const links = new Map<McId, Link>(discord_ids.map(l => [l.mc_id, l]))

    const guild = client.guilds.cache.get(envs.guildId)!

    const discord_members = new Map<DiscordId, GuildMember>((await Promise.all(users.map(async m => {
        const { discord_id } = discord_ids.find(di => normalizeUUID(di.mc_id) == normalizeUUID(m.uuid)) ?? {}

        if (!discord_id) return null

        return await guild.members.fetch(discord_id) ?? null
    }))).filter(m => m !== null).map(m => [m.id, m]))

    return users.map(u => {
        const default_response = {
            mc_name: u.name,
            mc_id: normalizeUUID(u.uuid),
            rank: "Miembro",
            // role: "Digger"
        }
        const player = links.get(u.uuid)
        if (!player) return default_response

        const member = discord_members.get(player.discord_id)
        if (!member) return default_response

        const role = member.roles.cache.find(role => RANK_ROLES.includes(role.id))
        if (!role) return default_response

        return { ...default_response, rank: role.name }
    })
}

async function cacheRoles() {
    const guild = client.guilds.cache.get(envs.guildId)!
    for (const roleId of RANK_ROLES) {
        const role = await guild.roles.fetch(roleId)
        if (!role) {
            return logger.warn(`role ${roleId} was not found`)
        }
        RankRolesCache.set(roleId, role)
    }
    console.log(RankRolesCache)
}
function normalizeUUID(uuid: string) {
    return uuid.replaceAll("-", "")
}