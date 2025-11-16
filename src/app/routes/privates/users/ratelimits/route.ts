import { ExpressRouter } from 'kusto-framework-core'
const router = new ExpressRouter();


router
.CRUD('default', 'userRateLimit', {
    only: ['index', 'show']
})

export default router.build();