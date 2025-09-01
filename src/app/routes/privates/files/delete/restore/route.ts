import { ExpressRouter } from '@lib/expressRouter';

const router = new ExpressRouter();

/**
 * 단일 파일 복구 API
 * PUT /privates/files/delete/restore/:fileUuid
 * 
 * @param fileUuid - 복구할 파일의 UUID
 * @returns 복구 결과
 */
router.WITH('authJwtGuardRoleCheck', { requiredRoles: ['admin'] })
router.PUT_SLUG([':fileUuid'], async (req, res, injected, repo, db) => {
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

        // 1. 데이터베이스에서 파일 정보 조회 (삭제된 파일 포함)
        const fileRecord = await fileRepo.getFileByUuid(fileUuid, true);
        if (!fileRecord) {
            res.status(404);
            return res.json({
                success: false,
                message: '파일을 찾을 수 없습니다.'
            });
        }

        // 이미 활성 상태인 파일인지 확인
        if (!fileRecord.deletedAt) {
            res.status(400);
            return res.json({
                success: false,
                message: '이미 활성 상태인 파일입니다.'
            });
        }

        // 2. R2에서 파일 존재 여부 확인
        const fileExists = await injected.cloudflareR2.fileExists(fileRecord.filePath);

        // 3. 데이터베이스에서 파일 복구
        const restoredFile = await fileRepo.restoreFile(fileUuid);

        // 4. R2 파일 존재 여부에 따라 exists 상태 업데이트
        if (fileExists !== fileRecord.exists) {
            await fileRepo.updateFile(fileUuid, { exists: fileExists });
        }

        res.status(200);
        return res.json({
            success: true,
            message: '파일이 성공적으로 복구되었습니다.',
            data: {
                fileUuid: restoredFile.uuid,
                filename: restoredFile.filename,
                originalName: restoredFile.originalName,
                filePath: restoredFile.filePath,
                exists: fileExists,
                wasRestored: true,
                restoredAt: new Date(),
                deletedAt: restoredFile.deletedAt // should be null now
            }
        });

    } catch (error) {
        console.error('파일 복구 중 오류:', error);
        res.status(500);
        return res.json({
            success: false,
            message: '파일 복구 중 오류가 발생했습니다.',
            error: error instanceof Error ? error.message : '알 수 없는 오류'
        });
    }
});

export default router.build();
