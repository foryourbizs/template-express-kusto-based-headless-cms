import type { Injectable, Middleware, MiddlewareParams, MiddlewareParamMapping } from './generated-injectable-types';
import type { RepositoryTypeMap } from './generated-repository-types';
import type { DatabaseClientMap } from './generated-db-types';

declare module 'kusto-framework-core' {
  interface KustoConfigurableTypes {
    injectable: Injectable;
    middleware: Middleware;
    middlewareParams: MiddlewareParams;
    middlewareParamMapping: MiddlewareParamMapping;
    repositoryTypeMap: RepositoryTypeMap;
    databaseClientMap: DatabaseClientMap;
  }
}

export {}