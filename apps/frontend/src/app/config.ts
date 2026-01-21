/**
 * Frontend configuration
 * Auto-detects environment and uses appropriate API URL
 */

// API URL configuration
// - Development (yarn nx serve): Frontend on :4201, Backend on :3001 → need full URL
// - Production (Docker): Same origin with nginx proxy → use relative /api
const getApiUrl = (): string => {
  // Allow override via env var if needed
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // Production: use relative URL (nginx proxies /api to backend)
  if (import.meta.env.PROD) {
    return '/api';
  }

  // Development: backend runs on different port
  return 'http://localhost:3001/api';
};

export const config = {
  apiUrl: getApiUrl(),
} as const;
