import { ExpressRouter } from '@lib/expressRouter'
const router = new ExpressRouter();


router
.CRUD('default', 'analyticsEvent', {
    primaryKey: 'id',
    only: ['index', 'show']
})

export default router.build();