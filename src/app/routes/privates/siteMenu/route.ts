import { ExpressRouter } from 'kusto-framework-core'
const router = new ExpressRouter();


router
.CRUD('default', 'siteMenu', {
    primaryKey: 'uuid',
    includeMerge: true,
})

export default router.build();