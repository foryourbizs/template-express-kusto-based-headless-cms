import { ExpressRouter } from 'kusto-framework-core'
const router = new ExpressRouter();


router
.CRUD('default', 'userPermission', {
    primaryKey: 'uuid'
})

export default router.build();