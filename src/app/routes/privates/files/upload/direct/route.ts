import { ExpressRouter } from '@lib/expressRouter';
import { diskStorage } from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { readFile, unlink, mkdir } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

// 업로드 디렉토리 경로 상수
const UPLOAD_DIR = 'uploads/';

const router = new ExpressRouter();

const storage = diskStorage({
    destination: async function (req, file, cb) {
        // uploads 디렉토리가 없으면 생성
        if (!existsSync(UPLOAD_DIR)) {
            await mkdir(UPLOAD_DIR, { recursive: true });
        }
        cb(null, UPLOAD_DIR);   
    },
    filename: function (req, file, cb) {
        // 파일 확장자 추출
        const ext = path.extname(file.originalname);
        // UUID + 타임스탬프 + 추가 난수로 절대 중복되지 않는 파일명 생성
        const additionalRandom = Math.random().toString(36).substring(2, 15);
        const uniqueFilename = `${uuidv4()}-${Date.now()}-${additionalRandom}${ext}`;
        cb(null, uniqueFilename);
    }
});





router.WITH('authJwtGuardRoleCheck', {requiredRoles: ['admin']})
router.PUT_ARRAY_FILE(storage, 'files', async (req, res, injected, repo, db) => {
    try {
        const uploadedFiles = req.files as Express.Multer.File[];
        
        if (!uploadedFiles || uploadedFiles.length === 0) {
            res.status(400);
            return res.json({ 
                success: false, 
                message: '업로드된 파일이 없습니다.' 
            });
        }

        if (uploadedFiles.length === 1) {
            res.status(400);
            return res.json({ 
                success: false, 
                message: '업로드는 단일 파일만 허용합니다' 
            });
        }


        const fileRepo = repo.getRepository('defaultFile');
        const storageRepo = repo.getRepository('defaultObjectStorage');

        // R2_TAG로 정의된 스토리지 설정 조회
        const r2StorageName = injected.constantService.R2_TAG;
        if (!r2StorageName) {
            res.status(400);
            return res.json({
                success: false,
                message: 'R2 스토리지 태그가 설정되지 않았습니다.'
            });
        }

        const r2Storage = await storageRepo.getObjectStorageByName(r2StorageName);
        if (!r2Storage) {
            res.status(400);
            return res.json({
                success: false,
                message: `R2 스토리지 설정을 찾을 수 없습니다. (${r2StorageName})`
            });
        }

        // 스토리지가 활성화되어 있는지 확인
        if (!r2Storage.isActive || r2Storage.deletedAt) {
            res.status(400);
            return res.json({
                success: false,
                message: 'R2 스토리지가 비활성화되어 있습니다.'
            });
        }

        const results = [];

        for (const file of uploadedFiles) {
            try {
                // 1. 로컬에 저장된 파일 읽기
                const fileBuffer = await readFile(file.path);
                
                // 2. R2에 업로드할 키 생성 (원본 파일명 유지하되 중복 방지)
                const r2Key = `${UPLOAD_DIR}${file.filename}`;
                
                // 3. R2에 파일 업로드
                const uploadSuccess = await injected.cloudflareR2.uploadFile(
                    r2Key,
                    fileBuffer,
                    file.mimetype
                );

                if (uploadSuccess) {
                    // 4. 파일 확장자 추출
                    const extension = path.extname(file.originalname).toLowerCase().replace('.', '');

                    // 5. 데이터베이스에 파일 정보 저장 (upsert 사용)
                    const fileRecord = await fileRepo.upsertFileByPath(
                        r2Key,
                        r2Storage.uuid,
                        {
                            filename: file.filename,
                            originalName: file.originalname,
                            mimeType: file.mimetype,
                            fileSize: BigInt(file.size),
                            extension: extension || undefined,
                            exists: true,
                            isPublic: false,
                            uploadedBy: undefined, // TODO: 인증 시스템에서 사용자 ID 가져오기
                            uploadSource: 'direct_upload',
                        }
                    );

                    // 6. R2 업로드 성공 시 로컬 파일 삭제
                    await unlink(file.path);
                    
                    results.push({
                        success: true,
                        originalName: file.originalname,
                        filename: file.filename,
                        r2Key: r2Key,
                        size: file.size,
                        mimetype: file.mimetype,
                        fileUuid: fileRecord.uuid
                    });
                } else {
                    // R2 업로드 실패 시에도 로컬 파일 삭제
                    await unlink(file.path);
                    
                    results.push({
                        success: false,
                        originalName: file.originalname,
                        filename: file.filename,
                        error: 'R2 업로드 실패'
                    });
                }
            } catch (fileError) {
                // 파일 처리 중 오류 발생 시 로컬 파일 삭제 시도
                try {
                    await unlink(file.path);
                } catch (unlinkError) {
                    console.error('파일 삭제 실패:', unlinkError);
                }
                
                results.push({
                    success: false,
                    originalName: file.originalname,
                    filename: file.filename,
                    error: fileError instanceof Error ? fileError.message : '알 수 없는 오류'
                });
            }
        }

        res.status(200);
        return res.json({
            success: true,
            message: '파일 처리 완료',
            results: results
        });

    } catch (error) {
        console.error('파일 업로드 처리 중 오류:', error);
        res.status(500);
        return res.json({
            success: false,
            message: '파일 업로드 처리 중 오류가 발생했습니다.',
            error: error instanceof Error ? error.message : '알 수 없는 오류'
        });
    }
});


export default router.build();