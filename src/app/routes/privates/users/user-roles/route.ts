import { ExpressRouter } from 'kusto-framework-core'
const router = new ExpressRouter();


router
.CRUD('default', 'userRole', {
    primaryKey: 'uuid'
})

export default router.build();