import { render } from '#/utils/html.ts'
import { Router } from 'express'
import { Layout } from '#/api/console/components/layout.ts'

const router = Router()

router.get('/', (req, res) => {
    console.log(req.cookies)

    render(
        res,
        Layout({
            children: 'ok',
        }),
    )
})

export default router
