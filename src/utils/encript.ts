import { envs } from '#config'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGO = 'aes-256-gcm'

export function encrypt(plaintext: string) {
    const iv = randomBytes(12) // recomendado para GCM

    const cipher = createCipheriv(ALGO, envs.ENCRYPT_KEY, iv)

    const encrypted = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final(),
    ])

    const tag = cipher.getAuthTag()
    const ivr = iv.toString('base64')
    const contentr = encrypted.toString('base64')
    const tagr = tag.toString('base64')

    return {
        iv: ivr,
        content: contentr,
        tag: tagr,
        payload: `${ivr}:${contentr}:${tagr}`,
    }
}

export function decrypt(encrypted: string) {
    const [iv = '', content = '', tag = ''] = encrypted.split(':')
    const decipher = createDecipheriv(
        ALGO,
        envs.ENCRYPT_KEY,
        Buffer.from(iv, 'base64'),
    )

    decipher.setAuthTag(Buffer.from(tag, 'base64'))

    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(content, 'base64')),
        decipher.final(),
    ])

    return decrypted.toString('utf8')
}
