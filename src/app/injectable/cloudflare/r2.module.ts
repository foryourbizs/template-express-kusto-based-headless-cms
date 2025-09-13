import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, DeleteObjectsCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import { log } from '@ext/winston'

// 저장소 설정 타입 정의
export interface StorageConfig {
    baseUrl: string;
    bucketName: string;
    region: string;
    accessKey: string;
    secretKey: string;
}

export default class CloudflareR2Module {
    // S3Client 인스턴스 캐싱을 위한 Map
    private static clientCache = new Map<string, S3Client>();

    /**
     * 동적 S3 클라이언트 생성 (캐싱 지원)
     * @param storageConfig - 저장소 설정 정보 (필수)
     * @returns S3Client 인스턴스
     */
    private createS3Client(storageConfig: StorageConfig): S3Client {
        // 캐시 키 생성 (보안을 위해 해시 사용)
        const cacheKey = `${storageConfig.baseUrl}-${storageConfig.region}-${storageConfig.accessKey}`;
        
        // 캐시에서 기존 클라이언트 확인
        if (CloudflareR2Module.clientCache.has(cacheKey)) {
            return CloudflareR2Module.clientCache.get(cacheKey)!;
        }
        
        // 새 클라이언트 생성 및 캐시에 저장
        const newClient = new S3Client({
            region: storageConfig.region || "auto",
            endpoint: storageConfig.baseUrl,
            credentials: {
                accessKeyId: storageConfig.accessKey,
                secretAccessKey: storageConfig.secretKey,
            },
        });
        
        CloudflareR2Module.clientCache.set(cacheKey, newClient);
        return newClient;
    }

    /**
     * 캐시된 클라이언트 정리 (필요시 호출)
     * @param storageConfig - 정리할 저장소 설정 (미제공시 전체 캐시 정리)
     */
    public static clearClientCache(storageConfig?: StorageConfig): void {
        if (storageConfig) {
            const cacheKey = `${storageConfig.baseUrl}-${storageConfig.region}-${storageConfig.accessKey}`;
            const client = CloudflareR2Module.clientCache.get(cacheKey);
            if (client) {
                client.destroy?.(); // 연결 정리
                CloudflareR2Module.clientCache.delete(cacheKey);
            }
        } else {
            // 전체 캐시 정리
            CloudflareR2Module.clientCache.forEach(client => {
                client.destroy?.(); // 연결 정리
            });
            CloudflareR2Module.clientCache.clear();
        }
    }

    /**
     * 파일을 R2 버킷에 업로드합니다.
     * @param key - S3 객체 키 (파일명/경로)
     * @param body - 업로드할 데이터 (Buffer, Uint8Array, string, 또는 Readable stream)
     * @param contentType - 파일의 MIME 타입 (선택사항)
     * @param storageConfig - 저장소 설정 정보 (필수)
     * @returns Promise<boolean> - 업로드 성공 여부
     */
    public async uploadFile(
        key: string, 
        body: Buffer | Uint8Array | string | Readable, 
        contentType: string | undefined,
        storageConfig: StorageConfig
    ): Promise<boolean> {
        try {
            const s3Client = this.createS3Client(storageConfig);

            const command = new PutObjectCommand({
                Bucket: storageConfig.bucketName,
                Key: key,
                Body: body,
                ContentType: contentType
            });

            await s3Client.send(command);
            return true;
        } catch (error) {
            log.Error('R2 업로드 실패:', error);
            return false;
        }
    }

