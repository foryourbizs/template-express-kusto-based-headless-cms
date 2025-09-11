import { ExpressRouter } from '@lib/expressRouter'
const router = new ExpressRouter();


router
.CRUD('default', 'siteMenu', {
    primaryKey: 'uuid'
})

export default router.build();