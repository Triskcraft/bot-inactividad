export class Result<T, E> {
    isSuccess = false
    #value?: T
    #error?: E

    private constructor(isSuccess: boolean, error?: E, value?: T) {
        this.isSuccess = isSuccess
        if (error) {
            this.#error = error
        }
        if (value) {
            this.#value = value
        }
    }

    static ok<U>(value?: U): Result<U, never> {
        return new Result<U, never>(true, undefined, value)
    }

    static err<F>(error: F): Result<never, F> {
        return new Result<never, F>(false, error, undefined)
    }

    get value() {
        return this.#value
    }

    get error() {
        return this.#error
    }
}
