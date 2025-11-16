import crypto from 'crypto';

interface HmacOptions {
    secretKey: string;
    algorithm?: 'sha256' | 'sha512' | 'sha384' | 'sha1';
    encoding?: 'hex' | 'base64' | 'base64url';
}

interface EventData {
    type: string;
    timestamp: number;
    fingerprint: string;
    payload: any;
    hmac?: string;
}

interface BatchedEvents {
    fingerprint: string;
    events: Omit<EventData, 'fingerprint' | 'hmac'>[];
    hmac?: string;
}

export default class HmacModule {
    private readonly defaultAlgorithm: 'sha256' | 'sha512' | 'sha384' | 'sha1' = 'sha256';
    private readonly defaultEncoding: 'hex' | 'base64' | 'base64url' = 'hex';

    constructor() {
        // 환경변수는 라우터에서 직접 전달받도록 변경
    }

    /**
     * 데이터에 대한 HMAC 서명 생성
     * @param data - 서명할 데이터
     * @param secretKey - HMAC 비밀 키
     * @param options - HMAC 옵션 (선택사항)
     * @returns HMAC 서명 문자열
     */
    generateHmac(data: string, secretKey: string, options?: Partial<Omit<HmacOptions, 'secretKey'>>): string {
        const algorithm = options?.algorithm || this.defaultAlgorithm;
        const encoding = options?.encoding || this.defaultEncoding;
        
        const hmac = crypto.createHmac(algorithm, secretKey);
        hmac.update(data);
        
        return hmac.digest(encoding);
    }

    /**
     * 이벤트 데이터의 정규화된 문자열 생성 (HMAC 서명용)
     * @param event - 이벤트 데이터 (hmac 필드 제외)
     * @returns 정규화된 JSON 문자열
     */
    private normalizeEventData(event: Omit<EventData, 'hmac'>): string {
        const { type, timestamp, fingerprint, payload } = event;
        return JSON.stringify({ type, timestamp, fingerprint, payload });
    }

    /**
     * 배치 이벤트 데이터의 정규화된 문자열 생성 (HMAC 서명용)
     * @param batchData - 배치 이벤트 데이터 (hmac 필드 제외)
     * @returns 정규화된 JSON 문자열
     */
    private normalizeBatchData(batchData: Omit<BatchedEvents, 'hmac'>): string {
        const { fingerprint, events } = batchData;
        return JSON.stringify({ fingerprint, events });
    }

    /**
     * 이벤트 데이터에 대한 HMAC 서명 생성
     * @param event - 이벤트 데이터 (hmac 필드 제외)
     * @param secretKey - HMAC 비밀 키
     * @param options - HMAC 옵션 (선택사항)
     * @returns HMAC 서명 문자열
     */
    generateEventHmac(event: Omit<EventData, 'hmac'>, secretKey: string, options?: Partial<Omit<HmacOptions, 'secretKey'>>): string {
        const normalizedData = this.normalizeEventData(event);
        return this.generateHmac(normalizedData, secretKey, options);
    }

    /**
     * 배치 이벤트에 대한 HMAC 서명 생성
     * @param batchData - 배치 이벤트 데이터 (hmac 필드 제외)
     * @param secretKey - HMAC 비밀 키
     * @param options - HMAC 옵션 (선택사항)
     * @returns HMAC 서명 문자열
     */
    generateBatchHmac(batchData: Omit<BatchedEvents, 'hmac'>, secretKey: string, options?: Partial<Omit<HmacOptions, 'secretKey'>>): string {
        const normalizedData = this.normalizeBatchData(batchData);
        return this.generateHmac(normalizedData, secretKey, options);
    }

    /**
     * HMAC 서명 검증
     * @param data - 원본 데이터
     * @param signature - 검증할 서명
     * @param secretKey - HMAC 비밀 키
     * @param options - HMAC 옵션 (선택사항)
     * @returns 서명이 유효한지 여부
     */
    verifyHmac(data: string, signature: string, secretKey: string, options?: Partial<Omit<HmacOptions, 'secretKey'>>): boolean {
        const expectedSignature = this.generateHmac(data, secretKey, options);
        
        // 타이밍 공격 방지를 위한 constant-time 비교
        try {
            return crypto.timingSafeEqual(
                Buffer.from(signature),
                Buffer.from(expectedSignature)
            );
        } catch {
            return false;
        }
    }

    /**
     * 이벤트 데이터의 HMAC 서명 검증
     * @param event - 검증할 이벤트 데이터
     * @param secretKey - HMAC 비밀 키
     * @param options - HMAC 옵션 (선택사항)
     * @returns 서명이 유효한지 여부
     */
    verifyEventHmac(event: EventData, secretKey: string, options?: Partial<Omit<HmacOptions, 'secretKey'>>): boolean {
        if (!event.hmac) {
            return false;
        }
        
        const { hmac, ...eventData } = event;
        const normalizedData = this.normalizeEventData(eventData);
        
        return this.verifyHmac(normalizedData, hmac, secretKey, options);
    }

    /**
     * 배치 이벤트의 HMAC 서명 검증
     * @param batchData - 검증할 배치 이벤트 데이터
     * @param secretKey - HMAC 비밀 키
     * @param options - HMAC 옵션 (선택사항)
     * @returns 서명이 유효한지 여부
     */
    verifyBatchHmac(batchData: BatchedEvents, secretKey: string, options?: Partial<Omit<HmacOptions, 'secretKey'>>): boolean {
        if (!batchData.hmac) {
            return false;
        }
        
        const { hmac, ...batch } = batchData;
        const normalizedData = this.normalizeBatchData(batch);
        
        return this.verifyHmac(normalizedData, hmac, secretKey, options);
    }
}
