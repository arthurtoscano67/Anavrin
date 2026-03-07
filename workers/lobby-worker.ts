import { ArenaLobby } from "./arena-lobby";

export { ArenaLobby };

export interface Env {
  ARENA_LOBBY: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const corsHeaders = {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type",
    };

    if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (url.pathname === "/lobby" || url.pathname === "/ws/lobby" || url.pathname.startsWith("/api/")) {
      const id = env.ARENA_LOBBY.idFromName("global-lobby");
      const stub = env.ARENA_LOBBY.get(id);
      return stub.fetch(request);
    }

    if (url.pathname.startsWith("/room/") || url.pathname.startsWith("/ws/room/")) {
      const roomId = url.pathname.replace(/^\/(?:ws\/)?room\//, "").trim();
      if (!roomId) {
        return new Response("Missing room id", { status: 400 });
      }
      const id = env.ARENA_LOBBY.idFromName(`room:${roomId}`);
      const stub = env.ARENA_LOBBY.get(id);
      return stub.fetch(request);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        service: "anavrin-arena-lobby",
        websocket: "/ws/lobby",
        roomWebsocket: "/ws/room/:roomId",
        api: {
          lobbySnapshot: "/api/lobby/snapshot",
          battles: "/api/battles?kind=featured&page=1&pageSize=6",
          battleSummary: "/api/battles/:matchId",
        },
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
