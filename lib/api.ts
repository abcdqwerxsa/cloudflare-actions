// Use same-origin /api proxy instead of cross-origin worker URL
// This eliminates DNS lookup, TLS handshake, and CORS overhead
export const API_BASE = '/api';
