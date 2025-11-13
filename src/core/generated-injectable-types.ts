// Auto-generated file - DO NOT EDIT MANUALLY
// Source: ./src/app/injectable

import AuthCSRFHelperModule from '../app/injectable/auth/csrf/helper.module';
import AuthCSRFMiddlewareModule from '../app/injectable/auth/csrf/middleware.module';
import AuthCSRFReferrerMiddleware from '../app/injectable/auth/csrf/referrer.middleware';
import AuthJWTGuardCheckMiddleware from '../app/injectable/auth/jwt/guard/check.middleware';
import AuthJWTGuardNoLoginCheckMiddleware from '../app/injectable/auth/jwt/guard/noLogin/check.middleware';
import AuthJWTGuardRoleCheckMiddleware from '../app/injectable/auth/jwt/guard/role/check.middleware';
import { AuthTryMiddlewareParams as AuthJWTGuardRoleGuideAuthTryMiddlewareParamsType } from '../app/injectable/auth/jwt/guard/role/guide.middleware.interface';
import AuthJWTJsonWebTokenModule from '../app/injectable/auth/jwt/jsonWebToken.module';
import AuthRateLimiterDefaultMiddleware from '../app/injectable/auth/rateLimiter/default.middleware';
import { RateLimiterOptionMiddlewareParams as AuthRateLimiterOptionRateLimiterOptionMiddlewareParamsType } from '../app/injectable/auth/rateLimiter/option.middleware.interface';
import CloudflareFileStreamingModule from '../app/injectable/cloudflare/fileStreaming.module';
import CloudflareR2Module from '../app/injectable/cloudflare/r2.module';
import ConstantDBModule from '../app/injectable/constant/db.module';

// Type definitions
type AuthCSRFHelperModuleType = InstanceType<typeof AuthCSRFHelperModule>;
type AuthCSRFMiddlewareModuleType = InstanceType<typeof AuthCSRFMiddlewareModule>;
type AuthJWTJsonWebTokenModuleType = InstanceType<typeof AuthJWTJsonWebTokenModule>;
type CloudflareFileStreamingModuleType = InstanceType<typeof CloudflareFileStreamingModule>;
type CloudflareR2ModuleType = InstanceType<typeof CloudflareR2Module>;
type ConstantDBModuleType = InstanceType<typeof ConstantDBModule>;
type AuthCSRFReferrerMiddlewareType = ReturnType<typeof AuthCSRFReferrerMiddleware>;
type AuthJWTGuardCheckMiddlewareType = ReturnType<typeof AuthJWTGuardCheckMiddleware>;
type AuthJWTGuardNoLoginCheckMiddlewareType = ReturnType<typeof AuthJWTGuardNoLoginCheckMiddleware>;
type AuthJWTGuardRoleCheckMiddlewareType = ReturnType<typeof AuthJWTGuardRoleCheckMiddleware>;
type AuthRateLimiterDefaultMiddlewareType = ReturnType<typeof AuthRateLimiterDefaultMiddleware>;
type authJwtGuardRoleGuideMiddlewareParamsType = AuthJWTGuardRoleGuideAuthTryMiddlewareParamsType;
type authRateLimiterOptionMiddlewareParamsType = AuthRateLimiterOptionRateLimiterOptionMiddlewareParamsType;

// Module registry for dynamic loading
export const MODULE_REGISTRY = {
  'authCsrfHelper': () => import('../app/injectable/auth/csrf/helper.module'),
  'authCsrfMiddleware': () => import('../app/injectable/auth/csrf/middleware.module'),
  'authJwtJsonWebToken': () => import('../app/injectable/auth/jwt/jsonWebToken.module'),
  'cloudflareFileStreaming': () => import('../app/injectable/cloudflare/fileStreaming.module'),
  'cloudflareR2': () => import('../app/injectable/cloudflare/r2.module'),
  'constantDb': () => import('../app/injectable/constant/db.module'),
} as const;

// Middleware registry for dynamic loading
export const MIDDLEWARE_REGISTRY = {
  'authCsrfReferrer': () => import('../app/injectable/auth/csrf/referrer.middleware'),
  'authJwtGuardCheck': () => import('../app/injectable/auth/jwt/guard/check.middleware'),
  'authJwtGuardNoLoginCheck': () => import('../app/injectable/auth/jwt/guard/noLogin/check.middleware'),
  'authJwtGuardRoleCheck': () => import('../app/injectable/auth/jwt/guard/role/check.middleware'),
  'authRateLimiterDefault': () => import('../app/injectable/auth/rateLimiter/default.middleware'),
} as const;

// Middleware parameter mapping
export const MIDDLEWARE_PARAM_MAPPING = {
  'authJwtGuardRoleCheck': 'authJwtGuardRoleGuide',
  'authRateLimiterDefault': 'authRateLimiterOption',
} as const;

/**
 * Augment kusto-framework-core module with actual injectable types
 */
declare module 'kusto-framework-core' {
  // Injectable modules interface
  interface Injectable {
  authCsrfHelper: AuthCSRFHelperModuleType;
  authCsrfMiddleware: AuthCSRFMiddlewareModuleType;
  authJwtJsonWebToken: AuthJWTJsonWebTokenModuleType;
  cloudflareFileStreaming: CloudflareFileStreamingModuleType;
  cloudflareR2: CloudflareR2ModuleType;
  constantDb: ConstantDBModuleType;
  }

  // Middleware interface
  interface Middleware {
  authCsrfReferrer: AuthCSRFReferrerMiddlewareType;
  authJwtGuardCheck: AuthJWTGuardCheckMiddlewareType;
  authJwtGuardNoLoginCheck: AuthJWTGuardNoLoginCheckMiddlewareType;
  authJwtGuardRoleCheck: AuthJWTGuardRoleCheckMiddlewareType;
  authRateLimiterDefault: AuthRateLimiterDefaultMiddlewareType;
  }

  // Middleware parameters interface
  interface MiddlewareParams {
  authJwtGuardRoleGuide: authJwtGuardRoleGuideMiddlewareParamsType;
  authRateLimiterOption: authRateLimiterOptionMiddlewareParamsType;
  }
  
  // Middleware parameter mapping interface
  interface MiddlewareParamMapping {
    'authJwtGuardRoleCheck': 'authJwtGuardRoleGuide';
    'authRateLimiterDefault': 'authRateLimiterOption';
  }

  // Augment KustoConfigurableTypes for type inference
  interface KustoConfigurableTypes {
    injectable: Injectable;
    middleware: Middleware;
    middlewareParams: MiddlewareParams;
    middlewareParamMapping: MiddlewareParamMapping;
  }
}

// Module names type
export type ModuleName = keyof typeof MODULE_REGISTRY;

// Middleware names type
export type MiddlewareName = keyof typeof MIDDLEWARE_REGISTRY;

// Middleware parameter names type
export type MiddlewareParamName = keyof typeof MIDDLEWARE_PARAM_MAPPING;

// Helper type for getting module type by name
export type GetModuleType<T extends ModuleName> = T extends keyof import('kusto-framework-core').Injectable ? import('kusto-framework-core').Injectable[T] : never;

// Helper type for getting middleware type by name
export type GetMiddlewareType<T extends MiddlewareName> = T extends keyof import('kusto-framework-core').Middleware ? import('kusto-framework-core').Middleware[T] : never;

// Helper type for getting middleware parameter type by name
export type GetMiddlewareParamType<T extends MiddlewareParamName> = T extends keyof import('kusto-framework-core').MiddlewareParams ? import('kusto-framework-core').MiddlewareParams[T] : never;
