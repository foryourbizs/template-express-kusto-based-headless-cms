import { ExpressRouter } from '@lib/expressRouter'
const router = new ExpressRouter();


router
.CRUD('default', 'userPermission', {
    primaryKey: 'uuid'
})

export default router.build();