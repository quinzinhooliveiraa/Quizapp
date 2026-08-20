const railwayApiUrl = 'https://workspaceapi-server-production-0516.up.railway.app';

export const apiBaseUrl = (import.meta.env.VITE_API_URL || (import.meta.env.PROD ? railwayApiUrl : '')).replace(/\/+$/, '');