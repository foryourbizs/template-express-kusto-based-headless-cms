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
    const httpFileStreaming = injected.httpFileStreaming;

    try {
        // R2에서 파일 메타데이터 확인
        const fileMetadata = await cloudflareR2.getFileMetadata(fileName);
        if (!fileMetadata) {
            res.status(404);
            return res.json({
                success: false,
                message: 'File not found'
            });
        }

        // 파일 확장자에 따른 Content-Type 설정

        // ETag 생성 (파일명 + 타임스탬프 기반)
        const etag = httpFileStreaming.generateETag(fileName);
        const contentType = httpFileStreaming.getContentType(fileName);

        // If-None-Match 헤더 확인 (캐시 검증)
        const clientETag = req.headers['if-none-match'];
        if (clientETag === `"${etag}"`) {
            res.status(304); // Not Modified
            return res.end();
        }

        // Range 요청 파싱 및 처리
        const range = req.headers.range;
        const fileSize = fileMetadata.contentLength || 0;
        let start = 0;
        let end = fileSize - 1;
        let isRangeRequest = false;

        // 영상 파일 요청 시 간단 로그
        if (contentType.startsWith('video/') && httpFileStreaming.DEBUG_FILE_STREAMING) {
            console.log(`🎬 Video streaming: ${fileName} (${fileSize} bytes)`);
        }

        // Range 요청 파싱
        if (range && fileSize > 0) {
            isRangeRequest = true;
            const parts = range.replace(/bytes=/, "").split("-");
            start = parseInt(parts[0], 10) || 0;
            end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

            // 범위 검증
            if (start >= fileSize) {
                res.status(416); // Range Not Satisfiable
                res.setHeader('Content-Range', `bytes */${fileSize}`);
                return res.end();
            }

            if (end >= fileSize) {
                end = fileSize - 1;
            }

            if (httpFileStreaming.DEBUG_FILE_STREAMING) {
                const fileType = contentType.startsWith('video/') ? '📹' :
                               contentType.startsWith('image/') ? '🖼️' :
                               contentType.startsWith('audio/') ? '🎵' : '📄';
                console.log(`${fileType} Range request: ${fileName}, bytes ${start}-${end}/${fileSize}`);
            }
        }

        // R2에서 파일 스트림 다운로드 (Range 지원)
        let fileStream: any;
        if (isRangeRequest && fileSize > 0) {
            // Range 요청 처리
            fileStream = await cloudflareR2.downloadFileRange(fileName, start, end);
        } else {
            // 전체 파일 다운로드
            fileStream = await cloudflareR2.downloadFile(fileName);
        }

        if (!fileStream) {
            res.status(500);
            return res.json({
                success: false,
                message: 'Failed to download file from R2'
            });
        }

        // 최적화된 응답 헤더 설정
        httpFileStreaming.setBasicHeaders(res, fileName, contentType, etag);
        httpFileStreaming.setCacheHeaders(res, contentType);

        // Range 요청 처리 (영상 파일에 중요)
        if (isRangeRequest && fileSize > 0) {
            httpFileStreaming.setRangeHeaders(res, start, end, fileSize, contentType);
        } else {
            httpFileStreaming.setFullFileHeaders(res, fileSize, contentType);
        }

        // 스트리밍 최적화를 위한 파이프라인 사용
        try {
            await httpFileStreaming.executeStreamingPipeline(req, res, fileStream, fileName, contentType);
        } catch (pipelineError: any) {
            // 응답이 아직 보내지지 않았다면 에러 응답
            if (!res.headersSent) {
                res.status(500);
                return res.json({
                    success: false,
                    message: 'Error streaming file',
                    error: pipelineError.message
                });
            }
        }

    } catch (error) {
        console.error('Error in file download route:', error);

        // 에러 발생 시 모든 활성 스트림 정리
        httpFileStreaming.cleanupAllStreams();

        if (!res.headersSent) {
            res.status(500);
            return res.json({
                success: false,
                message: 'Internal server error'
            });
        }
    }
});

export default router.build();
