import { ExpressRouter } from '@lib/expressRouter'
const router = new ExpressRouter();


router
.CRUD('default', 'siteMenu', {
    primaryKey: 'uuid',
    includeMerge: true,
})

export default router.build();