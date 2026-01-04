import { DateTime, Duration } from 'luxon'

/**
 * Intenta interpretar un texto como duracion o fecha absoluta.
 * @param input Texto ingresado por el usuario.
 */
export function parseUserTime(input: string, now = new Date()) {
    const trimmed = input.trim()
    const base = DateTime.fromJSDate(now).toUTC()

    // Primero se intenta interpretar como duración relativa (ej. "3d 4h").
    const duration = parseDuration(trimmed)
    if (duration) {
        return { until: base.plus(duration), isDuration: true }
    }

    // Si no es duración, se prueba con formatos absolutos reconocidos.
    const absolute = parseAbsolute(trimmed, base.zone)
    if (absolute) {
        return { until: absolute, isDuration: false }
    }

    throw new Error(
        'No se pudo interpretar la fecha o duración proporcionada. Usa ejemplos como "3d", "2h30m" o "2024-05-31 18:00".',
    )
}

/**
 * Interpreta una cadena como duración relativa en días, horas, minutos o
 * segundos usando un formato flexible (ej. "1d 2h30m").
 */
function parseDuration(value: string) {
    const regex =
        /^\s*(?:(\d+)\s*d)?\s*(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*(?:(\d+)\s*s)?\s*$/i
    const match = value.match(regex)
    if (!match) {
        return null
    }

    // Extrae cada componente temporal y convierte a números.
    const [, days, hours, minutes, seconds] = match.map(segment =>
        segment ? Number.parseInt(segment, 10) : 0,
    )
    if (!days && !hours && !minutes && !seconds) {
        return null
    }

    return Duration.fromObject({ days, hours, minutes, seconds })
}

/**
 * Interpreta una cadena como fecha absoluta usando varios formatos comunes
 * y respeta la zona horaria actual del usuario.
 */
function parseAbsolute(value: string, zone: DateTime['zone']) {
    const patterns = [
        'yyyy-MM-dd HH:mm',
        "yyyy-MM-dd'T'HH:mm",
        'yyyy-MM-dd',
        'dd/MM/yyyy HH:mm',
        'dd/MM/yyyy',
    ]

    for (const format of patterns) {
        const dt = DateTime.fromFormat(value, format, { zone })
        if (dt.isValid) {
            return dt.toUTC()
        }
    }

    // Finalmente se intenta interpretar como fecha ISO estándar.
    const iso = DateTime.fromISO(value, { zone })
    if (iso.isValid) {
        return iso.toUTC()
    }

    return null
}

/**
 * Formatea una fecha para presentar al usuario en su huso horario.
 */
export function formatForUser(until: Date) {
    const secconds = Math.floor(until.getTime() / 1000)
    return `<t:${secconds}:F> (restan <t:${secconds}:R>)`
}
