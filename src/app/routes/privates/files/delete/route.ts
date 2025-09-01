import { ExpressRouter } from '@lib/expressRouter';

const router = new ExpressRouter();

/**
 * 단일 파일 삭제 API
 * DELETE /privates/files/delete/:fileUuid
 * 
 * @param fileUuid - 삭제할 파일의 UUID
 * @returns 삭제 결과
 */
router.WITH('authJwtGuardRoleCheck', { requiredRoles: ['admin'] })
router.DELETE_SLUG([':fileUuid'], async (req, res, injected, repo, db) => {
    try {
        const { fileUuid } = req.params;

        if (!fileUuid) {
            res.status(400);
            return res.json({
                success: false,
                message: '파일 UUID가 필요합니다.'
            });
        }

        const fileRepo = repo.getRepository('defaultFile');
        const storageRepo = repo.getRepository('defaultObjectStorage');

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
        const deleteSuccess = await injected.cloudflareR2.deleteFile(fileRecord.filePath);
        
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
});

export default router.build();
