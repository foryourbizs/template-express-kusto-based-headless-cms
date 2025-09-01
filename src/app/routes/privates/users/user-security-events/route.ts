import { ExpressRouter } from '@lib/expressRouter'
const router = new ExpressRouter();


router
.CRUD('default', 'userSecurityEvent', {
    only: ['index', 'show'],
    primaryKey: 'uuid'
})

export default router.build();