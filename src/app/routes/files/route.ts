// generateDownloadPresignedUrl

import { ExpressRouter } from '@lib/expressRouter';
import crypto from 'crypto';
import { pipeline } from 'stream/promises';

const router = new ExpressRouter();

// 디버그 모드 설정
const DEBUG_FILE_STREAMING = process.env.DEBUG_FILE_STREAMING === 'true';

// 클라이언트 연결 해제 로그 제한을 위한 캐시 (메모리 기반 간단 구현)
const disconnectLogCache = new Map<string, number>();
const DISCONNECT_LOG_INTERVAL = 30000; // 30초 간격으로만 로그 출력

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
        // R2에서 파일 메타데이터 확인
        const fileMetadata = await cloudflareR2.getFileMetadata(fileName);
        if (!fileMetadata) {
            res.status(404);
            return res.json({
                success: false,
                message: 'File not found'
            });
        }

        // 파일 요청 시작 로그 (디버그 모드에서만)
        if (DEBUG_FILE_STREAMING) {
            console.log(`🔍 File request: ${fileName} (${fileMetadata.contentLength} bytes)`);
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
                'svg': 'image/svg+xml',
                'ico': 'image/x-icon',
                'mp4': 'video/mp4',
                'webm': 'video/webm',
                'avi': 'video/avi',
                'mov': 'video/quicktime',
                'mp3': 'audio/mpeg',
                'wav': 'audio/wav',
                'ogg': 'audio/ogg',
                'flac': 'audio/flac',
                'txt': 'text/plain',
                'html': 'text/html',
                'css': 'text/css',
                'js': 'application/javascript',
                'json': 'application/json',
                'xml': 'application/xml',
                'zip': 'application/zip',
                'rar': 'application/x-rar-compressed',
                '7z': 'application/x-7z-compressed',
                'doc': 'application/msword',
                'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'xls': 'application/vnd.ms-excel',
                'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'ppt': 'application/vnd.ms-powerpoint',
                'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
            };
            return mimeTypes[ext || ''] || 'application/octet-stream';
        };

        // ETag 생성 (파일명 + 타임스탬프 기반)
        const etag = crypto.createHash('md5').update(`${fileName}-${Date.now()}`).digest('hex');
        const contentType = getContentType(fileName);
        
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
        
        // 영상 파일 요청 시 특별 로그
        if (contentType.startsWith('video/')) {
            console.log(`🎬 Video file requested: ${fileName} (${contentType}, ${fileSize} bytes)`);
            if (range) {
                console.log(`📐 Range header: ${range}`);
            }
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
            
            if (DEBUG_FILE_STREAMING) {
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
        res.setHeader('Content-Type', contentType);
        res.setHeader('ETag', `"${etag}"`);
        res.setHeader('Last-Modified', new Date().toUTCString());
        
        // 파일 타입별 캐시 정책
        if (contentType.startsWith('video/') || contentType.startsWith('audio/')) {
            // 영상/오디오 파일은 더 긴 캐시 (스트리밍 최적화)
            res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800'); // 1일 캐시, 1주일 stale
        } else if (contentType.startsWith('image/')) {
            // 이미지 파일
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // 1년 캐시
        } else {
            // 기타 파일
            res.setHeader('Cache-Control', 'public, max-age=3600'); // 1시간 캐시
        }
        res.setHeader('Accept-Ranges', 'bytes');
        
        // Content-Disposition 설정 (이미지/비디오는 inline, 나머지는 attachment)
        const inlineTypes = ['image/', 'video/', 'audio/', 'text/', 'application/pdf'];
        const isInline = inlineTypes.some(type => contentType.startsWith(type));
        res.setHeader('Content-Disposition', 
            `${isInline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(fileName)}"`);

        // Compression 지원 (텍스트 기반 파일)
        const compressibleTypes = ['text/', 'application/json', 'application/javascript', 'application/xml'];
        if (compressibleTypes.some(type => contentType.startsWith(type))) {
            res.setHeader('Vary', 'Accept-Encoding');
        }

        // CORS 헤더 (필요시)
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Range, If-None-Match');

        // Range 요청 처리 (영상 파일에 중요)
        if (isRangeRequest && fileSize > 0) {
            res.status(206); // Partial Content
            const contentLength = end - start + 1;
            
            // 정확한 Range 헤더 설정
            res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
            res.setHeader('Content-Length', contentLength.toString());
            res.setHeader('Accept-Ranges', 'bytes');
            
            // 영상/오디오 파일의 경우 추가 헤더
            if (contentType.startsWith('video/') || contentType.startsWith('audio/')) {
                res.setHeader('Content-Transfer-Encoding', 'binary');
                res.setHeader('Connection', 'keep-alive');
            }
            
            if (DEBUG_FILE_STREAMING) {
                console.log(`📦 Serving partial content: ${fileName} (${contentLength} bytes)`);
            }
        } else {
            // 전체 파일 제공
            if (fileSize > 0) {
                res.setHeader('Content-Length', fileSize.toString());
            }
            res.setHeader('Accept-Ranges', 'bytes');
            
            // 영상 파일의 경우 추가 헤더
            if (contentType.startsWith('video/') || contentType.startsWith('audio/')) {
                res.setHeader('Content-Transfer-Encoding', 'binary');
                res.setHeader('Connection', 'keep-alive');
            }
        }

        // 스트리밍 최적화를 위한 파이프라인 사용
        try {
            // 클라이언트 연결 상태 확인
            if (req.destroyed || res.destroyed) {
                fileStream.destroy();
                return;
            }

            // 성공적인 파일 제공 시작 로그 (디버그 모드에서만)
            if (DEBUG_FILE_STREAMING) {
                const fileType = contentType.startsWith('video/') ? '📹' : 
                               contentType.startsWith('image/') ? '🖼️' : 
                               contentType.startsWith('audio/') ? '🎵' : '📄';
                console.log(`${fileType} Streaming started: ${fileName} (${isRangeRequest ? 'Range' : 'Full'})`);
            }

            // 영상 파일의 경우 스트리밍 최적화
            if (contentType.startsWith('video/') || contentType.startsWith('audio/')) {
                // 영상/오디오 파일은 버퍼링 최소화
                res.setTimeout(0); // 타임아웃 제거
                
                // 영상 스트리밍 시작 표시
                if (DEBUG_FILE_STREAMING) {
                    console.log(`🎬 Video streaming optimized for: ${fileName}`);
                }
            }

            // 클라이언트 연결 해제 감지
            req.on('close', () => {
                if (!fileStream.destroyed) {
                    fileStream.destroy();
                }
            });

            req.on('aborted', () => {
                if (!fileStream.destroyed) {
                    fileStream.destroy();
                }
            });

            // 안전한 파이프라인 사용
            await pipeline(fileStream, res);

            // 성공적인 완료 로그 (디버그 모드에서만)
            if (DEBUG_FILE_STREAMING) {
                console.log(`✅ Streaming completed: ${fileName}`);
            }

        } catch (pipelineError: any) {
            // Premature close 에러는 정상적인 클라이언트 연결 해제이므로 로그 레벨 조정
            if (pipelineError.code === 'ERR_STREAM_PREMATURE_CLOSE' || 
                pipelineError.code === 'ECONNRESET' ||
                pipelineError.code === 'EPIPE') {
                
                // 클라이언트가 연결을 중단한 경우 (비디오 탐색, 브라우저 새로고침 등)
                // 같은 파일에 대한 로그를 제한하여 스팸 방지
                const now = Date.now();
                const lastLogTime = disconnectLogCache.get(fileName) || 0;
                
                if (now - lastLogTime > DISCONNECT_LOG_INTERVAL || DEBUG_FILE_STREAMING) {
                    console.log(`📱 Client disconnected: ${fileName}`);
                    disconnectLogCache.set(fileName, now);
                }
                
            } else {
                console.error('Pipeline error:', pipelineError);
            }

            // 스트림 정리
            if (!fileStream.destroyed) {
                fileStream.destroy();
            }

            // 응답이 아직 보내지지 않았다면 에러 응답
            if (!res.headersSent) {
                res.status(500);
                return res.json({
                    success: false,
                    message: 'Error streaming file'
                });
            }
        }

    } catch (error) {
        console.error('Error in file download route:', error);
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
