import type { 
  MiddlewareParamName, 
  MiddlewareParams 
} from 'kusto-framework-core';
import type { KustoManager } from 'kusto-framework-core';

declare global {
  namespace Express {
    interface Request {
      with: {
        [K in MiddlewareParamName]?: MiddlewareParams[K];
      };
      kusto: KustoManager;
    }
  }
}

export {};