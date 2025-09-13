import crypto from 'crypto';
import { pipeline } from 'stream/promises';
import { Request, Response } from 'express';
import { Readable } from 'stream';

// 디버그 모드 설정
const DEBUG_FILE_STREAMING = process.env.DEBUG_FILE_STREAMING === 'true';

// 활성 스트림 관리를 위한 맵
const activeStreams = new Map<string, { stream: any, startTime: number }>();

// 진행 중인 요청 관리 (중복 제거용)
const pendingRequests = new Map<string, Promise<any>>();

// 요청 잠금 관리 (동시 요청 완전 차단)
const requestLocks = new Map<string, { 
    processing: boolean, 
    waitingRequests: Array<{ resolve: Function, reject: Function }>,
    result?: any,
    error?: any
}>();

// 파일별 동시 요청 제한 (Range 요청 포함)
const fileRequestLimits = new Map<string, {
    activeRequests: number,
    maxConcurrent: number,
    waitingQueue: Array<{ resolve: Function, reject: Function, requestInfo: string }>,
    lastRequestTime: number,
    requestBurst: number
}>();

// 파일 메타데이터 캐시 (성능 최적화된 캐싱)
const metadataCache = new Map<string, { metadata: any, timestamp: number }>();
const METADATA_CACHE_TTL = 300000; // 5분으로 연장 (성능 최적화)

// 파일별 최대 동시 요청 수 (성능 최적화)
const MAX_CONCURRENT_REQUESTS_PER_FILE = 3; // 합리적인 수준으로 완화

// 버스트 요청 감지 설정 (성능 최적화)
const BURST_TIME_WINDOW = 2000; // 2초로 단축
const MAX_BURST_REQUESTS = 3; // 2초 내 최대 3개 요청 허용 (정상적인 브라우저 동작 허용)

// 파일별 요청 패턴 추적
const fileRequestPatterns = new Map<string, {
    requests: Array<{ timestamp: number, range: string, size: number }>,
    totalRequests: number,
    lastCleanup: number
}>();

/**
 * HTTP 파일 스트리밍과 관련된 모든 기능을 제공하는 모듈
 */
export default class FileStreamingModule {

    private static cleanupIntervalStarted = false;

    constructor() {
        // 첫 번째 인스턴스에서만 cleanup interval 시작
        if (!FileStreamingModule.cleanupIntervalStarted) {
            this.startStreamCleanupInterval();
            FileStreamingModule.cleanupIntervalStarted = true;
        }
    }

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
     * Range 응답 헤더 설정 (연결 유지 강화)
     */
    public setRangeHeaders(res: Response, start: number, end: number, fileSize: number, contentType: string): void {
        res.status(206); // Partial Content
        const contentLength = end - start + 1;
        
        // 정확한 Range 헤더 설정
        res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
        res.setHeader('Content-Length', contentLength.toString());
        res.setHeader('Accept-Ranges', 'bytes');
        
        // 연결 유지를 위한 강화된 헤더
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Keep-Alive', 'timeout=300, max=100'); // 5분 타임아웃, 최대 100개 요청
        
        // 영상/오디오 파일의 경우 추가 헤더
        if (contentType.startsWith('video/') || contentType.startsWith('audio/')) {
            res.setHeader('Content-Transfer-Encoding', 'binary');
            // 브라우저에게 스트리밍 중임을 알리는 헤더
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('X-Frame-Options', 'SAMEORIGIN');
        }

        if (DEBUG_FILE_STREAMING) {
            console.log(`📦 Serving partial content: ${contentLength} bytes`);
        }
    }

