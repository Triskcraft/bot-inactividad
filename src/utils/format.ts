export function pruralize(cant: number, singular: string, plural: string) {
    return cant === 1 ? singular : plural
}

export function listMax(list: string[], max: number) {
    if (list.length === 0) return '0'
    if (max <= 0) return `y ${list.length} más`

    if (list.length <= max) {
        return list.join(', ')
    }

    const visibles = list.slice(0, max)
    const restantes = list.length - max

    return `${visibles.join(', ')} y ${restantes} más`
}

export class CustomIdParser<K extends string> {
    #groups: Record<K, string>

    constructor(regex: RegExp, customId: string) {
        const match = regex.exec(customId)

        if (!match || !match.groups) {
            throw new Error('custom_id no coincide con el patrón esperado')
        }

        this.#groups = match.groups as Record<K, string>
    }

    get(key: K): string {
        return this.#groups[key]
    }

    getAll(): Record<K, string> {
        return this.#groups
    }
}

export interface PageResult<T> {
    readonly page: number
    readonly items: T[]
    readonly hasPrev: boolean
    readonly hasNext: boolean
    readonly totalPages: number
}

export class Paginator<T> {
    #items: readonly T[]
    #peer: number
    #totalPages: number

    constructor(items: readonly T[], { peer = 10 }: { peer?: number } = {}) {
        if (peer <= 0) {
            throw new Error('perPage debe ser mayor a 0')
        }

        this.#items = items
        this.#peer = peer
        this.#totalPages = Math.max(1, Math.ceil(items.length / peer))
    }

    get(page: number): PageResult<T> {
        const current = Math.min(Math.max(1, page), this.#totalPages)

        const start = (current - 1) * this.#peer
        const end = start + this.#peer

        return {
            page: current,
            items: this.#items.slice(start, end),
            hasPrev: current > 1,
            hasNext: current < this.#totalPages,
            totalPages: this.#totalPages,
        }
    }
}
