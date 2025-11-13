import { ExpressRouter } from 'kusto-framework-core'
const router = new ExpressRouter();


/**
 * 비 관리자 접근 차단 미들웨어
 */
router
// .WITH('authJwtGuardRoleCheck', {
//     requiredRoles: ['admin'],
// })
.MIDDLEWARE(function (req, res, next, injected, repo, db) {
    next();
});


export default router.build();