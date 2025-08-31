import { BaseRepository } from '@lib/baseRepository';

/**
 * User repository for handling user-related database operations
 * Optimized for performance with minimal joins and efficient indexing
 */
export default class ObjectStoragesRepository extends BaseRepository<'default'> {
    protected getDatabaseName(): 'default' {
        return 'default';
    }


    /**
     * @returns List of object storages excluding soft-deleted ones
     */
    public async getObjectStoragesListSimply() {
        return this.client.objectStorages.findMany({
            where: {
                NOT: {
                    deletedAt: null
                }
            }
        });
    }

    /**
     * Get a single object storage by UUID
     * @param uuid Object storage UUID
     * @returns Object storage or null if not found
     */
    public async getObjectStorageByUuid(uuid: string) {
        return this.client.objectStorages.findUnique({
            where: { uuid }
        });
    }

    /**
     * Get a single object storage by name (unique field)
     * @param name Object storage name
     * @param includeDeleted Include soft-deleted storages
     * @returns Object storage or null if not found
     */
    public async getObjectStorageByName(name: string, includeDeleted = false) {
        return this.client.objectStorages.findUnique({
            where: { 
                name,
                ...(includeDeleted ? {} : { deletedAt: null })
            }
        });
    }

    /**
     * Get active object storage by name (excludes soft-deleted and inactive)
     * @param name Object storage name
     * @returns Active object storage or null if not found
     */
    public async getActiveObjectStorageByName(name: string) {
        return this.client.objectStorages.findFirst({
            where: {
                name,
                deletedAt: null,
                isActive: true
            }
        });
    }

    /**
     * Get default object storage
     * @returns Default object storage or null if not found
     */
    public async getDefaultObjectStorage() {
        return this.client.objectStorages.findFirst({
            where: {
                isDefault: true,
                deletedAt: null,
                isActive: true
            }
        });
    }

    /**
     * Get object storages by provider
     * @param provider Provider name (e.g., 'S3', 'R2', 'GCS')
     * @param includeDeleted Include soft-deleted storages
     * @returns List of object storages for the provider
     */
    public async getObjectStoragesByProvider(provider: string, includeDeleted = false) {
        return this.client.objectStorages.findMany({
            where: {
                provider,
                ...(includeDeleted ? {} : { deletedAt: null })
            },
            orderBy: {
                isDefault: 'desc' // Default storages first
            }
        });
    }

    /**
     * Create a new object storage configuration
     * @param data Object storage data to create
     * @returns Created object storage with generated UUID
     */
    public async createObjectStorage(data: {
        name: string;
        provider: string;
        description?: string;
        baseUrl: string;
        bucketName: string;
        region?: string;
        isDefault?: boolean;
        isActive?: boolean;
        metadata?: any;
    }) {
        return this.client.objectStorages.create({
            data: {
                name: data.name,
                provider: data.provider,
                description: data.description,
                baseUrl: data.baseUrl,
                bucketName: data.bucketName,
                region: data.region || 'auto',
                isDefault: data.isDefault || false,
                isActive: data.isActive !== undefined ? data.isActive : true,
                metadata: data.metadata,
            }
        });
    }

    /**
     * Update an existing object storage configuration
     * @param uuid Object storage UUID to update
     * @param data Updated object storage data
     * @returns Updated object storage
     */
    public async updateObjectStorage(uuid: string, data: {
        name?: string;
        provider?: string;
        description?: string;
        baseUrl?: string;
        bucketName?: string;
        region?: string;
        isDefault?: boolean;
        isActive?: boolean;
        metadata?: any;
    }) {
        return this.client.objectStorages.update({
            where: { uuid },
            data: {
                ...(data.name !== undefined && { name: data.name }),
                ...(data.provider !== undefined && { provider: data.provider }),
                ...(data.description !== undefined && { description: data.description }),
                ...(data.baseUrl !== undefined && { baseUrl: data.baseUrl }),
                ...(data.bucketName !== undefined && { bucketName: data.bucketName }),
                ...(data.region !== undefined && { region: data.region }),
                ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
                ...(data.isActive !== undefined && { isActive: data.isActive }),
                ...(data.metadata !== undefined && { metadata: data.metadata }),
            }
        });
    }

    /**
     * Soft delete an object storage (sets deletedAt timestamp)
     * @param uuid Object storage UUID to soft delete
     * @returns Updated object storage with deletedAt timestamp
     */
    public async softDeleteObjectStorage(uuid: string) {
        return this.client.objectStorages.update({
            where: { uuid },
            data: {
                deletedAt: new Date(),
                isActive: false, // Also deactivate when soft deleting
            }
        });
    }

    /**
     * Restore a soft-deleted object storage
     * @param uuid Object storage UUID to restore
     * @returns Restored object storage with deletedAt set to null
     */
    public async restoreObjectStorage(uuid: string) {
        return this.client.objectStorages.update({
            where: { uuid },
            data: {
                deletedAt: null,
            }
        });
    }


    


}