import { api } from '../src/services/api';

export default defineNuxtRouteMiddleware(async (to) => {
  const requiredPermissions = to.matched
    .map((record) => record.meta.requiredPermission)
    .filter((permission): permission is string => typeof permission === 'string');
  const requiredAnyPermissions = to.matched.flatMap((record) =>
    Array.isArray(record.meta.requiredAnyPermission)
      ? record.meta.requiredAnyPermission.filter((permission): permission is string => typeof permission === 'string')
      : []
  );
  const requiresVerified = to.matched.some((record) => record.meta.requiresVerified === true) || requiredPermissions.length > 0 || requiredAnyPermissions.length > 0;
  const requiresAuth = requiresVerified || to.matched.some((record) => record.meta.requiresAuth === true);

  if (!requiresAuth) {
    return;
  }

  try {
    const response = await api.me(import.meta.server ? { headers: useRequestHeaders(['cookie']) } : undefined);
    if (requiresVerified && !response.user.emailVerified) {
      return navigateTo({ path: '/login', query: { redirect: to.fullPath } });
    }

    const permissionSet = new Set(response.user.permissions);
    if (requiredPermissions.some((permission) => !permissionSet.has(permission))) {
      return navigateTo('/pokemon');
    }
    if (requiredAnyPermissions.length && !requiredAnyPermissions.some((permission) => permissionSet.has(permission))) {
      return navigateTo('/pokemon');
    }
  } catch {
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } });
  }
});
