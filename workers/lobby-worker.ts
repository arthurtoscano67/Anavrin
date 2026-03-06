import { ArenaLobby } from "./arena-lobby";

export { ArenaLobby };

export interface Env {
  ARENA_LOBBY: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/lobby") {
      const id = env.ARENA_LOBBY.idFromName("global-lobby");
      const stub = env.ARENA_LOBBY.get(id);
      return stub.fetch(request);
    }

    if (url.pathname.startsWith("/room/")) {
      const roomId = url.pathname.replace(/^\/room\//, "").trim();
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
        websocket: "/lobby",
        roomWebsocket: "/room/:roomId",
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
