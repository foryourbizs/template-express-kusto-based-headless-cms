import { ExpressRouter } from '@lib/expressRouter'
const router = new ExpressRouter();


router
.POST_VALIDATED({
    body: {
        type: {type: 'string', required: true},
        timestamp: {type: 'number', required: true},
        fingerprint: {type: 'string', required: true},
        payload: {type: 'object', required: true},
        hmac: {type: 'string', required: false}
    }
}, {
    200: {
        success: { type: 'boolean', required: true },
    },
    400: {
        error: { type: 'string', required: true }
    }
}, async (req, res, injected, repo, db) => {
    const {} = req.validatedData.body;

})

export default router.build();
