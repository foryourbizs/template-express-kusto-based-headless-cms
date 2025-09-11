import { ExpressRouter } from '@lib/expressRouter'
const router = new ExpressRouter();


router
.CRUD('default', 'post', {
    primaryKey: 'uuid'
})

export default router.build();