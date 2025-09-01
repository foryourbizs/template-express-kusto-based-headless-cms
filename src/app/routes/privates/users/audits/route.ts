import { ExpressRouter } from '@lib/expressRouter'
const router = new ExpressRouter();


router
.CRUD('default', 'userAuditLog', {
    only: ['index', 'show'],
    primaryKey: 'uuid'
})

export default router.build();