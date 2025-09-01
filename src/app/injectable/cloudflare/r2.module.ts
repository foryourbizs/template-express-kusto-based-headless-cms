import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import { log } from '@ext/winston'


const config = {
    ACCESS_ID: process.env.CLOUDFLARE_ACCESS_ID || '',
    SECRET_ACCESS_KEY: process.env.CLOUDFLARE_SECRET_ACCESS || '',
    R2_API: process.env.CLOUDFLARE_R2_API || '',
    R2_BUCKET: process.env.CLOUDFLARE_R2_BUCKET || ''
};

// 설정 검증
const validateConfig = () => {
    const missing = [];
    if (!config.ACCESS_ID) missing.push('CLOUDFLARE_ACCESS_ID');
    if (!config.SECRET_ACCESS_KEY) missing.push('CLOUDFLARE_SECRET_ACCESS');
    if (!config.R2_API) missing.push('CLOUDFLARE_R2_API');
    if (!config.R2_BUCKET) missing.push('CLOUDFLARE_R2_BUCKET');
    
    if (missing.length > 0) {
        throw new Error(`Cloudflare R2 설정이 누락되었습니다: ${missing.join(', ')}`);
    }
};

// 설정 검증 실행
try {
    validateConfig();
} catch (error) {
    log.Error('Cloudflare R2 설정 오류:', error);
}


// R2 접속 설정
const s3 = new S3Client({
  region: "auto", // R2는 특정 region 없음
  endpoint: config.R2_API, // R2 endpoint
  credentials: {
    accessKeyId: config.ACCESS_ID,
    secretAccessKey: config.SECRET_ACCESS_KEY,
  },
});


export default class CloudflareR2Module {

    /**
     * 파일을 R2 버킷에 업로드합니다.
     * @param key - S3 객체 키 (파일명/경로)
     * @param body - 업로드할 데이터 (Buffer, Uint8Array, string, 또는 Readable stream)
     * @param contentType - 파일의 MIME 타입 (선택사항)
     * @param bucket - 업로드할 버킷명 (기본값: 환경변수에서 설정된 버킷)
     * @returns Promise<boolean> - 업로드 성공 여부
     */
    public async uploadFile(
        key: string, 
        body: Buffer | Uint8Array | string | Readable, 
        contentType?: string,
        bucket: string = config.R2_BUCKET
    ): Promise<boolean> {
        try {
            const command = new PutObjectCommand({
                Bucket: bucket,
                Key: key,
                Body: body,
                ContentType: contentType
            });

            await s3.send(command);
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
     * @param bucket - 업로드할 버킷명 (기본값: 환경변수에서 설정된 버킷)
     * @returns Promise<string | null> - presigned URL 또는 null (실패시)
     */
    public async generateUploadPresignedUrl(
        key: string,
        expiresIn: number = 3600,
        contentType?: string,
        bucket: string = config.R2_BUCKET
    ): Promise<string | null> {
        try {
            const command = new PutObjectCommand({
                Bucket: bucket,
                Key: key,
                ContentType: contentType
            });

            const presignedUrl = await getSignedUrl(s3, command, { expiresIn });
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
     * @param bucket - 다운로드할 버킷명 (기본값: 환경변수에서 설정된 버킷)
     * @returns Promise<string | null> - presigned URL 또는 null (실패시)
     */
    public async generateDownloadPresignedUrl(
        key: string,
        expiresIn: number = 3600,
        bucket: string = config.R2_BUCKET
    ): Promise<string | null> {
        try {
            const command = new GetObjectCommand({
                Bucket: bucket,
                Key: key
            });

            const presignedUrl = await getSignedUrl(s3, command, { expiresIn });
            return presignedUrl;
        } catch (error) {
            log.Error('Presigned URL 생성 실패 (다운로드):', error);
            return null;
        }
    }

    

    /**
     * R2에서 파일을 다운로드합니다.
     * @param key - S3 객체 키 (파일명/경로)
     * @param bucket - 다운로드할 버킷명 (기본값: 환경변수에서 설정된 버킷)
     * @returns Promise<Readable | null> - 파일 스트림 또는 null (실패시)
     */
    public async downloadFile(key: string, bucket: string = config.R2_BUCKET): Promise<Readable | null> {
        try {
            const command = new GetObjectCommand({
                Bucket: bucket,
                Key: key
            });

            const response = await s3.send(command);
            return response.Body as Readable;
        } catch (error) {
            log.Error('R2 다운로드 실패:', error);
            return null;
        }
    }

}