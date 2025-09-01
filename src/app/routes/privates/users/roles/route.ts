import { ExpressRouter } from '@lib/expressRouter'
const router = new ExpressRouter();


router
.CRUD('default', 'role', {
    primaryKey: 'uuid'
})

export default router.build();