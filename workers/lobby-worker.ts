import { ArenaLobby } from "./arena-lobby";

export { ArenaLobby };

export interface Env {
  ARENA_LOBBY: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/lobby") {
      const room = url.searchParams.get("room") || "global";
      const id = env.ARENA_LOBBY.idFromName(room);
      const stub = env.ARENA_LOBBY.get(id);
      return stub.fetch(request);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        service: "anavrin-arena-lobby",
        websocket: "/lobby",
      }),
      {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
        },
      }
    );
  },
};
