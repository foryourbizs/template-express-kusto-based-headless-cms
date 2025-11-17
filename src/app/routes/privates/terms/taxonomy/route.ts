import { ExpressRouter } from '@lib/expressRouter'
const router = new ExpressRouter();


router
.CRUD('default', 'termTaxonomy', {
    primaryKey: 'uuid',
})

export default router.build();