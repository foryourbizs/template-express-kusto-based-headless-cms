import { ExpressRouter } from 'kusto-framework-core'
const router = new ExpressRouter();


router
.CRUD('default', 'userSecurityEvent', {
    only: ['index', 'show'],
    primaryKey: 'uuid'
})

export default router.build();