import { ExpressRouter } from '@lib/expressRouter'
const router = new ExpressRouter();


router
.CRUD('default', 'permission', {
    primaryKey: 'uuid'
})

export default router.build();