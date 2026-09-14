import { API_BASE_URL } from './config';

/** Error estructurado devuelto por NestJS */
export class ApiError extends Error {
  public readonly status: number;
  public readonly body: unknown;
  
  constructor(status: number, body: unknown) {
    super(`API error ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

/**
 * Cliente HTTP base sobre fetch.
 * Lanza ApiError si el servidor responde con status >= 400.
 * Lanza Error si la petición tarda más de `timeoutMs` ms.
 */
async function request<T>(path: string, init?: RequestInit, timeoutMs = 10_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json', ...init?.headers },
      ...init,
      signal: controller.signal,
    });

    if (!res.ok) {
      let body: unknown;
      try { body = await res.json(); } catch { body = await res.text(); }
      throw new ApiError(res.status, body);
    }

    // 204 No Content
    if (res.status === 204) return undefined as T;

    const text = await res.text();
    if (!text) return undefined as T;

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`Failed to parse JSON response: ${text}`);
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error(`La petición a ${path} tardó demasiado (timeout ${timeoutMs / 1000}s). Verificá que el servidor esté corriendo.`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export const http = {
  get:    <T>(path: string)                       => request<T>(path),
  post:   <T>(path: string, body?: unknown)       => request<T>(path, { method: 'POST',  body: body ? JSON.stringify(body) : undefined }),
  put:    <T>(path: string, body?: unknown)       => request<T>(path, { method: 'PUT',   body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string)                       => request<T>(path, { method: 'DELETE' }),

  /** Para uploads multipart (no agrega Content-Type — lo pone el browser) */
  upload: <T>(path: string, formData: FormData) => request<T>(path, {
    method: 'POST',
    headers: {},          // sin Content-Type para que fetch calcule el boundary
    body: formData,
  }, 60_000),  // 60 s para uploads de Excel grandes
};

