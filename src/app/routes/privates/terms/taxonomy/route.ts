import { ExpressRouter } from '@lib/expressRouter'
const router = new ExpressRouter();


router
.CRUD('default', 'termTaxonomy', {
    primaryKey: 'uuid',
    softDelete: {
        enabled: true,
        field: 'deletedAt'
    }
})

export default router.build();