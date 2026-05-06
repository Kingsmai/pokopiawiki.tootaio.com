import type { RouteSeoConfig } from '../src/seo';

declare module '#app' {
  interface PageMeta {
    editorModal?: boolean;
    requiredAnyPermission?: string[];
    requiredPermission?: string;
    requiresAuth?: boolean;
    requiresVerified?: boolean;
    seo?: RouteSeoConfig;
  }
}

export {};
