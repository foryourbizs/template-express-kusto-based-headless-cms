import { ExpressRouter } from '@lib/expressRouter'
const router = new ExpressRouter();


router
.CRUD('default', 'userSession', {
    primaryKey: 'uuid'
})

export default router.build();