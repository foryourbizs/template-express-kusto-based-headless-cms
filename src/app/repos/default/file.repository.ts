import { BaseRepository } from '@lib/baseRepository';


export default class FilesRepository extends BaseRepository<'default'> {
    protected getDatabaseName(): 'default' {
        return 'default';
    }

    /**
     * Get list of files excluding soft-deleted ones
     * @param includeStorage Include storage information
     * @param includeUploader Include uploader information
     * @returns List of active files
     */
    public async getFilesListSimply(includeStorage = false, includeUploader = false) {
        const startTime = Date.now();
        
        const result = await this.client.files.findMany({
            where: {
                deletedAt: null
            },
            include: {
                ...(includeStorage && { storage: true }),
                ...(includeUploader && { uploader: true }),
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        
        const endTime = Date.now();
        console.log(`🗄️  [DB Query - getFilesListSimply] ${endTime - startTime}ms, Records: ${result.length}`);
        
        return result;
    }

    /**
     * Get paginated list of files (performance optimized)
     * @param page Page number (1-based)
     * @param pageSize Number of items per page
     * @param includeStorage Include storage information
     * @param includeUploader Include uploader information
     * @returns Paginated list of active files
     */
    public async getFilesListPaginated(page = 1, pageSize = 50, includeStorage = false, includeUploader = false) {
        const startTime = Date.now();
        const skip = (page - 1) * pageSize;
        
        const [files, totalCount] = await Promise.all([
            this.client.files.findMany({
                where: {
                    deletedAt: null
                },
                include: {
                    ...(includeStorage && { storage: true }),
                    ...(includeUploader && { uploader: true }),
                },
                orderBy: {
                    createdAt: 'desc'
                },
                take: pageSize,
                skip: skip
            }),
            this.client.files.count({
                where: {
                    deletedAt: null
                }
            })
        ]);
        
        const endTime = Date.now();
        console.log(`🗄️  [DB Query - getFilesListPaginated] ${endTime - startTime}ms, Records: ${files.length}/${totalCount}, Page: ${page}/${Math.ceil(totalCount / pageSize)}`);
        
        return {
            files,
            pagination: {
                page,
                pageSize,
                totalCount,
                totalPages: Math.ceil(totalCount / pageSize),
                hasNext: page < Math.ceil(totalCount / pageSize),
                hasPrev: page > 1
            }
        };
    }

    /**
     * Get minimal file list (only essential fields for performance)
     * @param limit Maximum number of files to return
     * @returns Minimal file information
     */
    public async getFilesListMinimal(limit = 100) {
        const startTime = Date.now();
        
        const result = await this.client.files.findMany({
            where: {
                deletedAt: null
            },
            select: {
                uuid: true,
                filename: true,
                originalName: true,
                mimeType: true,
                fileSize: true,
                createdAt: true,
                isPublic: true
            },
            orderBy: {
                createdAt: 'desc'
            },
            take: limit
        });
        
        const endTime = Date.now();
        console.log(`🗄️  [DB Query - getFilesListMinimal] ${endTime - startTime}ms, Records: ${result.length}`);
        
        return result;
    }

    /**
     * Get a single file by UUID
     * @param uuid File UUID
     * @param includeRelations Include related data (storage, uploader, permission)
     * @returns File with optional relations
     */
    public async getFileByUuid(uuid: string, includeRelations = true) {
        return this.client.files.findUnique({
            where: { uuid },
            include: includeRelations ? {
                storage: true,
                uploader: true,
                accessPermission: true,
            } : undefined
        });
    }

    /**
     * Get a single file by filename (searches in filename field)
     * @param filename File filename
     * @param includeRelations Include related data (storage, uploader, permission)
     * @returns File with optional relations
     */
    public async getFileByFilename(filename: string, includeRelations = true) {
        return this.client.files.findFirst({
            where: { 
                filename: filename,
                deletedAt: null 
            },
            include: includeRelations ? {
                storage: true,
                uploader: true,
                accessPermission: true,
            } : undefined
        });
    }

    /**
     * Get a single file by file path (searches in filePath field)
     * @param filePath File path in storage
     * @param includeRelations Include related data (storage, uploader, permission)
     * @returns File with optional relations
     */
    public async getFileByPath(filePath: string, includeRelations = true) {
        return this.client.files.findFirst({
            where: { 
                filePath: filePath,
                deletedAt: null 
            },
            include: includeRelations ? {
                storage: true,
                uploader: true,
                accessPermission: true,
            } : undefined
        });
    }

    /**
     * Create a new file record
     * @param data File data to create
     * @returns Created file with generated UUID
     */
    public async createFile(data: {
        filename: string;
        originalName: string;
        mimeType: string;
        fileSize: bigint;
        extension?: string;
        storageUuid: string;
        filePath: string;
        exists?: boolean;
        isPublic?: boolean;
        md5Hash?: string;
        sha256Hash?: string;
        uploadedBy?: string;
        uploadSource?: string;
        metadata?: any;
        accessPermissionUuid?: string;
        expiresAt?: Date;
    }) {
        return this.client.files.create({
            data: {
                filename: data.filename,
                originalName: data.originalName,
                mimeType: data.mimeType,
                fileSize: data.fileSize,
                extension: data.extension,
                storageUuid: data.storageUuid,
                filePath: data.filePath,
                exists: data.exists || false,
                isPublic: data.isPublic || false,
                isArchived: false,
                md5Hash: data.md5Hash,
                sha256Hash: data.sha256Hash,
                uploadedBy: data.uploadedBy,
                uploadSource: data.uploadSource,
                metadata: data.metadata,
                accessPermissionUuid: data.accessPermissionUuid,
                expiresAt: data.expiresAt,
            },
            include: {
                storage: true,
                uploader: true,
            }
        });
    }

    /**
     * Update an existing file record
     * @param uuid File UUID to update
     * @param data Updated file data
     * @returns Updated file
     */
    public async updateFile(uuid: string, data: {
        filename?: string;
        originalName?: string;
        mimeType?: string;
        fileSize?: bigint;
        extension?: string;
        storageUuid?: string;
        filePath?: string;
        exists?: boolean;
        isPublic?: boolean;
        isArchived?: boolean;
        md5Hash?: string;
        sha256Hash?: string;
        uploadedBy?: string;
        uploadSource?: string;
        metadata?: any;
        accessPermissionUuid?: string;
        expiresAt?: Date;
    }) {
        return this.client.files.update({
            where: { uuid },
            data: {
                ...(data.filename !== undefined && { filename: data.filename }),
                ...(data.originalName !== undefined && { originalName: data.originalName }),
                ...(data.mimeType !== undefined && { mimeType: data.mimeType }),
                ...(data.fileSize !== undefined && { fileSize: data.fileSize }),
                ...(data.extension !== undefined && { extension: data.extension }),
                ...(data.storageUuid !== undefined && { storageUuid: data.storageUuid }),
                ...(data.filePath !== undefined && { filePath: data.filePath }),
                ...(data.exists !== undefined && { exists: data.exists }),
                ...(data.isPublic !== undefined && { isPublic: data.isPublic }),
                ...(data.isArchived !== undefined && { isArchived: data.isArchived }),
                ...(data.md5Hash !== undefined && { md5Hash: data.md5Hash }),
                ...(data.sha256Hash !== undefined && { sha256Hash: data.sha256Hash }),
                ...(data.uploadedBy !== undefined && { uploadedBy: data.uploadedBy }),
                ...(data.uploadSource !== undefined && { uploadSource: data.uploadSource }),
                ...(data.metadata !== undefined && { metadata: data.metadata }),
                ...(data.accessPermissionUuid !== undefined && { accessPermissionUuid: data.accessPermissionUuid }),
                ...(data.expiresAt !== undefined && { expiresAt: data.expiresAt }),
            },
            include: {
                storage: true,
                uploader: true,
            }
        });
    }

    /**
     * Soft delete a file (sets deletedAt timestamp)
     * @param uuid File UUID to soft delete
     * @returns Updated file with deletedAt timestamp
     */
    public async softDeleteFile(uuid: string) {
        return this.client.files.update({
            where: { uuid },
            data: {
                deletedAt: new Date(),
                isArchived: true, // Mark as archived when deleting
            }
        });
    }

    /**
     * Restore a soft-deleted file
     * @param uuid File UUID to restore
     * @returns Restored file with deletedAt set to null
     */
    public async restoreFile(uuid: string) {
        return this.client.files.update({
            where: { uuid },
            data: {
                deletedAt: null,
                isArchived: false, // Unarchive when restoring
            }
        });
    }

    /**
     * Mark file as verified/existing
     * @param uuid File UUID
     * @returns Updated file
     */
    public async markFileAsExists(uuid: string) {
        return this.client.files.update({
            where: { uuid },
            data: { exists: true }
        });
    }

    /**
     * Mark file as missing/non-existing
     * @param uuid File UUID
     * @returns Updated file
     */
    public async markFileAsMissing(uuid: string) {
        return this.client.files.update({
            where: { uuid },
            data: { exists: false }
        });
    }

    /**
     * Get files by storage UUID
     * @param storageUuid Storage UUID
     * @param includeDeleted Include soft-deleted files
     * @returns Files in specified storage
     */
    public async getFilesByStorage(storageUuid: string, includeDeleted = false) {
        return this.client.files.findMany({
            where: {
                storageUuid,
                ...(includeDeleted ? {} : { deletedAt: null })
            },
            include: {
                storage: true,
                uploader: true,
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
    }

    /**
     * Get files by uploader UUID
     * @param uploaderUuid Uploader user UUID
     * @param includeDeleted Include soft-deleted files
     * @returns Files uploaded by specified user
     */
    public async getFilesByUploader(uploaderUuid: string, includeDeleted = false) {
        return this.client.files.findMany({
            where: {
                uploadedBy: uploaderUuid,
                ...(includeDeleted ? {} : { deletedAt: null })
            },
            include: {
                storage: true,
                uploader: true,
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
    }

    /**
     * Get files by MIME type
     * @param mimeType MIME type to filter by
     * @param includeDeleted Include soft-deleted files
     * @returns Files with specified MIME type
     */
    public async getFilesByMimeType(mimeType: string, includeDeleted = false) {
        return this.client.files.findMany({
            where: {
                mimeType,
                ...(includeDeleted ? {} : { deletedAt: null })
            },
            include: {
                storage: true,
                uploader: true,
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
    }

    /**
     * Search files by filename
     * @param searchTerm Search term for filename
     * @param includeDeleted Include soft-deleted files
     * @returns Files matching search term
     */
    public async searchFilesByName(searchTerm: string, includeDeleted = false) {
        return this.client.files.findMany({
            where: {
                OR: [
                    { filename: { contains: searchTerm, mode: 'insensitive' } },
                    { originalName: { contains: searchTerm, mode: 'insensitive' } }
                ],
                ...(includeDeleted ? {} : { deletedAt: null })
            },
            include: {
                storage: true,
                uploader: true,
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
    }

    /**
     * Get expired files
     * @returns Files that have expired
     */
    public async getExpiredFiles() {
        return this.client.files.findMany({
            where: {
                expiresAt: {
                    lt: new Date()
                },
                deletedAt: null
            },
            include: {
                storage: true,
                uploader: true,
            }
        });
    }

    /**
     * Upsert a file record (create if not exists, update if exists)
     * @param whereCondition Condition to find existing file (e.g., { uuid: '...' } or { filePath: '...', storageUuid: '...' })
     * @param data File data for create/update
     * @returns Upserted file
     */
    public async upsertFile(
        whereCondition: { uuid: string } | { filePath: string; storageUuid: string },
        data: {
            filename: string;
            originalName: string;
            mimeType: string;
            fileSize: bigint;
            extension?: string;
            storageUuid: string;
            filePath: string;
            exists?: boolean;
            isPublic?: boolean;
            isArchived?: boolean;
            md5Hash?: string;
            sha256Hash?: string;
            uploadedBy?: string;
            uploadSource?: string;
            metadata?: any;
            accessPermissionUuid?: string;
            expiresAt?: Date;
        }
    ) {
        // First, try to find existing file
        const existingFile = await this.client.files.findFirst({
            where: whereCondition
        });

        if (existingFile) {
            // Update existing file
            return this.client.files.update({
                where: { uuid: existingFile.uuid },
                data: {
                    filename: data.filename,
                    originalName: data.originalName,
                    mimeType: data.mimeType,
                    fileSize: data.fileSize,
                    extension: data.extension,
                    storageUuid: data.storageUuid,
                    filePath: data.filePath,
                    exists: data.exists ?? true,
                    isPublic: data.isPublic ?? false,
                    isArchived: data.isArchived ?? false,
                    md5Hash: data.md5Hash,
                    sha256Hash: data.sha256Hash,
                    uploadedBy: data.uploadedBy,
                    uploadSource: data.uploadSource,
                    metadata: data.metadata,
                    accessPermissionUuid: data.accessPermissionUuid,
                    expiresAt: data.expiresAt,
                },
                include: {
                    storage: true,
                    uploader: true,
                }
            });
        } else {
            // Create new file
            return this.client.files.create({
                data: {
                    filename: data.filename,
                    originalName: data.originalName,
                    mimeType: data.mimeType,
                    fileSize: data.fileSize,
                    extension: data.extension,
                    storageUuid: data.storageUuid,
                    filePath: data.filePath,
                    exists: data.exists ?? false,
                    isPublic: data.isPublic ?? false,
                    isArchived: false,
                    md5Hash: data.md5Hash,
                    sha256Hash: data.sha256Hash,
                    uploadedBy: data.uploadedBy,
                    uploadSource: data.uploadSource,
                    metadata: data.metadata,
                    accessPermissionUuid: data.accessPermissionUuid,
                    expiresAt: data.expiresAt,
                },
                include: {
                    storage: true,
                    uploader: true,
                }
            });
        }
    }

    /**
     * Upsert file by file path and storage (commonly used for file uploads)
     * @param filePath File path in storage
     * @param storageUuid Storage UUID
     * @param data File data for create/update
     * @returns Upserted file
     */
    public async upsertFileByPath(
        filePath: string,
        storageUuid: string,
        data: {
            filename: string;
            originalName: string;
            mimeType: string;
            fileSize: bigint;
            extension?: string;
            exists?: boolean;
            isPublic?: boolean;
            md5Hash?: string;
            sha256Hash?: string;
            uploadedBy?: string;
            uploadSource?: string;
            metadata?: any;
            accessPermissionUuid?: string;
            expiresAt?: Date;
        }
    ) {
        return this.upsertFile(
            { filePath, storageUuid },
            {
                ...data,
                filePath,
                storageUuid,
            }
        );
    }
}