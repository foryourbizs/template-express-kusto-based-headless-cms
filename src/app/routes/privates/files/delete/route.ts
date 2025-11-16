import { ExpressRouter } from 'kusto-framework-core';

const router = new ExpressRouter();

/**
 * 단일 파일 삭제 API
 * DELETE /privates/files/delete/:fileUuid
 * 
 * @param fileUuid - 삭제할 파일의 UUID
 * @returns 삭제 결과
 */
router.WITH('authJwtGuardRoleCheck', { requiredRoles: ['admin'] })
router.DELETE_SLUG_VALIDATED(
    ["fileUuid"],
    {
        params: {
            fileUuid: { type: 'string', required: true }
        }
    },
    {
        200: {
            success: { type: 'boolean', required: true },
            message: { type: 'string', required: true },
            data: {
                type: 'object',
                required: true,
                properties: {
                    fileUuid: { type: 'string', required: true },
                    filename: { type: 'string', required: true },
                    originalName: { type: 'string', required: true },
                    filePath: { type: 'string', required: true },
                    r2DeleteSuccess: { type: 'boolean', required: true },
                    deletedAt: { type: 'string', required: true }
                }
            }
        },
        400: {
            success: { type: 'boolean', required: true },
            message: { type: 'string', required: true }
        },
        404: {
            success: { type: 'boolean', required: true },
            message: { type: 'string', required: true }
        },
        500: {
            success: { type: 'boolean', required: true },
            message: { type: 'string', required: true },
            error: { type: 'string', required: false }
        }
    },
    async (req, res, injected, repo, db) => {
    try {
        const { fileUuid } = req.params;

        console.log(fileUuid);

        if (!fileUuid) {
            res.status(400);
            return res.json({
                success: false,
                message: '파일 UUID가 필요합니다.'
            });
        }

        const fileRepo = repo.defaultFile;
        const storageRepo = repo.defaultObjectStorage;

        // 1. 데이터베이스에서 파일 정보 조회
        const fileRecord = await fileRepo.getFileByUuid(fileUuid);
        if (!fileRecord) {
            res.status(404);
            return res.json({
                success: false,
                message: '파일을 찾을 수 없습니다.'
            });
        }

        // 이미 삭제된 파일인지 확인
        if (fileRecord.deletedAt) {
            res.status(400);
            return res.json({
                success: false,
                message: '이미 삭제된 파일입니다.'
            });
        }

        // 2. 스토리지 설정 조회
        const storage = await storageRepo.getObjectStorageByUuid(fileRecord.storageUuid);
        if (!storage) {
            res.status(400);
            return res.json({
                success: false,
                message: '스토리지 설정을 찾을 수 없습니다.'
            });
        }

        // 3. R2에서 실제 파일 삭제
        const storageConfig = {
            baseUrl: storage.baseUrl,
            bucketName: storage.bucketName,
            region: storage.region,
            accessKey: storage.accessKey,
            secretKey: storage.secretKey
        };
        
        const deleteSuccess = await injected.cloudflareR2.deleteFile(fileRecord.filePath, storageConfig);
        
        // 4. 데이터베이스에서 소프트 삭제 (R2 삭제 실패해도 진행)
        const updatedFile = await fileRepo.softDeleteFile(fileUuid);

        res.status(200);
        return res.json({
            success: true,
            message: '파일이 성공적으로 삭제되었습니다.',
            data: {
                fileUuid: updatedFile.uuid,
                filename: updatedFile.filename,
                originalName: updatedFile.originalName,
                filePath: updatedFile.filePath,
                r2DeleteSuccess: deleteSuccess,
                deletedAt: updatedFile.deletedAt
            }
        });

    } catch (error) {
        console.error('파일 삭제 중 오류:', error);
        res.status(500);
        return res.json({
            success: false,
            message: '파일 삭제 중 오류가 발생했습니다.',
            error: error instanceof Error ? error.message : '알 수 없는 오류'
        });
    }
}, {exact: true});

export default router.build();
