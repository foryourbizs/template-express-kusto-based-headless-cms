import { ExpressRouter } from '@lib/expressRouter';
const router = new ExpressRouter();


router.GET_VALIDATED({
    query: {
        key: {type: 'string', required: true},
        contentType: {type: 'string', required: false},
        expiresIn: {type: 'number', required: false}
    }
},{
    201: {
        url: {type: 'string', required: true},
        expiresAt: {type: 'string', required: true},
    },
    400: {
        error: {type: 'string', required: true},
    }
}, async (req, res, injected, repo, db) => {
    try {
        const { key, contentType, expiresIn = 3600 } = req.validatedData.query;

        // presigned URL 생성
        const presignedUrl = await injected.cloudflareR2.generateUploadPresignedUrl(
            key as string,
            expiresIn as number,
            contentType as string
        );

        if (!presignedUrl) {
            return res.status(400).json({
                error: 'Presigned URL 생성에 실패했습니다.'
            });
        }

        // 만료 시간 계산
        const expiresAt = new Date(Date.now() + (expiresIn as number) * 1000).toISOString();

        res.status(201).json({
            url: presignedUrl,
            expiresAt: expiresAt
        });

    } catch (error) {
        console.error('Presigned URL 생성 오류:', error);
        res.status(400).json({
            error: 'Presigned URL 생성 중 오류가 발생했습니다.'
        });
    }
})



export default router.build();