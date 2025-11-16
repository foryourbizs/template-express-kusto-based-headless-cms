import { ExpressRouter } from '@lib/expressRouter'

const router = new ExpressRouter();

//통계를 입력하기 위한 엔드포인트

router
.POST_VALIDATED({
    body: {
        events: {type: 'array', required: true, properties: {
            type: {type: 'string', required: true},
            timestamp: {type: 'number', required: true},
            payload: {type: 'object', required: true},
        }},
        fingerprint: {type: 'string', required: true},
        hmac: {type: 'string', required: false}
    }
}, {
    200: {
        success: { type: 'boolean', required: true },
    },
    400: {
        error: { type: 'string', required: true }
    },
    401: {
        error: { type: 'string', required: true }
    },
    500: {
        error: { type: 'string', required: true }
    }
}, async (req, res, injected, repo, db) => {
    const { events, fingerprint, hmac } = req.validatedData.body;
    
    const cryptoHmac = injected.cryptoHmac;

    // HMAC이 제공된 경우 검증
    if (hmac) {
        // const secretKey = process.env.HMAC_SECRET;
        const secretKey = 'kg7j984fd5hg1s2dfgthj98gf7h451g2ds0';
        if (!secretKey) {
            res.status(500);
            return {
                error: 'HMAC_SECRET 환경변수가 설정되지 않았습니다.'
            };
        }

        // BatchedEvents 형식으로 변환
        const batchData = {
            fingerprint,
            events: events.map((e: any) => ({
                type: e.type,
                timestamp: e.timestamp,
                payload: e.payload
            })),
            hmac
        };

        const isValid = cryptoHmac.verifyBatchHmac(batchData, secretKey);
        
        if (!isValid) {
            res.status(401)
            return {
                error: 'HMAC 검증에 실패했습니다.'
            };
        }
    }

    // TODO: 통계 데이터 저장 로직 구현해야함

    // db.getWrap('default').anal


    res.status(200);
    return {
        success: true
    };

})

export default router.build();
