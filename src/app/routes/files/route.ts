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
    const httpFileStreaming = injected.cloudflareFileStreaming;

    // 요청 시작 로그 (디버그 모드에서만)
    if (httpFileStreaming.DEBUG_FILE_STREAMING) {
        const requestId = Math.random().toString(36).substr(2, 6);
        console.log(`📥 [${requestId}] File request START: ${fileName} from ${req.ip || 'unknown'}`);
        
        // 요청 ID를 res 객체에 저장 (나중에 사용)
        (res as any).requestId = requestId;
    }

    try {
        // 1. 데이터베이스에서 파일 정보 조회
        const fileRepo = repo.getRepository('defaultFile');
        const storageRepo = repo.getRepository('defaultObjectStorage');
        
        const fileRecord = await fileRepo.getFileByFilename(fileName);

        if (!fileRecord) {
            res.status(404);
            return res.json({
                success: false,
                message: 'File not found in database'
            });
        }

        // 2. 스토리지 설정 조회
        const storage = await storageRepo.getObjectStorageByUuid(fileRecord.storageUuid);
        if (!storage) {
            res.status(500);
            return res.json({
                success: false,
                message: 'Storage configuration not found'
            });
        }

        // 3. 스토리지 설정 객체 생성
        const storageConfig = {
            baseUrl: storage.baseUrl,
            bucketName: storage.bucketName,
            region: storage.region,
            accessKey: storage.accessKey,
            secretKey: storage.secretKey,
        };

        // R2에서 파일 메타데이터 확인 (중복 제거)
        const fileMetadata = await httpFileStreaming.getFileMetadataWithDeduplication(cloudflareR2, fileName, storageConfig);
        if (!fileMetadata) {
            res.status(404);
            return res.json({
                success: false,
                message: 'File not found'
            });
        }

        // 파일 확장자에 따른 Content-Type 설정

        // ETag 생성 (파일명과 메타데이터 기반으로 더 정확하게)
        const etag = httpFileStreaming.generateETag(fileName + '_' + (fileMetadata.lastModified || fileMetadata.contentLength));
        const contentType = httpFileStreaming.getContentType(fileName);

        // If-None-Match 헤더 확인 (캐시 검증)
        const clientETag = req.headers['if-none-match'];
        if (clientETag === `"${etag}"`) {
            res.status(304); // Not Modified
            res.removeHeader('Content-Length'); // 304 응답에서는 불필요
            res.removeHeader('Transfer-Encoding');
            return res.end();
        }

        // Range 요청 파싱 및 사전 검증 (스트림 생성 전에 완료)
        const range = req.headers.range;
        const fileSize = fileMetadata.contentLength || 0;
        let start = 0;
        let end = fileSize - 1;
        let isRangeRequest = false;

        // 영상 파일 요청 시 간단 로그
        httpFileStreaming.logVideoRequest(fileName, fileSize, contentType);

        // Range 요청 사전 검증 (스트림 생성 전에 완료)
        if (range && fileSize > 0) {
            const parts = range.replace(/bytes=/, "").split("-");
            const requestStart = parseInt(parts[0], 10) || 0;
            const requestEnd = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

            // 범위 검증 - 잘못된 경우 즉시 416 응답하고 종료 (스트림 생성 없음)
            if (requestStart >= fileSize || requestStart < 0 || requestStart > requestEnd) {
                res.status(416); // Range Not Satisfiable
                res.setHeader('Content-Range', `bytes */${fileSize}`);
                res.setHeader('Content-Type', 'text/plain');
                res.removeHeader('Content-Length');
                res.removeHeader('Transfer-Encoding');
                console.warn(`❌ Invalid range request: ${range} for file size ${fileSize} (start: ${requestStart}, end: ${requestEnd})`);
                return res.end();
            }

            // 유효한 Range 요청인 경우에만 설정
            isRangeRequest = true;
            start = requestStart;
            end = Math.min(requestEnd, fileSize - 1); // 안전 범위로 조정

            // Range 요청 로그 (요청 ID 포함)
            if (httpFileStreaming.DEBUG_FILE_STREAMING) {
                const requestId = (res as any).requestId || 'unknown';
                console.log(`🎯 [${requestId}] Range validated: ${fileName}, bytes ${start}-${end}/${fileSize}`);
            }
            
            httpFileStreaming.logRangeRequest(fileName, start, end, fileSize, contentType);
        }

        // 이제 검증된 Range로만 스트림 생성

        // 이제 검증된 Range로만 스트림 생성
        // R2에서 파일 스트림 다운로드 (Range 지원, 중복 제거)
        const fileStream = await httpFileStreaming.getFileStreamWithDeduplication(
            cloudflareR2,
            fileName,
            storageConfig,
            isRangeRequest,
            start,
            end
        );

        if (!fileStream) {
            res.status(500);
            return res.json({
                success: false,
                message: 'Failed to download file from R2'
            });
        }

        // 최적화된 응답 헤더 설정
        // 기본 헤더들을 먼저 설정
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Connection', 'keep-alive');
        
        // httpFileStreaming 기본 헤더들만 호출 (Content-Length 관련 제외)
        httpFileStreaming.setBasicHeaders(res, fileName, contentType, etag);
        httpFileStreaming.setCacheHeaders(res, contentType);

        // Transfer-Encoding 헤더를 먼저 제거 (충돌 방지)
        res.removeHeader('Transfer-Encoding');

        // Range 요청 처리 (영상 파일에 중요)
        if (isRangeRequest && fileSize > 0) {
            const contentLength = end - start + 1;
            
            // Range 응답 상태 설정
            res.status(206); // Partial Content
            res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
            res.setHeader('Content-Length', contentLength.toString());
            
            if (httpFileStreaming.DEBUG_FILE_STREAMING) {
                const requestId = (res as any).requestId || 'unknown';
                console.log(`📏 [${requestId}] Range headers set: 206, Content-Length: ${contentLength}, Range: ${start}-${end}/${fileSize}`);
            }
        } else {
            // 전체 파일 응답
            res.status(200); // OK
            if (fileSize > 0) {
                res.setHeader('Content-Length', fileSize.toString());
            }
            
            if (httpFileStreaming.DEBUG_FILE_STREAMING) {
                const requestId = (res as any).requestId || 'unknown';
                console.log(`📏 [${requestId}] Full file headers set: 200, Content-Length: ${fileSize}`);
            }
        }

        // 스트리밍 파이프라인 (Node.js 기본 스트림 사용)
        try {
            // 클라이언트 연결 상태 확인
            if (req.socket && req.socket.destroyed) {
                console.warn('Client connection already destroyed before streaming');
                if (fileStream && typeof fileStream.destroy === 'function') {
                    fileStream.destroy();
                }
                return;
            }

            // 응답 헤더가 이미 전송되었는지 확인
            if (res.headersSent) {
                console.error('Headers already sent before streaming pipeline');
                if (fileStream && typeof fileStream.destroy === 'function') {
                    fileStream.destroy();
                }
                return;
            }

            // 스트리밍 시작 전 헤더 상태 확인
            if (httpFileStreaming.DEBUG_FILE_STREAMING) {
                const requestId = (res as any).requestId || 'unknown';
                const hasContentLength = res.getHeader('Content-Length');
                const hasTransferEncoding = res.getHeader('Transfer-Encoding');
                
                console.log(`🚀 [${requestId}] Starting Node.js streaming pipeline: ${fileName} (Range: ${isRangeRequest ? `${start}-${end}` : 'full'})`);
                console.log(`📋 [${requestId}] Headers check - Content-Length: ${hasContentLength}, Transfer-Encoding: ${hasTransferEncoding}`);
                
                // HTTP/1.1 프로토콜 위반 최종 검사
                if (hasContentLength && hasTransferEncoding) {
                    console.error(`❌ [${requestId}] HTTP/1.1 Protocol Violation: Both Content-Length and Transfer-Encoding are set!`);
                    res.removeHeader('Transfer-Encoding'); // Transfer-Encoding 제거
                    console.log(`🔧 [${requestId}] Removed Transfer-Encoding header to fix protocol violation`);
                }
            }

            // Node.js 기본 스트림 파이프라인 사용 (httpFileStreaming.executeStreamingPipeline 대신)
            fileStream.pipe(res);
            
            // 스트림 에러 처리
            fileStream.on('error', (streamError: any) => {
                console.error('File stream error:', streamError);
                if (fileStream && typeof fileStream.destroy === 'function') {
                    fileStream.destroy();
                }
                if (!res.headersSent) {
                    res.status(500).json({
                        success: false,
                        message: 'Stream error'
                    });
                }
            });

            // 응답 완료 처리
            res.on('finish', () => {
                if (httpFileStreaming.DEBUG_FILE_STREAMING) {
                    const requestId = (res as any).requestId || 'unknown';
                    console.log(`✅ [${requestId}] File request COMPLETE: ${fileName}`);
                }
            });

            // 클라이언트 연결 끊김 처리
            req.on('close', () => {
                if (fileStream && typeof fileStream.destroy === 'function') {
                    fileStream.destroy();
                }
            });
            
        } catch (pipelineError: any) {
            console.error('Pipeline error:', {
                fileName,
                error: pipelineError.message,
                code: pipelineError.code,
                isRangeRequest,
                range: isRangeRequest ? `${start}-${end}/${fileSize}` : 'full'
            });
            
            // 스트림 정리
            if (fileStream && typeof fileStream.destroy === 'function') {
                fileStream.destroy();
            }
            
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

    } catch (error: any) {
        console.error('Error in file download route:', error);

        // 에러 발생 시 모든 활성 스트림 정리
        httpFileStreaming.cleanupAllStreams();

        // HPE_UNEXPECTED_CONTENT_LENGTH 관련 에러 특별 처리
        if (error.code === 'HPE_UNEXPECTED_CONTENT_LENGTH') {
            console.error('Content-Length mismatch detected:', {
                fileName,
                error: error.message,
                headersSent: res.headersSent
            });
        }

        if (!res.headersSent) {
            res.status(500);
            return res.json({
                success: false,
                message: 'Internal server error',
                ...(process.env.NODE_ENV === 'development' && { error: error.message })
            });
        } else {
            // 헤더가 이미 전송된 경우 연결을 강제로 종료
            console.error('Response headers already sent, terminating connection');
            if (res.socket && !res.socket.destroyed) {
                res.socket.destroy();
            }
        }
    }
});

export default router.build();
