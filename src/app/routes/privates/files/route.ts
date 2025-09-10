import { ExpressRouter } from '@lib/expressRouter'
const router = new ExpressRouter();


router
.CRUD('default', 'file', {
    primaryKey: 'uuid'
})

export default router.build();