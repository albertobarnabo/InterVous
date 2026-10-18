// Paths under the Next basePath ('/intervous', next.config.mjs).
// next/link and router.push add the basePath themselves; raw fetch() and window.location do not.

export const BASE_PATH = '/intervous';

/** '/intervous/api/<path>'. Accepts 'scrape-job', '/scrape-job', 'api/scrape-job' or '/api/scrape-job'. */
export function apiUrl(path: string): string {
    const clean = path.replace(/^\/+/, '').replace(/^api\//, '');
    return `${BASE_PATH}/api/${clean}`;
}

/** '/intervous/<path>' for raw URLs (fetch, window.location, <a download>). */
export function appUrl(path: string): string {
    const clean = path.replace(/^\/+/, '');
    return clean ? `${BASE_PATH}/${clean}` : BASE_PATH;
}

/** Error from an API route, with the server's `{error}` message (never raw response text). */
export class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
    }
}

/**
 * fetch() an `/intervous/api/...` route and parse JSON.
 * A non-2xx response throws ApiError with the JSON `{error}` message, or a plain sentence when the body is not JSON.
 */
export async function apiJson<T = unknown>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers);
    if (init?.body && typeof init.body === 'string' && !headers.has('content-type')) {
        headers.set('content-type', 'application/json');
    }
    const res = await fetch(apiUrl(path), { ...init, headers });
    const text = await res.text();
    let body: unknown = null;
    try {
        body = text ? JSON.parse(text) : null;
    } catch {
        body = null;
    }
    if (!res.ok) {
        const msg =
            body && typeof body === 'object' && 'error' in body && typeof (body as { error: unknown }).error === 'string'
                ? (body as { error: string }).error
                : `The server returned an error (${res.status}).`;
        throw new ApiError(msg, res.status);
    }
    return body as T;
}