    /**
     * 전체 파일 응답 헤더 설정 (연결 유지 강화)
     */
    public setFullFileHeaders(res: Response, fileSize: number, contentType: string): void {
        if (fileSize > 0) {
            res.setHeader('Content-Length', fileSize.toString());
        }
        res.setHeader('Accept-Ranges', 'bytes');
        
        // 연결 유지를 위한 강화된 헤더
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Keep-Alive', 'timeout=300, max=100'); // 5분 타임아웃, 최대 100개 요청
        
        // 영상 파일의 경우 추가 헤더
        if (contentType.startsWith('video/') || contentType.startsWith('audio/')) {
            res.setHeader('Content-Transfer-Encoding', 'binary');
            // 브라우저에게 스트리밍 중임을 알리는 헤더
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('X-Frame-Options', 'SAMEORIGIN');
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
        if (!this.isConnectionAlive(req, res)) {
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

        // 성공적인 파일 제공 시작 로그 (간소화)
        if (DEBUG_FILE_STREAMING && contentType.startsWith('video/')) {
            console.log(`📹 Video streaming: ${fileName}`);
        }

        // 영상 파일의 경우 스트리밍 최적화 및 연결 유지 강화
        if (contentType.startsWith('video/') || contentType.startsWith('audio/')) {
            // 영상/오디오 파일은 버퍼링 최소화
            res.setTimeout(0); // 타임아웃 제거
            
            // 강화된 연결 안정성 설정
            if (!req.destroyed && !res.destroyed) {
                res.setHeader('Connection', 'keep-alive');
                res.setHeader('Keep-Alive', 'timeout=300, max=100'); // 5분 타임아웃, 최대 100개 요청
                
                // HTTP/1.1 연결 유지를 위한 추가 헤더
                res.setHeader('Cache-Control', 'no-cache'); // 캐시 방지로 실시간 스트리밍 보장
                res.setHeader('Pragma', 'no-cache');
                
                // 브라우저에게 스트리밍이 진행 중임을 알리는 헤더
                res.setHeader('Transfer-Encoding', 'chunked');
            }
        }

        // 연결 상태 모니터링을 위한 개선된 이벤트 리스너
        const connectionClosed = () => {
            if (streamTimeout) {
                clearTimeout(streamTimeout);
            }
            this.cleanupStream(streamId, fileStream);
            
            // 디버그 모드에서만 연결 해제 로그 (aborted가 아닌 경우만)
            if (DEBUG_FILE_STREAMING && !req.aborted) {
                console.log(`📱 Client disconnected: ${fileName} [${streamId}]`);
            }
        };

        // 다양한 연결 해제 이벤트 처리
        req.on('close', connectionClosed);
        req.on('aborted', connectionClosed);
        req.on('error', (error: any) => {
            // 'aborted' 에러는 정상적인 클라이언트 연결 해제이므로 로그 레벨 조정
            if (error.message === 'aborted' || error.code === 'ECONNABORTED') {
                if (DEBUG_FILE_STREAMING) {
                    console.log(`📱 Client aborted request: ${fileName}`);
                }
            } else {
                console.error(`Request error for ${fileName}:`, error.message);
            }
            connectionClosed();
        });

        // 응답 스트림 에러 처리
        res.on('error', (error: any) => {
            // 클라이언트 연결 해제 관련 에러는 디버그 모드에서만 로그
            if (error.code === 'ECONNRESET' || error.code === 'EPIPE' || 
                error.code === 'ECONNABORTED' || error.message === 'aborted') {
                if (DEBUG_FILE_STREAMING) {
                    console.log(`📱 Client connection error: ${fileName} (${error.code || error.message})`);
                }
            } else {
                console.error(`Response error for ${fileName}:`, error.message);
            }
            connectionClosed();
        });

        // 파일 스트림에 데이터 이벤트 리스너 추가 (활성 상태 감지)
        let dataEventCount = 0;
        let lastConnectionCheckTime = Date.now();
        fileStream.on('data', (chunk: any) => {
            dataEventCount++;
            // 데이터가 전송되고 있다면 타임아웃 리셋
            resetTimeout();
            
            // 연결 상태 체크를 5초마다로 제한
            const now = Date.now();
            if (now - lastConnectionCheckTime > 5000) {
                if (!this.isConnectionAlive(req, res)) {
                    if (DEBUG_FILE_STREAMING) {
                        console.log(`📱 Connection lost during streaming: ${fileName}`);
                    }
                    connectionClosed();
                    return;
                }
                lastConnectionCheckTime = now;
            }
        });

        // 파일 스트림 에러 처리
        fileStream.on('error', (error: any) => {
            // 클라이언트 연결 해제 관련 에러는 디버그 모드에서만 로그
            if (error.code === 'ECONNRESET' || error.code === 'EPIPE' || 
                error.code === 'ECONNABORTED' || error.message === 'aborted') {
                if (DEBUG_FILE_STREAMING) {
                    console.log(`📱 File stream client disconnect: ${fileName} (${error.code || error.message})`);
                }
            } else {
                console.error(`File stream error for ${fileName}:`, error.message);
            }
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

            // 성공적인 완료 로그 (간소화)
            if (DEBUG_FILE_STREAMING && contentType.startsWith('video/')) {
                console.log(`✅ Video streaming completed: ${fileName}`);
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
            console.log(`🎬 Video streaming: ${fileName} (${this.formatBytes(fileSize)})`);
        }
    }

    /**
     * Range 요청 로그 (더 상세한 정보 포함)
     */
    public logRangeRequest(fileName: string, start: number, end: number, fileSize: number, contentType: string): void {
        if (DEBUG_FILE_STREAMING) {
            const fileType = contentType.startsWith('video/') ? '📹' : 
                           contentType.startsWith('image/') ? '🖼️' : 
                           contentType.startsWith('audio/') ? '🎵' : '📄';
            const rangeSize = this.formatBytes(end - start + 1);
            const totalSize = this.formatBytes(fileSize);
            const percentage = ((end - start + 1) / fileSize * 100).toFixed(1);
            console.log(`${fileType} Range request: ${fileName}, ${rangeSize}/${totalSize} (${percentage}%) [${start}-${end}]`);
        }
    }

    /**
     * 바이트 크기를 읽기 쉬운 형태로 변환
     */
    private formatBytes(bytes: number): string {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    /**
     * 주기적으로 오래된 스트림 정리 (메모리 누수 방지)
     */
    public startStreamCleanupInterval(): void {
        setInterval(() => {
            const now = Date.now();
            const streamTimeout = 600000; // 10분
            
            // 오래된 스트림 정리
            activeStreams.forEach((streamInfo, streamId) => {
                if (now - streamInfo.startTime > streamTimeout) {
                    if (DEBUG_FILE_STREAMING) {
                        console.warn(`🧹 Cleaning up old stream: ${streamId}`);
                    }
                    this.cleanupStream(streamId, streamInfo.stream);
                }
            });

            // 메타데이터 캐시 정리
            this.cleanupMetadataCache();

            // 요청 락 정리 (완료된 것들)
            const lockTimeout = 300000; // 5분
            requestLocks.forEach((lock, key) => {
                if (!lock.processing && lock.result !== undefined) {
                    // 완료된 락 중 오래된 것들 정리
                    requestLocks.delete(key);
                }
            });

            // 진행 중인 요청 정리 (타임아웃된 것들)
            const requestTimeout = 120000; // 2분
            pendingRequests.forEach((promise, key) => {
                // 2분 이상된 요청은 강제로 제거 (메모리 누수 방지)
                if (key.includes('_')) {
                    const timestamp = parseInt(key.split('_').pop() || '0');
                    if (now - timestamp > requestTimeout) {
                        pendingRequests.delete(key);
                        if (DEBUG_FILE_STREAMING) {
                            console.warn(`🧹 Cleaning up timeout request: ${key}`);
                        }
                    }
                }
            });

            // 파일별 요청 제한 정리 (더 긴 유지 시간)
            const requestLimitTimeout = 300000; // 5분으로 증가 (버스트 감지를 위해)
            fileRequestLimits.forEach((limit, fileName) => {
                // 5분 이상 비활성 상태이고 대기 큐가 비어있으면 정리
                if (limit.activeRequests === 0 && 
                    limit.waitingQueue.length === 0 && 
                    now - limit.lastRequestTime > requestLimitTimeout) {
                    fileRequestLimits.delete(fileName);
                    if (DEBUG_FILE_STREAMING) {
                        console.log(`🧹 Cleaned up file tracking: ${fileName} (inactive for ${Math.round((now - limit.lastRequestTime) / 1000)}s)`);
                    }
                }
            });

            // 요청 패턴 정리
            fileRequestPatterns.forEach((pattern, fileName) => {
                if (now - pattern.lastCleanup > 600000) { // 10분 이상된 패턴 정리
                    fileRequestPatterns.delete(fileName);
                }
            });

            if (DEBUG_FILE_STREAMING) {
                const stats = {
                    activeStreams: activeStreams.size,
                    pendingRequests: pendingRequests.size,
                    requestLocks: requestLocks.size,
                    fileRequestLimits: fileRequestLimits.size,
                    fileRequestPatterns: fileRequestPatterns.size,
                    metadataCache: metadataCache.size
                };
                if (stats.activeStreams > 0 || stats.pendingRequests > 0 || 
                    stats.requestLocks > 0 || stats.fileRequestLimits > 0 || 
                    stats.fileRequestPatterns > 0 || stats.metadataCache > 0) {
                    console.log(`📊 Stream stats:`, stats);
                }
            }

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
        if (DEBUG_FILE_STREAMING && activeStreams.size > 0) {
            console.log(`🧹 Cleaning up ${activeStreams.size} active streams`);
        }
        activeStreams.forEach((streamInfo, streamId) => {
            this.cleanupStream(streamId, streamInfo.stream);
        });
    }

    /**
     * 연결 상태를 확인하는 헬퍼 메서드
     */
    public isConnectionAlive(req: Request, res: Response): boolean {
        return !req.destroyed && !res.destroyed && !req.aborted && res.writable;
    }

    /**
     * 파일 메타데이터를 완전한 중복 제거로 조회 (동기 잠금)
     */
    public async getFileMetadataWithDeduplication(
        cloudflareR2: any, 
        fileName: string,
        storageConfig: any
    ): Promise<any> {
        const lockKey = `metadata_${fileName}`;
        
        // 캐시 확인 (가장 빠른 경로)
        const cached = metadataCache.get(lockKey);
        if (cached && (Date.now() - cached.timestamp) < METADATA_CACHE_TTL) {
            if (DEBUG_FILE_STREAMING) {
                console.log(`📦 Cache hit for metadata: ${fileName}`);
            }
            return cached.metadata;
        }

        return await this.acquireLockAndExecute(lockKey, async () => {
            // 락 획득 후 다시 캐시 확인 (다른 요청이 이미 처리했을 수 있음)
            const recheck = metadataCache.get(lockKey);
            if (recheck && (Date.now() - recheck.timestamp) < METADATA_CACHE_TTL) {
                return recheck.metadata;
            }

            // 실제 메타데이터 조회
            const metadata = await cloudflareR2.getFileMetadata(fileName, storageConfig);
            
            // 캐시에 저장
            if (metadata) {
                metadataCache.set(lockKey, {
                    metadata,
                    timestamp: Date.now()
                });
            }

            return metadata;
        });
    }

    /**
     * 파일별 동시 요청 제한을 통한 최적화된 스트림 조회
     */
    public async getFileStreamWithDeduplication(
        cloudflareR2: any,
        fileName: string,
        storageConfig: any,
        isRangeRequest: boolean,
        start?: number,
        end?: number
    ): Promise<any> {
        // 성능 최적화: 파일별 요청 제한을 덜 엄격하게 적용
        await this.acquireFileRequestSlot(fileName, isRangeRequest, start, end);

        try {
            // 성능 최적화: Range 요청의 경우 락 없이 바로 실행
            if (isRangeRequest && start !== undefined && end !== undefined) {
                return await cloudflareR2.downloadFileRange(fileName, start, end, storageConfig);
            } else {
                return await cloudflareR2.downloadFile(fileName, storageConfig);
            }
        } finally {
            // 요청 완료 후 슬롯 해제
            this.releaseFileRequestSlot(fileName);
        }
    }

    /**
     * 파일별 요청 슬롯 획득 (수정된 버스트 요청 감지)
     */
    private async acquireFileRequestSlot(
        fileName: string, 
        isRangeRequest: boolean, 
        start?: number, 
        end?: number
    ): Promise<void> {
        const fileKey = fileName;
        const now = Date.now();
        let fileLimit = fileRequestLimits.get(fileKey);

        if (!fileLimit) {
            fileLimit = {
                activeRequests: 0,
                maxConcurrent: MAX_CONCURRENT_REQUESTS_PER_FILE,
                waitingQueue: [],
                lastRequestTime: now,
                requestBurst: 1
            };
            fileRequestLimits.set(fileKey, fileLimit);
            
            if (DEBUG_FILE_STREAMING) {
                console.log(`🆕 New file tracking: ${fileName}`);
            }
        } else {
            // 버스트 요청 감지 - 마지막 요청과의 시간 간격 체크
            const timeSinceLastRequest = now - fileLimit.lastRequestTime;
            
            if (timeSinceLastRequest < BURST_TIME_WINDOW) {
                fileLimit.requestBurst++;
                
                // 성능 최적화: 과도한 버스트만 로깅
                if (DEBUG_FILE_STREAMING && fileLimit.requestBurst > MAX_BURST_REQUESTS) {
                    console.log(`🔥 Burst detected for ${fileName}: request #${fileLimit.requestBurst} within ${timeSinceLastRequest}ms`);
                }
            } else {
                // 버스트 윈도우를 벗어났으므로 카운터 리셋
                fileLimit.requestBurst = 1;
            }
        }

        const requestInfo = isRangeRequest ? `${start}-${end}` : 'full';

        // 버스트 요청 강력한 제한 확인 - 성능 최적화된 조건
        if (fileLimit.requestBurst > MAX_BURST_REQUESTS) {
            // 보다 합리적인 대기 시간으로 조정
            const baseWaitTime = Math.min(BURST_TIME_WINDOW, 3000); // 최대 3초로 제한
            const extraWaitTime = Math.min((fileLimit.requestBurst - MAX_BURST_REQUESTS) * 500, 2000); // 초과 요청당 0.5초, 최대 2초
            const randomJitter = Math.random() * 500; // 0.5초 랜덤 지터
            const totalWaitTime = baseWaitTime + extraWaitTime + randomJitter;
            
            if (DEBUG_FILE_STREAMING) {
                console.log(`🚫 BURST PROTECTION: ${fileName} request #${fileLimit.requestBurst} delayed ${Math.round(totalWaitTime)}ms`);
            }

            // 합리적인 버스트 방지 대기
            await new Promise(resolve => setTimeout(resolve, totalWaitTime));
            
            if (DEBUG_FILE_STREAMING) {
                console.log(`✅ Burst protection completed: ${fileName}`);
            }
        }

        // lastRequestTime을 처리 완료 후 업데이트
        fileLimit.lastRequestTime = Date.now();

        // 현재 활성 요청이 제한을 초과하는지 확인
        if (fileLimit.activeRequests >= fileLimit.maxConcurrent) {
            if (DEBUG_FILE_STREAMING) {
                console.log(`🚦 Request queued: ${fileName} (${requestInfo})`);
            }

            // 대기 큐에 추가
            return new Promise<void>((resolve, reject) => {
                fileLimit!.waitingQueue.push({ resolve, reject, requestInfo });
            });
        }

        // 슬롯 사용
        fileLimit.activeRequests++;
        
        // 성능 최적화: 간소화된 로깅
        if (DEBUG_FILE_STREAMING && fileLimit.requestBurst > 1) {
            console.log(`✅ Request slot acquired: ${fileName} (${requestInfo}), burst: ${fileLimit.requestBurst}`);
        }
    }

    /**
     * 파일별 요청 슬롯 해제 (파일 추적 유지)
     */
    private releaseFileRequestSlot(fileName: string): void {
        const fileKey = fileName;
        const fileLimit = fileRequestLimits.get(fileKey);

        if (!fileLimit) return;

        // 활성 요청 수 감소
        fileLimit.activeRequests = Math.max(0, fileLimit.activeRequests - 1);

        // 대기 중인 요청이 있으면 다음 요청 처리
        if (fileLimit.waitingQueue.length > 0 && fileLimit.activeRequests < fileLimit.maxConcurrent) {
            const nextRequest = fileLimit.waitingQueue.shift();
            if (nextRequest) {
                fileLimit.activeRequests++;
                if (DEBUG_FILE_STREAMING) {
                    console.log(`🚀 Processing queued request: ${fileName}`);
                }
                nextRequest.resolve();
            }
        }

        // ⚠️ 파일 추적 정보를 삭제하지 않음 - 버스트 감지를 위해 유지
        // 대신 5분 후에 자동 정리되도록 함 (startStreamCleanupInterval에서 처리)
    }

    /**
     * 락을 획득하고 함수를 실행하는 핵심 메서드
     */
    private async acquireLockAndExecute<T>(lockKey: string, executeFunction: () => Promise<T>): Promise<T> {
        // 이미 진행 중인 요청이 있는지 확인
        const existingLock = requestLocks.get(lockKey);
        
        if (existingLock) {
            if (existingLock.processing) {
                // 진행 중이면 대기 큐에 추가
                if (DEBUG_FILE_STREAMING) {
                    console.log(`⏳ Waiting in queue for: ${lockKey}`);
                }
                
                return new Promise<T>((resolve, reject) => {
                    existingLock.waitingRequests.push({ resolve, reject });
                });
            } else if (existingLock.result !== undefined) {
                // 이미 완료된 결과가 있으면 즉시 반환
                if (DEBUG_FILE_STREAMING) {
                    console.log(`✅ Using completed result for: ${lockKey}`);
                }
                return existingLock.result;
            } else if (existingLock.error) {
                // 에러가 있으면 에러 throw
                throw existingLock.error;
            }
        }

        // 새로운 락 생성
        const lock = {
            processing: true,
            waitingRequests: [] as Array<{ resolve: Function, reject: Function }>,
            result: undefined as T | undefined,
            error: undefined as any
        };
        
        requestLocks.set(lockKey, lock);

        try {
            // 실제 작업 실행
            const result = await executeFunction();
            
            // 결과 저장
            lock.result = result;
            lock.processing = false;

            // 대기 중인 모든 요청에 결과 전달
            lock.waitingRequests.forEach(({ resolve }) => {
                resolve(result);
            });

            if (DEBUG_FILE_STREAMING && lock.waitingRequests.length > 0) {
                console.log(`� Notified ${lock.waitingRequests.length} waiting requests for: ${lockKey}`);
            }

            // 일정 시간 후 락 정리 (결과 캐싱을 위해 잠시 유지)
            setTimeout(() => {
                requestLocks.delete(lockKey);
            }, 5000); // 5초 후 정리

            return result;

        } catch (error) {
            // 에러 저장
            lock.error = error;
            lock.processing = false;

            // 대기 중인 모든 요청에 에러 전달
            lock.waitingRequests.forEach(({ reject }) => {
                reject(error);
            });

            // 에러 시 즉시 락 정리
            requestLocks.delete(lockKey);
            
            throw error;
        }
    }

    /**
     * 메타데이터 캐시 정리
     */
    public cleanupMetadataCache(): void {
        const now = Date.now();
        metadataCache.forEach((value, key) => {
            if (now - value.timestamp > METADATA_CACHE_TTL) {
                metadataCache.delete(key);
            }
        });
    }
}
