// generateDownloadPresignedUrl

import { ExpressRouter } from '@lib/expressRouter';
import crypto from 'crypto';
import { pipeline } from 'stream/promises';

const router = new ExpressRouter();

// 디버그 모드 설정
const DEBUG_FILE_STREAMING = process.env.DEBUG_FILE_STREAMING === 'true';

// 활성 스트림 관리를 위한 맵
const activeStreams = new Map<string, { stream: any, startTime: number }>();

// 스트림 정리 함수
const cleanupStream = (streamId: string, stream: any) => {
    try {
        if (stream && !stream.destroyed) {
            stream.destroy();
        }
        activeStreams.delete(streamId);
    } catch (error) {
        console.error('Error cleaning up stream:', error);
    }
};

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
        
        // 영상 파일 요청 시 간단 로그
        if (contentType.startsWith('video/') && DEBUG_FILE_STREAMING) {
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
            // 고유 스트림 ID 생성
            const streamId = `${fileName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            // 클라이언트 연결 상태 확인
            if (req.destroyed || res.destroyed) {
                cleanupStream(streamId, fileStream);
                return;
            }

            // 활성 스트림으로 등록
            activeStreams.set(streamId, { stream: fileStream, startTime: Date.now() });

            // 동적 타임아웃 관리 (스트리밍 중에는 연장)
            let streamTimeout: NodeJS.Timeout | undefined;
            const resetTimeout = () => {
                if (streamTimeout) {
                    clearTimeout(streamTimeout);
                }
                streamTimeout = setTimeout(() => {
                    console.warn(`⏰ Stream timeout for ${fileName}, cleaning up...`);
                    cleanupStream(streamId, fileStream);
                    if (!res.headersSent) {
                        res.status(408).json({
                            success: false,
                            message: 'Request timeout - no activity'
                        });
                    }
                }, 300000); // 5분 비활성 타임아웃
            };
            
            // 초기 타임아웃 설정
            resetTimeout();

            // 성공적인 파일 제공 시작 로그 (디버그 모드에서만, 영상만)
            if (DEBUG_FILE_STREAMING && contentType.startsWith('video/')) {
                console.log(`📹 Video streaming started: ${fileName} [${streamId}]`);
            }

            // 영상 파일의 경우 스트리밍 최적화
            if (contentType.startsWith('video/') || contentType.startsWith('audio/')) {
                // 영상/오디오 파일은 버퍼링 최소화
                res.setTimeout(0); // 타임아웃 제거
            }

            // 연결 상태 모니터링을 위한 개선된 이벤트 리스너
            const connectionClosed = () => {
                if (streamTimeout) {
                    clearTimeout(streamTimeout);
                }
                cleanupStream(streamId, fileStream);
                
                // 디버그 모드에서만 연결 해제 로그
                if (DEBUG_FILE_STREAMING) {
                    console.log(`📱 Client disconnected: ${fileName} [${streamId}]`);
                }
            };

            // 다양한 연결 해제 이벤트 처리
            req.on('close', connectionClosed);
            req.on('aborted', connectionClosed);
            req.on('error', (error) => {
                console.error(`Request error for ${fileName}:`, error.message);
                connectionClosed();
            });

            // 응답 스트림 에러 처리
            res.on('error', (error) => {
                console.error(`Response error for ${fileName}:`, error.message);
                connectionClosed();
            });

            // 파일 스트림에 데이터 이벤트 리스너 추가 (활성 상태 감지)
            fileStream.on('data', () => {
                // 데이터가 전송되고 있다면 타임아웃 리셋
                resetTimeout();
            });

            // 파일 스트림 에러 처리
            fileStream.on('error', (error: any) => {
                console.error(`File stream error for ${fileName}:`, error.message);
                if (streamTimeout) {
                    clearTimeout(streamTimeout);
                }
                connectionClosed();
                if (!res.headersSent) {
                    res.status(500).json({
                        success: false,
                        message: 'File stream error'
                    });
                }
            });

            // 안전한 파이프라인 사용 with 에러 복구
            await pipeline(fileStream, res);

            // 정상 완료 시 정리
            if (streamTimeout) {
                clearTimeout(streamTimeout);
            }
            activeStreams.delete(streamId);

            // 성공적인 완료 로그 (디버그 모드에서만, 영상만)
            if (DEBUG_FILE_STREAMING && contentType.startsWith('video/')) {
                console.log(`✅ Video streaming completed: ${fileName} [${streamId}]`);
            }

        } catch (pipelineError: any) {
            // 에러 발생 시 스트림 정리
            if (!fileStream.destroyed) {
                fileStream.destroy();
            }

            // Premature close 에러는 정상적인 클라이언트 연결 해제이므로 로그 레벨 조정
            if (pipelineError.code === 'ERR_STREAM_PREMATURE_CLOSE' || 
                pipelineError.code === 'ECONNRESET' ||
                pipelineError.code === 'EPIPE' ||
                pipelineError.code === 'ECONNABORTED') {
                
                // 클라이언트가 연결을 중단한 경우 - 디버그 모드에서만 로그
                if (DEBUG_FILE_STREAMING) {
                    console.log(`📱 Client disconnected: ${fileName} (${pipelineError.code})`);
                }
                
            } else if (pipelineError.code === 'ERR_STREAM_DESTROYED') {
                // 스트림이 이미 파괴된 경우 - 정상적인 정리 과정
                if (DEBUG_FILE_STREAMING) {
                    console.log(`🧹 Stream already destroyed: ${fileName}`);
                }
            } else {
                // 실제 에러인 경우만 로그
                console.error(`❌ Pipeline error for ${fileName}:`, {
                    code: pipelineError.code,
                    message: pipelineError.message
                });
            }

            // 응답이 아직 보내지지 않았다면 에러 응답
            if (!res.headersSent) {
                res.status(500);
                return res.json({
                    success: false,
                    message: 'Error streaming file',
                    error: pipelineError.code
                });
            }
        }

    } catch (error) {
        console.error('Error in file download route:', error);
        
        // 에러 발생 시 모든 활성 스트림 정리
        activeStreams.forEach((streamInfo, streamId) => {
            cleanupStream(streamId, streamInfo.stream);
        });
        
        if (!res.headersSent) {
            res.status(500);
            return res.json({
                success: false,
                message: 'Internal server error'
            });
        }
    }
});

// 주기적으로 오래된 스트림 정리 (메모리 누수 방지)
setInterval(() => {
    const now = Date.now();
    const streamTimeout = 600000; // 10분
    
    activeStreams.forEach((streamInfo, streamId) => {
        if (now - streamInfo.startTime > streamTimeout) {
            if (DEBUG_FILE_STREAMING) {
                console.warn(`🧹 Cleaning up old stream: ${streamId}`);
            }
            cleanupStream(streamId, streamInfo.stream);
        }
    });
}, 300000); // 5분마다 실행

export default router.build();
