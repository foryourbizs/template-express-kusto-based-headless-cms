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