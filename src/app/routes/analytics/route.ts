import { ExpressRouter } from '@lib/expressRouter'

const router = new ExpressRouter();

//통계를 입력하기 위한 엔드포인트

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
    // 400: {
    //     error: { type: 'string', required: true }
    // },
    401: {
        error: { type: 'string', required: true }
    },
    500: {
        error: { type: 'string', required: true }
    }
}, async (req, res, injected, repo, db) => {
    const { type, timestamp, fingerprint, payload, hmac } = req.validatedData.body;

    const cryptoHmac = injected.cryptoHmac;

    // HMAC이 제공된 경우 검증
    if (hmac) {
        const secretKey = process.env.HMAC_SECRET;
        
        if (!secretKey) {
            res.status(500);
            return {
                error: 'HMAC_SECRET 환경변수가 설정되지 않았습니다.'
            };
        }

        const eventData = {
            type,
            timestamp,
            fingerprint,
            payload,
            hmac
        };

        const isValid = cryptoHmac.verifyEventHmac(eventData, secretKey);
        
        if (!isValid) {
            res.status(401)
            return {
                error: 'HMAC 검증에 실패했습니다.'
            };
        }
    }

    // TODO: 통계 데이터 저장 로직 구현
    res.status(200);
    return {
        success: true
    };

})

export default router.build();
