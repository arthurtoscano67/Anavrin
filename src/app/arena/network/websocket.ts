const SAME_ORIGIN_HTML_LOBBY_ERROR =
  'Lobby endpoint is serving the site HTML, not a WebSocket Worker. Set VITE_LOBBY_WS_URL to your Worker URL (wss://<your-worker>.workers.dev/lobby).';

export const INITIAL_RECONNECT_DELAY_MS = 1_000;
export const MAX_RECONNECT_DELAY_MS = 10_000;
export const PING_INTERVAL_MS = 20_000;

export function normalizeEndpoint(raw: string): string {
  if (!raw) return raw;
  if (raw.startsWith('ws://') || raw.startsWith('wss://')) return raw;
  if (raw.startsWith('http://')) return `ws://${raw.slice('http://'.length)}`;
  if (raw.startsWith('https://')) return `wss://${raw.slice('https://'.length)}`;
  if (raw.startsWith('/')) {
    if (typeof window === 'undefined') return raw;
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${protocol}://${window.location.host}${raw}`;
  }
  return raw;
}

export function toHttpEndpoint(wsEndpoint: string): string | null {
  if (wsEndpoint.startsWith('wss://')) return `https://${wsEndpoint.slice('wss://'.length)}`;
  if (wsEndpoint.startsWith('ws://')) return `http://${wsEndpoint.slice('ws://'.length)}`;
  return null;
}

export async function detectSameOriginHtmlLobby(wsEndpoint: string): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const httpEndpoint = toHttpEndpoint(wsEndpoint);
  if (!httpEndpoint) return null;

  const endpointUrl = new URL(httpEndpoint);
  if (endpointUrl.host !== window.location.host || endpointUrl.pathname !== '/lobby') {
    return null;
  }

  try {
    const response = await fetch(endpointUrl.toString(), { method: 'GET' });
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (response.ok && contentType.includes('text/html')) {
      return SAME_ORIGIN_HTML_LOBBY_ERROR;
    }
  } catch {
    return null;
  }

  return null;
}

export function resolveEndpoint(explicit?: string): string {
  if (explicit) return normalizeEndpoint(explicit);

  const metaWithEnv = import.meta as ImportMeta & { env?: Record<string, string | undefined> };
  const fromEnv = metaWithEnv.env?.VITE_LOBBY_WS_URL || '';
  if (fromEnv) return normalizeEndpoint(fromEnv);

  if (typeof window === 'undefined') return '';
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'ws://127.0.0.1:8787/lobby';
  }

  return 'wss://anavrin.arthurtoscano67.workers.dev/lobby';
}
