/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LOBBY_WS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
