function toWsProtocol(protocol: string): string {
  return protocol === 'https:' ? 'wss:' : 'ws:';
}

export function buildArenaSocketUrl(path: string): string {
  const configured = (import.meta.env.VITE_LOBBY_WS_URL as string | undefined)?.trim();

  if (configured) {
    const httpUrl = configured.replace(/^wss?:/i, (match) => (match.toLowerCase() === 'wss:' ? 'https:' : 'http:'));
    const url = new URL(httpUrl);
    url.pathname = path;
    url.search = '';
    return url.toString().replace(/^https?:/i, (match) => (match.toLowerCase() === 'https:' ? 'wss:' : 'ws:'));
  }

  if (typeof window !== 'undefined') {
    return `${toWsProtocol(window.location.protocol)}//${window.location.host}${path}`;
  }

  return `ws://127.0.0.1:8787${path}`;
}
