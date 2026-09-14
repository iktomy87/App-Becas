/**
 * Configuración centralizada de la API.
 * En desarrollo usa el proxy de Vite; en producción cambia VITE_API_URL en .env
 */
export const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

