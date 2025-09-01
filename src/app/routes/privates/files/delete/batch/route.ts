import { ExpressRouter } from '@lib/expressRouter';

const router = new ExpressRouter();

/**
 * 여러 파일 일괄 삭제 API
 * DELETE /privates/files/delete/batch
 * 
 * Body: { fileUuids: string[] }
 * @returns 삭제 결과
 */
router.WITH('authJwtGuardRoleCheck', { requiredRoles: ['admin'] })
router.DELETE(async (req, res, injected, repo, db) => {
    try {
        const { fileUuids } = req.body;

        if (!fileUuids || !Array.isArray(fileUuids) || fileUuids.length === 0) {
            res.status(400);
            return res.json({
                success: false,
                message: '삭제할 파일 UUID 배열이 필요합니다.'
            });
        }

        // 최대 100개 파일까지 일괄 삭제 허용
        if (fileUuids.length > 100) {
            res.status(400);
            return res.json({
                success: false,
                message: '한 번에 삭제할 수 있는 파일은 최대 100개입니다.'
            });
        }

        const fileRepo = repo.getRepository('defaultFile');
        const storageRepo = repo.getRepository('defaultObjectStorage');

        const results: {
            succeeded: Array<{
                fileUuid: string;
                filename: string;
                originalName: string;
                filePath: string;
                deletedAt: Date | null;
            }>;
            failed: Array<{
                fileUuid: string;
                error: string;
            }>;
            r2DeleteResults: {
                succeeded: string[];
                failed: Array<{
                    key: string;
                    error: string;
                }>;
            };
        } = {
            succeeded: [],
            failed: [],
            r2DeleteResults: { succeeded: [], failed: [] }
        };

        // 1. 모든 파일 정보를 먼저 조회
        const fileRecords = [];
        for (const uuid of fileUuids) {
            try {
                const fileRecord = await fileRepo.getFileByUuid(uuid);
                if (fileRecord && !fileRecord.deletedAt) {
                    fileRecords.push(fileRecord);
                } else {
                    results.failed.push({
                        fileUuid: uuid,
                        error: fileRecord ? '이미 삭제된 파일입니다' : '파일을 찾을 수 없습니다'
                    });
                }
            } catch (error) {
                results.failed.push({
                    fileUuid: uuid,
                    error: error instanceof Error ? error.message : '알 수 없는 오류'
                });
            }
        }

        if (fileRecords.length === 0) {
            res.status(400);
            return res.json({
                success: false,
                message: '삭제할 수 있는 파일이 없습니다.',
                results
            });
        }

        // 2. R2에서 파일들 일괄 삭제
        const r2Keys = fileRecords.map(file => file.filePath);
        try {
            const r2Result = await injected.cloudflareR2.deleteMultipleFiles(r2Keys);
            results.r2DeleteResults = r2Result;
        } catch (error) {
            console.error('R2 일괄 삭제 실패:', error);
            // R2 삭제 실패해도 데이터베이스 소프트 삭제는 진행
        }

        // 3. 데이터베이스에서 소프트 삭제
        for (const fileRecord of fileRecords) {
            try {
                const updatedFile = await fileRepo.softDeleteFile(fileRecord.uuid);
                results.succeeded.push({
                    fileUuid: updatedFile.uuid,
                    filename: updatedFile.filename,
                    originalName: updatedFile.originalName,
                    filePath: updatedFile.filePath,
                    deletedAt: updatedFile.deletedAt
                });
            } catch (error) {
                results.failed.push({
                    fileUuid: fileRecord.uuid,
                    error: error instanceof Error ? error.message : '데이터베이스 삭제 실패'
                });
            }
        }

        res.status(200);
        return res.json({
            success: true,
            message: `${results.succeeded.length}개 파일이 성공적으로 삭제되었습니다.`,
            data: {
                totalRequested: fileUuids.length,
                successCount: results.succeeded.length,
                failureCount: results.failed.length,
                r2DeleteResults: results.r2DeleteResults,
                results: {
                    succeeded: results.succeeded,
                    failed: results.failed
                }
            }
        });

    } catch (error) {
        console.error('파일 일괄 삭제 중 오류:', error);
        res.status(500);
        return res.json({
            success: false,
            message: '파일 일괄 삭제 중 오류가 발생했습니다.',
            error: error instanceof Error ? error.message : '알 수 없는 오류'
        });
    }
});

export default router.build();
