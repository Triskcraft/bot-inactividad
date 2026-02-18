import { Temporal } from '@js-temporal/polyfill'

Map.prototype.getOrInsert = function (key, defaultValue) {
    if (!this.has(key)) {
        this.set(key, defaultValue)
    }
    return this.get(key)
}

Map.prototype.getOrInsertComputed = function (key, callbackFunction) {
    if (!this.has(key)) {
        this.set(key, callbackFunction(key))
    }
    return this.get(key)
}

// @ts-expect-error ignore
globalThis.Temporal = Temporal
