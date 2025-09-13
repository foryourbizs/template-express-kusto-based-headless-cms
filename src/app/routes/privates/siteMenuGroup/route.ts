import { ExpressRouter } from '@lib/expressRouter'
const router = new ExpressRouter();


router
.CRUD('default', 'siteMenuGroupKey', {
    primaryKey: 'uuid'
})

export default router.build();