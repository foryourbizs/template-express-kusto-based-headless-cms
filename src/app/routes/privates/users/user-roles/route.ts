import { ExpressRouter } from '@lib/expressRouter'
const router = new ExpressRouter();


router
.CRUD('default', 'userRole', {
    primaryKey: 'uuid'
})

export default router.build();