import { ExpressRouter } from '@lib/expressRouter'
const router = new ExpressRouter();


router
.CRUD('default', 'analyticsUniqueVisitor', {
    primaryKey: 'uuid',
    only: ['index', 'show']
})

export default router.build();