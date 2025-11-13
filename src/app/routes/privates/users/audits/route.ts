import { ExpressRouter } from 'kusto-framework-core'
const router = new ExpressRouter();


router
.CRUD('default', 'userAuditLog', {
    only: ['index', 'show'],
    primaryKey: 'uuid'
})

export default router.build();