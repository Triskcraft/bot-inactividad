import { inspect } from 'node:util'
import { POST_STATUS } from '../prisma/generated/enums.ts'
import { db } from '#database'

export class Post {
    #id: string

    get id() {
        return this.#id
    }

    #title: string

    get title() {
        return this.#title
    }

    #discord_user_id: string

    get discord_user_id() {
        return this.#discord_user_id
    }

    #thread_id: string

    get thread_id() {
        return this.#thread_id
    }

    #status: POST_STATUS

    get status() {
        return this.#status
    }

    constructor({
        discord_user_id,
        id,
        status = POST_STATUS.DRAFT,
        thread_id,
        title,
    }: {
        id: string
        title: string
        discord_user_id: string
        thread_id: string
        status?: POST_STATUS
    }) {
        this.#discord_user_id = discord_user_id
        this.#id = id
        this.#status = status
        this.#thread_id = thread_id
        this.#title = title
    }

    toJSON() {
        return {
            discord_user_id: this.#discord_user_id,
            id: this.#id,
            status: this.#status,
            thread_id: this.#thread_id,
            title: this.#title,
        }
    }

    [inspect.custom]() {
        return this.toJSON()
    }

    async outdate() {
        if (this.status !== POST_STATUS.PUBLISHED) return
        await db.post.update({
            where: {
                id: this.#id,
            },
            data: {
                status: POST_STATUS.OUTDATED,
            },
        })
        this.#status = POST_STATUS.OUTDATED
    }
}
