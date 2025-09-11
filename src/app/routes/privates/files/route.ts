import { ExpressRouter } from '@lib/expressRouter'
const router = new ExpressRouter();


router
.CRUD('default', 'files', {
    primaryKey: 'uuid'
})

export default router.build();