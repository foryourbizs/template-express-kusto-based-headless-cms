import { ExpressRouter } from 'kusto-framework-core'
const router = new ExpressRouter();


router
.CRUD('default', 'siteMenuGroupKey', {
    primaryKey: 'uuid'
})

export default router.build();