import { logOperationalEvent } from './operational-log-service.js';

export async function jsonWithUsage(payload, status = 200, request, env, matchedRoute = null, responseFactory) {
  const response = responseFactory(payload, status);
  await logEndpointUsage(env?.DB, request, response.status, matchedRoute);
  return response;
}

export async function logEndpointUsage(db, request, responseStatus, matchedRoute = null) {
  try {
    if (!db || !request) return;
    const url = new URL(request.url);
    const pathname = url.pathname;
    const statusCode = Number(responseStatus || 0);

    if (!pathname.startsWith('/api/')) return;
    if (pathname === '/api/admin/operational-logs') return;
    if (pathname === '/api/health') return;
    if (statusCode < 200 || statusCode >= 400) return;

    await logOperationalEvent(db, {
      level: 'info',
      area: resolveEndpointUsageArea(pathname),
      event: 'endpoint_used',
      route: pathname,
      method: request.method,
      message: 'Endpoint utilizado.',
      metadata: {
        status_code: statusCode,
        ...(matchedRoute ? { matched_route: matchedRoute } : {})
      }
    });
  } catch {
    // Auditoria de uso nunca deve afetar a resposta da API.
  }
}

export function resolveEndpointUsageArea(pathname) {
  if (pathname.startsWith('/api/admin/')) return 'admin';
  if (pathname.startsWith('/api/project-lm/') || pathname.includes('project-lm')) return 'project_lm';
  if (pathname.startsWith('/api/portal/')) return 'student';
  return 'system';
}
