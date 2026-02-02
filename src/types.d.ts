declare global {
    namespace Express {
        type SessionStore = session.Store & { generate: (req: Request) => void }
        interface Request {
            user: {
                id: string
            } | null
        }
    }
}

export {}
