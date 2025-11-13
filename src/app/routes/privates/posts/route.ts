import { ExpressRouter } from 'kusto-framework-core'
const router = new ExpressRouter();


router
.CRUD('default', 'post', {
    primaryKey: 'uuid'
})

export default router.build();