    /**
     * 업로드용 presigned URL을 생성합니다.
     * @param key - S3 객체 키 (파일명/경로)
     * @param expiresIn - URL 만료 시간 (초 단위, 기본값: 3600초 = 1시간)
     * @param contentType - 업로드할 파일의 MIME 타입 (선택사항)
     * @param storageConfig - 저장소 설정 정보 (필수)
     * @returns Promise<string | null> - presigned URL 또는 null (실패시)
     */
    public async generateUploadPresignedUrl(
        key: string,
        expiresIn: number = 3600,
        contentType: string | undefined,
        storageConfig: StorageConfig
    ): Promise<string | null> {
        try {
            const s3Client = this.createS3Client(storageConfig);

            const command = new PutObjectCommand({
                Bucket: storageConfig.bucketName,
                Key: key,
                ContentType: contentType
            });

            const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn });
            return presignedUrl;
        } catch (error) {
            log.Error('Presigned URL 생성 실패 (업로드):', error);
            return null;
        }
    }

    /**
     * 다운로드용 presigned URL을 생성합니다.
     * @param key - S3 객체 키 (파일명/경로)
     * @param expiresIn - URL 만료 시간 (초 단위, 기본값: 3600초 = 1시간)
     * @param storageConfig - 저장소 설정 정보 (필수)
     * @returns Promise<string | null> - presigned URL 또는 null (실패시)
     */
    public async generateDownloadPresignedUrl(
        key: string,
        expiresIn: number = 3600,
        storageConfig: StorageConfig
    ): Promise<string | null> {
        try {
            const s3Client = this.createS3Client(storageConfig);

            const command = new GetObjectCommand({
                Bucket: storageConfig.bucketName,
                Key: key
            });

            const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn });
            return presignedUrl;
        } catch (error) {
            log.Error('Presigned URL 생성 실패 (다운로드):', error);
            return null;
        }
    }

    

    /**
     * R2에서 파일을 다운로드합니다.
     * @param key - S3 객체 키 (파일명/경로)
     * @param storageConfig - 저장소 설정 정보 (필수)
     * @returns Promise<Readable | null> - 파일 스트림 또는 null (실패시)
     */
    public async downloadFile(key: string, storageConfig: StorageConfig): Promise<Readable | null> {
        try {
            const s3Client = this.createS3Client(storageConfig);

            const command = new GetObjectCommand({
                Bucket: storageConfig.bucketName,
                Key: key
            });

            const response = await s3Client.send(command);
            return response.Body as Readable;
        } catch (error) {
            log.Error('R2 다운로드 실패:', error);
            return null;
        }
    }

    /**
     * R2에서 단일 파일을 삭제합니다.
     * @param key - S3 객체 키 (파일명/경로)
     * @param storageConfig - 저장소 설정 정보 (필수)
     * @returns Promise<boolean> - 삭제 성공 여부
     */
    public async deleteFile(key: string, storageConfig: StorageConfig): Promise<boolean> {
        try {
            const s3Client = this.createS3Client(storageConfig);

            const command = new DeleteObjectCommand({
                Bucket: storageConfig.bucketName,
                Key: key
            });

            await s3Client.send(command);
            log.Info(`R2 파일 삭제 성공: ${key}`);
            return true;
        } catch (error) {
            log.Error('R2 파일 삭제 실패:', error);
            return false;
        }
    }

    /**
     * R2에서 여러 파일을 한 번에 삭제합니다.
     * @param keys - 삭제할 S3 객체 키들의 배열
     * @param storageConfig - 저장소 설정 정보 (필수)
     * @returns Promise<{succeeded: string[], failed: {key: string, error: string}[]}> - 삭제 결과
     */
    public async deleteMultipleFiles(
        keys: string[], 
        storageConfig: StorageConfig
    ): Promise<{succeeded: string[], failed: {key: string, error: string}[]}> {
        try {
            if (keys.length === 0) {
                return { succeeded: [], failed: [] };
            }

            // 최대 1000개 파일까지 한 번에 삭제 가능 (AWS S3 제한)
            if (keys.length > 1000) {
                throw new Error('한 번에 삭제할 수 있는 파일은 최대 1000개입니다.');
            }

            const s3Client = this.createS3Client(storageConfig);

            const command = new DeleteObjectsCommand({
                Bucket: storageConfig.bucketName,
                Delete: {
                    Objects: keys.map(key => ({ Key: key })),
                    Quiet: false // 삭제 결과를 상세히 받기 위해 false 설정
                }
            });

            const response = await s3Client.send(command);
            
            const succeeded = response.Deleted?.map((obj: any) => obj.Key || '') || [];
            const failed = response.Errors?.map((err: any) => ({
                key: err.Key || '',
                error: err.Message || 'Unknown error'
            })) || [];

            log.Info(`R2 파일 일괄 삭제 완료: 성공 ${succeeded.length}개, 실패 ${failed.length}개`);
            
            return { succeeded, failed };
        } catch (error) {
            log.Error('R2 파일 일괄 삭제 실패:', error);
            
            // 에러 발생시 모든 파일을 실패로 처리
            return {
                succeeded: [],
                failed: keys.map(key => ({
                    key,
                    error: error instanceof Error ? error.message : 'Unknown error'
                }))
            };
        }
    }

    /**
     * R2에서 특정 경로(prefix)의 모든 파일을 삭제합니다.
     * @param prefix - 삭제할 파일들의 경로 접두사 (예: "uploads/2025/09/")
     * @param storageConfig - 저장소 설정 정보 (필수)
     * @returns Promise<{count: number, succeeded: string[], failed: {key: string, error: string}[]}> - 삭제 결과
     */
    public async deleteFilesByPrefix(
        prefix: string, 
        storageConfig: StorageConfig
    ): Promise<{count: number, succeeded: string[], failed: {key: string, error: string}[]}> {
        try {
            // 먼저 해당 prefix로 시작하는 모든 파일 목록을 가져와야 함
            // 하지만 ListObjectsV2Command가 필요한데, 현재 import에 없으므로
            // 이 기능은 필요시 추가 구현하도록 안내
            
            throw new Error('deleteFilesByPrefix 기능은 ListObjectsV2Command 추가 구현이 필요합니다. 현재는 deleteMultipleFiles를 사용해주세요.');
            
        } catch (error) {
            log.Error('R2 경로별 파일 삭제 실패:', error);
            return {
                count: 0,
                succeeded: [],
                failed: [{
                    key: prefix,
                    error: error instanceof Error ? error.message : 'Unknown error'
                }]
            };
        }
    }

    /**
     * R2에서 파일이 존재하는지 확인합니다.
     * @param key - S3 객체 키 (파일명/경로)
     * @param storageConfig - 저장소 설정 정보 (필수)
     * @returns Promise<boolean> - 파일 존재 여부
     */
    public async fileExists(key: string, storageConfig: StorageConfig): Promise<boolean> {
        try {
            const s3Client = this.createS3Client(storageConfig);

            const command = new GetObjectCommand({
                Bucket: storageConfig.bucketName,
                Key: key
            });

            // 실제로 파일을 다운로드하지 않고 헤더만 확인
            await s3Client.send(command);
            return true;
        } catch (error: any) {
            // NoSuchKey 에러는 파일이 없다는 의미이므로 false 반환
            if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
                return false;
            }
            
            // 다른 에러는 로깅하고 false 반환
            log.Error('R2 파일 존재 확인 실패:', error);
            return false;
        }
    }

    /**
     * 파일의 메타데이터 정보를 가져옵니다.
     * @param key - S3 객체 키 (파일명/경로)
     * @param storageConfig - 저장소 설정 정보 (필수)
     * @returns Promise<object | null> - 파일 메타데이터 (크기, 수정일 등) 또는 null
     */
    public async getFileMetadata(key: string, storageConfig: StorageConfig): Promise<{
        contentLength?: number;
        contentType?: string;
        lastModified?: Date;
        etag?: string;
    } | null> {
        try {
            const s3Client = this.createS3Client(storageConfig);


            const command = new HeadObjectCommand({
                Bucket: storageConfig.bucketName,
                Key: key
            });

            const response = await s3Client.send(command);
            
            return {
                contentLength: response.ContentLength,
                contentType: response.ContentType,
                lastModified: response.LastModified,
                etag: response.ETag
            };
        } catch (error: any) {
            // NoSuchKey 에러는 파일이 없다는 의미이므로 null 반환
            if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
                return null;
            }
            

            // 다른 에러는 로깅하고 null 반환
            log.Error('R2 파일 메타데이터 가져오기 실패:', error);
            return null;
        }
    }

    /**
     * Range 요청으로 파일의 일부분을 다운로드합니다.
     * @param key - S3 객체 키 (파일명/경로)
     * @param start - 시작 바이트 위치
     * @param end - 끝 바이트 위치
     * @param storageConfig - 저장소 설정 정보 (필수)
     * @returns Promise<Readable | null> - 파일 스트림 또는 null
     */
    public async downloadFileRange(key: string, start: number, end: number, storageConfig: StorageConfig): Promise<Readable | null> {
        try {
            const s3Client = this.createS3Client(storageConfig);

            const command = new GetObjectCommand({
                Bucket: storageConfig.bucketName,
                Key: key,
                Range: `bytes=${start}-${end}`
            });

            const response = await s3Client.send(command);
            
            if (response.Body instanceof Readable) {
                return response.Body;
            } else {
                log.Error('R2 Range 다운로드 응답이 스트림이 아닙니다.');
                return null;
            }
        } catch (error) {
            log.Error('R2 Range 파일 다운로드 실패:', error);
            return null;
        }
    }

}