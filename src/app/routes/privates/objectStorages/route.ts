import { ExpressRouter } from '@lib/expressRouter'
const router = new ExpressRouter();


router
.CRUD('default', 'objectStorages', {
    primaryKey: 'uuid'
})

export default router.build();