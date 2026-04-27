import { html } from '#/utils/html.ts'
import { Router } from 'express'
import mods from './mods/route.ts'
import { Layout } from './components/layout.ts'

const router = Router()

router.use('/mods', mods)
router.get('/', (req, res) => {
    res.send(
        Layout({
            children: html`
                <div class="container">
                    <h1>Herramientas de Consola</h1>

                    <nav class="menu-links">
                        <a href="/console/mods" class="btn">Upload SMP Mods</a>
                        <!-- <a href="https://google.com" class="btn"
                                        >Enlace Externo</a
                                    > -->
                    </nav>
                </div>
            `,
        }),
    )
})

export default router
