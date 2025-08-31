import { ExpressRouter } from '@lib/expressRouter';
const router = new ExpressRouter();


router.GET_VALIDATED({
    query: {
        key: {type: 'string', required: true},
    }
},{
    201: {
        url: {type: 'string', required: true},
        expiresAt: {type: 'string', required: true},
    },
    400: {
        error: {type: 'string', required: true},
    }
}, (req, res, injected, repo, db) => {

    // injected.cloudflareR2.generateUploadPresignedUrl

})



export default router.build();