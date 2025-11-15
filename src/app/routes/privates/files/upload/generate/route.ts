import { ExpressRouter } from '@lib/expressRouter';
const router = new ExpressRouter();


router.GET_VALIDATED({
    query: {
        key: {type: 'string', required: true},
        contentType: {type: 'string', required: false},
        expiresIn: {type: 'number', required: false},
        storageUuid: {type: 'string', required: false} // 특정 저장소 UUID 지정 (선택적)
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
        
        const { key, contentType, expiresIn = 3600, storageUuid } = req.validatedData.query;

        // URL 디코딩하여 한글 파일명 복원
        const decodedKey = decodeURIComponent(key as string);

        const fileRepo = repo.getRepository('defaultFile');
        const storageRepo = repo.getRepository('defaultObjectStorage');

        // 저장소 선택 로직
        let r2Storage;
        
        if (storageUuid) {
            // 특정 저장소 UUID가 지정된 경우
            r2Storage = await storageRepo.getObjectStorageByUuid(storageUuid);
            if (!r2Storage) {
                res.status(400);
                return {
                    error: `지정된 저장소를 찾을 수 없습니다: ${storageUuid}`
                };
            }
            
            // 저장소가 활성화되어 있는지 확인
            if (!r2Storage.isActive || r2Storage.deletedAt) {
                res.status(400);
                return {
                    error: '지정된 저장소가 비활성화되어 있습니다.'
                };
            }
        } else {
            // 기본 저장소 우선 선택
            r2Storage = await storageRepo.getDefaultObjectStorage();
            
            if (!r2Storage) {
                // 기본 저장소가 없는 경우 첫 번째 활성 저장소 사용
                const activeStorages = await storageRepo.getObjectStoragesListSimply();
                const availableStorage = activeStorages.find(storage => 
                    storage.isActive && !storage.deletedAt
                );
                
                if (!availableStorage) {
                    res.status(400);
                    return {
                        error: '사용 가능한 저장소가 없습니다. 저장소 설정을 확인해주세요.'
                    };
                }
                r2Storage = availableStorage;
            }
        }

        // presigned URL 생성 (저장소 설정 정보 포함)
        const presignedUrl = await injected.cloudflareR2.generateUploadPresignedUrl(
            decodedKey,
            expiresIn as number,
            contentType as string,
            {
                baseUrl: r2Storage.baseUrl,
                bucketName: r2Storage.bucketName,
                region: r2Storage.region,
                accessKey: r2Storage.accessKey,
                secretKey: r2Storage.secretKey
            }
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
        const filename = decodedKey.split('/').pop() || decodedKey;
        const extension = filename.includes('.') ? filename.split('.').pop() : undefined;

        // 미리 파일 등록 (업로드 완료 후 업데이트 예정)
        await fileRepo.createFile({
            filename: filename,
            originalName: filename,
            mimeType: contentType || 'application/octet-stream',
            fileSize: 0n, // 업로드 완료 후 실제 크기로 업데이트
            extension: extension,
            storageUuid: r2Storage.uuid,
            filePath: decodedKey,
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