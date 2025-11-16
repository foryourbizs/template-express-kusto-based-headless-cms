// Auto-generated file - DO NOT EDIT MANUALLY
// Source: src/app/repos

import DefaultFileRepository from '../app/repos/default/file.repository';
import DefaultObjectStorageRepository from '../app/repos/default/objectStorage.repository';
import DefaultUserRepository from '../app/repos/default/user.repository';

// Repository type definitions
type DefaultFileRepositoryType = InstanceType<typeof DefaultFileRepository>;
type DefaultObjectStorageRepositoryType = InstanceType<typeof DefaultObjectStorageRepository>;
type DefaultUserRepositoryType = InstanceType<typeof DefaultUserRepository>;

// Repository registry for dynamic loading
export const REPOSITORY_REGISTRY = {
  'defaultFile': () => import('../app/repos/default/file.repository'),
  'defaultObjectStorage': () => import('../app/repos/default/objectStorage.repository'),
  'defaultUser': () => import('../app/repos/default/user.repository'),
} as const;

/**
 * Augment kusto-framework-core module with actual repository types
 */
declare module 'kusto-framework-core' {
  // Repository type map for getRepository return types
  interface RepositoryTypeMap {
  'defaultFile': DefaultFileRepositoryType;
  'defaultObjectStorage': DefaultObjectStorageRepositoryType;
  'defaultUser': DefaultUserRepositoryType;
  }
}

// Repository names type
export type RepositoryName = keyof typeof REPOSITORY_REGISTRY;

// Helper type for getting repository type by name
export type GetRepositoryType<T extends RepositoryName> = T extends keyof import('kusto-framework-core').RepositoryTypeMap ? import('kusto-framework-core').RepositoryTypeMap[T] : never;
