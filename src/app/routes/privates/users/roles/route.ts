import { ExpressRouter } from 'kusto-framework-core'
const router = new ExpressRouter();


router
.CRUD('default', 'role', {
    primaryKey: 'uuid'
})

export default router.build();