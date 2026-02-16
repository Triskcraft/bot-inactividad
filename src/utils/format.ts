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
