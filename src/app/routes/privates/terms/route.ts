import { ExpressRouter } from '@lib/expressRouter'
const router = new ExpressRouter();


router
.CRUD('default', 'term', {
    primaryKey: 'uuid',
    softDelete: {
        enabled: true,
        field: 'deletedAt'
    }
})

export default router.build();