import { ExpressRouter } from 'kusto-framework-core'
const router = new ExpressRouter();


/**
 * 사용자 처리
 */
router
.CRUD('default', 'user', {
    primaryKey: 'uuid',
    softDelete: {enabled: true, field: 'deletedAt'},
})

export default router.build();