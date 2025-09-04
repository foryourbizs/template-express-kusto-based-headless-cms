import crypto from 'crypto';
import { pipeline } from 'stream/promises';
import { Request, Response } from 'express';
import { Readable } from 'stream';

// 디버그 모드 설정
const DEBUG_FILE_STREAMING = process.env.DEBUG_FILE_STREAMING === 'true';

// 활성 스트림 관리를 위한 맵
const activeStreams = new Map<string, { stream: any, startTime: number }>();

/**
 * HTTP 파일 스트리밍과 관련된 모든 기능을 제공하는 모듈
 */
export default class FileStreamingModule {

    /**
     * 디버그 모드 상태 반환
     */
    public get DEBUG_FILE_STREAMING(): boolean {
        return DEBUG_FILE_STREAMING;
    }

    /**
     * 스트림 정리 함수
     */
    public cleanupStream(streamId: string, stream: any): void {
        try {
            if (stream && !stream.destroyed) {
                stream.destroy();
            }
            activeStreams.delete(streamId);
        } catch (error) {
            console.error('Error cleaning up stream:', error);
        }
    }

    /**
     * 파일 확장자에 따른 Content-Type 반환
     */
    public getContentType(filename: string): string {
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
    }

    /**
     * ETag 생성 (파일명 + 타임스탬프 기반)
     */
    public generateETag(fileName: string): string {
        return crypto.createHash('md5').update(`${fileName}-${Date.now()}`).digest('hex');
    }

    /**
     * Range 요청 파싱
     */
    public parseRangeRequest(rangeHeader: string | undefined, fileSize: number): {
        isRangeRequest: boolean;
        start: number;
        end: number;
        isValid: boolean;
    } {
        let start = 0;
        let end = fileSize - 1;
        let isRangeRequest = false;
        let isValid = true;

        if (rangeHeader && fileSize > 0) {
            isRangeRequest = true;
            const parts = rangeHeader.replace(/bytes=/, "").split("-");
            start = parseInt(parts[0], 10) || 0;
            end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            
            // 범위 검증
            if (start >= fileSize) {
                isValid = false;
            }
            
            if (end >= fileSize) {
                end = fileSize - 1;
            }
        }

        return { isRangeRequest, start, end, isValid };
    }

    /**
     * 파일 타입별 캐시 정책 설정
     */
    public setCacheHeaders(res: Response, contentType: string): void {
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
    }

    /**
     * 기본 응답 헤더 설정
     */
    public setBasicHeaders(res: Response, fileName: string, contentType: string, etag: string): void {
        res.setHeader('Content-Type', contentType);
        res.setHeader('ETag', `"${etag}"`);
        res.setHeader('Last-Modified', new Date().toUTCString());
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

        // CORS 헤더
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Range, If-None-Match');
    }

    /**
     * Range 응답 헤더 설정
     */
    public setRangeHeaders(res: Response, start: number, end: number, fileSize: number, contentType: string): void {
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
            console.log(`📦 Serving partial content: ${contentLength} bytes`);
        }
    }

    /**
     * 전체 파일 응답 헤더 설정
     */
    public setFullFileHeaders(res: Response, fileSize: number, contentType: string): void {
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

    /**
     * 스트리밍 파이프라인 실행
     */
    public async executeStreamingPipeline(
        req: Request,
        res: Response,
        fileStream: Readable,
        fileName: string,
        contentType: string
    ): Promise<void> {
        // 고유 스트림 ID 생성
        const streamId = `${fileName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // 클라이언트 연결 상태 확인
        if (req.destroyed || res.destroyed) {
            this.cleanupStream(streamId, fileStream);
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
                this.cleanupStream(streamId, fileStream);
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
            this.cleanupStream(streamId, fileStream);
            
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

        try {
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
                throw new Error(`Error streaming file: ${pipelineError.code}`);
            }
        }
    }

    /**
     * 로그 처리 - 영상 파일 요청 시 간단 로그
     */
    public logVideoRequest(fileName: string, fileSize: number, contentType: string): void {
        if (contentType.startsWith('video/') && DEBUG_FILE_STREAMING) {
            console.log(`🎬 Video streaming: ${fileName} (${fileSize} bytes)`);
        }
    }

    /**
     * Range 요청 로그
     */
    public logRangeRequest(fileName: string, start: number, end: number, fileSize: number, contentType: string): void {
        if (DEBUG_FILE_STREAMING) {
            const fileType = contentType.startsWith('video/') ? '📹' : 
                           contentType.startsWith('image/') ? '🖼️' : 
                           contentType.startsWith('audio/') ? '🎵' : '📄';
            console.log(`${fileType} Range request: ${fileName}, bytes ${start}-${end}/${fileSize}`);
        }
    }

    /**
     * 주기적으로 오래된 스트림 정리 (메모리 누수 방지)
     */
    public startStreamCleanupInterval(): void {
        setInterval(() => {
            const now = Date.now();
            const streamTimeout = 600000; // 10분
            
            activeStreams.forEach((streamInfo, streamId) => {
                if (now - streamInfo.startTime > streamTimeout) {
                    if (DEBUG_FILE_STREAMING) {
                        console.warn(`🧹 Cleaning up old stream: ${streamId}`);
                    }
                    this.cleanupStream(streamId, streamInfo.stream);
                }
            });
        }, 300000); // 5분마다 실행
    }

    /**
     * 활성 스트림 정보 반환
     */
    public getActiveStreamsInfo(): {
        count: number;
        streams: Array<{ id: string; startTime: number; duration: number }>;
    } {
        const now = Date.now();
        const streams: Array<{ id: string; startTime: number; duration: number }> = [];
        
        activeStreams.forEach((streamInfo, streamId) => {
            streams.push({
                id: streamId,
                startTime: streamInfo.startTime,
                duration: now - streamInfo.startTime
            });
        });

        return {
            count: activeStreams.size,
            streams
        };
    }

    /**
     * 모든 활성 스트림 정리
     */
    public cleanupAllStreams(): void {
        activeStreams.forEach((streamInfo, streamId) => {
            this.cleanupStream(streamId, streamInfo.stream);
        });
    }
}
