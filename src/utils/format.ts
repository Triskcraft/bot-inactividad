export function pruralize(cant: number, singular: string, plural: string) {
    return cant === 1 ? singular : plural
}

export function listMax(list: string[], max: number) {
    if (max <= 0) return `y ${list.length} más`

    if (list.length <= max) {
        return list.join(', ')
    }

    const visibles = list.slice(0, max)
    const restantes = list.length - max

    return `${visibles.join(', ')} y ${restantes} más`
}
