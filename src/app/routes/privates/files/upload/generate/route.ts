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

        const fileRepo = repo.getRepository('defaultFile');
        const storageRepo = repo.getRepository('defaultObjectStorage');

        // R2_TAG로 정의된 스토리지 설정 조회
        const r2StorageName = injected.constantService.R2_TAG;
        if (!r2StorageName) {
            res.status(400);
            return {
                error: 'R2 스토리지 태그가 설정되지 않았습니다.'
            };
        }

        const r2Storage = await storageRepo.getObjectStorageByName(r2StorageName);
        if (!r2Storage) {
            res.status(400);
            return {
                error: `R2 스토리지 설정을 찾을 수 없습니다. (${r2StorageName})`
            };
        }

        // 스토리지가 활성화되어 있는지 확인
        if (!r2Storage.isActive || r2Storage.deletedAt) {
            res.status(400);
            return {
                error: 'R2 스토리지가 비활성화되어 있습니다.'
            };
        }

        // presigned URL 생성
        const presignedUrl = await injected.cloudflareR2.generateUploadPresignedUrl(
            key as string,
            expiresIn as number,
            contentType as string
        );

        if (!presignedUrl) {
            res.status(400);
            return {
                error: 'Presigned URL 생성에 실패했습니다.'
            };
        }

        // 만료 시간 계산
        const expiresAt = new Date(Date.now() + (expiresIn as number) * 1000).toISOString();

        // 파일명 및 확장자 추출
        const filename = key.split('/').pop() || key;
        const extension = filename.includes('.') ? filename.split('.').pop() : undefined;

        // 미리 파일 등록 (업로드 완료 후 업데이트 예정)
        await fileRepo.createFile({
            filename: filename,
            originalName: filename,
            mimeType: contentType || 'application/octet-stream',
            fileSize: 0n, // 업로드 완료 후 실제 크기로 업데이트
            extension: extension,
            storageUuid: r2Storage.uuid,
            filePath: key,
            exists: false, // 아직 업로드되지 않음
            isPublic: false,
            uploadedBy: undefined, // TODO: 인증 시스템에서 사용자 ID 가져오기
            uploadSource: 'presigned_url',
            expiresAt: new Date(Date.now() + (expiresIn as number) * 1000),
        })

        res.status(201);
        return {
            url: presignedUrl,
            expiresAt: expiresAt
        };

    } catch (error) {
        console.error('Presigned URL 생성 오류:', error);
        res.status(400);
        return {
            error: 'Presigned URL 생성 중 오류가 발생했습니다.'
        };
    }
})



export default router.build();