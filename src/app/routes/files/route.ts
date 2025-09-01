// generateDownloadPresignedUrl

import { ExpressRouter } from '@lib/expressRouter';
const router = new ExpressRouter();

router
.GET_SLUG(['fileName'], async (req, res, injected, repo, db) => {


    const { fileName } = req.params;

    if (!fileName) {
        res.status(400);
        return res.json({
            success: false,
            message: 'fileName is required'
        });
    }

    const cloudflareR2 = injected.cloudflareR2;
    
    try {
        // R2에서 파일 존재 여부 확인
        const fileExists = await cloudflareR2.fileExists(fileName);
        if (!fileExists) {
            res.status(404);
            return res.json({
                success: false,
                message: 'File not found'
            });
        }

        // R2에서 파일 스트림 다운로드
        const fileStream = await cloudflareR2.downloadFile(fileName);
        if (!fileStream) {
            res.status(500);
            return res.json({
                success: false,
                message: 'Failed to download file from R2'
            });
        }

        // 파일 확장자에 따른 Content-Type 설정
        const getContentType = (filename: string): string => {
            const ext = filename.toLowerCase().split('.').pop();
            const mimeTypes: { [key: string]: string } = {
                'pdf': 'application/pdf',
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'png': 'image/png',
                'gif': 'image/gif',
                'webp': 'image/webp',
                'mp4': 'video/mp4',
                'webm': 'video/webm',
                'mp3': 'audio/mpeg',
                'wav': 'audio/wav',
                'txt': 'text/plain',
                'html': 'text/html',
                'css': 'text/css',
                'js': 'application/javascript',
                'json': 'application/json',
                'xml': 'application/xml',
                'zip': 'application/zip',
                'doc': 'application/msword',
                'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'xls': 'application/vnd.ms-excel',
                'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            };
            return mimeTypes[ext || ''] || 'application/octet-stream';
        };

        // 응답 헤더 설정
        res.setHeader('Content-Type', getContentType(fileName));
        res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
        res.setHeader('Cache-Control', 'public, max-age=3600'); // 1시간 캐시

        // 파일 스트림을 클라이언트로 파이프
        fileStream.pipe(res);

        // 스트림 에러 처리
        fileStream.on('error', (error) => {
            console.error('File stream error:', error);
            if (!res.headersSent) {
                res.status(500);
                return res.json({
                    success: false,
                    message: 'Error streaming file'
                });
            }
        });

    } catch (error) {
        console.error('Error in file download route:', error);
        res.status(500);
        return res.json({
            success: false,
            message: 'Internal server error'
        });
    }
});export default router.build();
