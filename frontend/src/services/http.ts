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

/**
 * Sube un archivo grande vía XMLHttpRequest (no fetch, porque fetch no expone
 * progreso de upload). El timeout es de INACTIVIDAD, no de duración total:
 * se resetea cada vez que el navegador reporta progreso real de bytes
 * enviados. Así, un archivo de 2GB en una conexión lenta puede tardar 20
 * minutos sin problema, pero si la conexión se cuelga de verdad (0 bytes
 * moviéndose) durante `inactivityTimeoutMs`, sí se aborta.
 *
 * onProgress es opcional — pasalo para mostrar una barra de progreso real.
 */
function uploadWithProgress<T>(
  path: string,
  formData: FormData,
  options?: { inactivityTimeoutMs?: number; onProgress?: (pct: number) => void },
): Promise<T> {
  const inactivityTimeoutMs = options?.inactivityTimeoutMs ?? 120_000; // 120s sin avanzar = lo damos por colgado
  const onProgress = options?.onProgress;

  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let inactivityTimer: ReturnType<typeof setTimeout>;

    const resetInactivityTimer = () => {
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        xhr.abort();
        reject(new Error(`La subida de ${path} se detuvo (sin progreso por ${inactivityTimeoutMs / 1000}s). Verificá tu conexión e intentá de nuevo.`));
      }, inactivityTimeoutMs);
    };

    xhr.upload.addEventListener('progress', (e) => {
      resetInactivityTimer(); // hay actividad real: pateamos el timeout
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    // Cuando el archivo terminó de enviarse, el servidor puede tardar mucho
    // procesándolo (ej. padrón de 24k filas). Cancelamos el timer de
    // inactividad para que no aborte mientras el server trabaja.
    xhr.upload.addEventListener('loadend', () => {
      clearTimeout(inactivityTimer);
    });

    xhr.addEventListener('load', () => {
      clearTimeout(inactivityTimer);
      const status = xhr.status;
      let body: unknown;
      try { body = JSON.parse(xhr.responseText); } catch { body = xhr.responseText; }

      if (status >= 400) {
        reject(new ApiError(status, body));
        return;
      }
      resolve(body as T);
    });

    xhr.addEventListener('error', () => {
      clearTimeout(inactivityTimer);
      reject(new Error(`Error de red al subir el archivo a ${path}.`));
    });

    xhr.addEventListener('abort', () => {
      // el reject ya se disparó desde el propio timer de inactividad
    });

    xhr.open('POST', `${API_BASE_URL}${path}`);
    resetInactivityTimer(); // arranca el reloj antes de mandar, por si el envío inicial ya se cuelga
    xhr.send(formData);
  });
}

export const http = {
  get:    <T>(path: string)                 => request<T>(path),
  post:   <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST',  body: body ? JSON.stringify(body) : undefined }),
  put:    <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT',   body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string)                 => request<T>(path, { method: 'DELETE' }),

  /**
   * Para uploads multipart de archivos grandes. Timeout de INACTIVIDAD
   * (120s sin progreso), no de duración total — así un archivo de
   * 2GB no falla solo por tardar, mientras siga avanzando.
   * Pasá onProgress para mostrar % de subida en la UI.
   */
  upload: <T>(path: string, formData: FormData, onProgress?: (pct: number) => void) =>
    uploadWithProgress<T>(path, formData, { inactivityTimeoutMs: 120_000, onProgress }),
};