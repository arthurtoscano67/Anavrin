export type LobbyPlayer = {
  address: string;
  monsterName: string;
  level: number;
  joinedAt: number;
  lastSeen: number;
};

export type OpenMatch = {
  id: string;
  creator: string;
  creatorMonster: string;
  creatorLevel: number;
  stakeSui: string;
  createdAt: number;
};

export type LobbyInvite = {
  id: string;
  from: string;
  to: string;
  monsterName: string;
  level: number;
  createdAt: number;
  status: "pending" | "accepted" | "declined";
};

export type RecentMatch = {
  id: string;
  summary: string;
  timestamp: number;
};

export type StartedMatch = {
  id: string;
  from: string;
  to: string;
  openMatchId?: string;
  inviteId?: string;
  matchId?: string;
  startedAt: number;
};

export type RoomParticipant = {
  address: string;
  joinedAt: number;
  lastSeen: number;
  present: boolean;
  monsterId?: string;
  monsterName?: string;
  stage?: number;
  stakeSui?: string;
  ready: boolean;
};

export type RoomNotice = {
  id: string;
  summary: string;
  timestamp: number;
  tone: "info" | "warn" | "success";
};

type JoinMessage = {
  type: "join";
  address: string;
  monsterName: string;
  level: number;
};

type LeaveMessage = {
  type: "leave";
  address: string;
};

type InviteMessage = {
  type: "invite";
  from: string;
  to: string;
};

type MatchCreatedMessage = {
  type: "matchCreated";
  creator: string;
  opponent?: string;
  stakeSui?: string;
  matchId?: string;
  monsterName?: string;
  level?: number;
};

type MatchStartedMessage = {
  type: "matchStarted";
  from: string;
  to: string;
  openMatchId?: string;
  inviteId?: string;
  matchId?: string;
};

type JoinRoomMessage = {
  type: "joinRoom";
  address: string;
};

type LeaveRoomMessage = {
  type: "leaveRoom";
  address: string;
};

type RoomSelectMessage = {
  type: "roomSelect";
  address: string;
  monsterId?: string;
  monsterName?: string;
  stage?: number;
};

type RoomStakeMessage = {
  type: "roomStake";
  address: string;
  stakeSui: string;
};

type RoomReadyMessage = {
  type: "roomReady";
  address: string;
  ready: boolean;
};

type PingMessage = {
  type: "ping";
};

type ClientMessage =
  | JoinMessage
  | LeaveMessage
  | InviteMessage
  | MatchCreatedMessage
  | MatchStartedMessage
  | JoinRoomMessage
  | LeaveRoomMessage
  | RoomSelectMessage
  | RoomStakeMessage
  | RoomReadyMessage
  | PingMessage;

type Session = {
  address?: string;
};

type StoredRoomState = {
  participants: RoomParticipant[];
  notices: RoomNotice[];
  createdAt: number;
};

const MAX_RECENT_MATCHES = 20;
const MAX_INVITES = 200;
const MAX_ROOM_NOTICES = 18;
const ROOM_STATE_KEY = "roomState";

function toJson(data: unknown): string {
  return JSON.stringify(data);
}

function safeParseJson(value: string): ClientMessage | null {
  try {
    return JSON.parse(value) as ClientMessage;
  } catch {
    return null;
  }
}

function short(address: string): string {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function nextId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
}

function isAddress(value: unknown): value is string {
  return typeof value === "string" && /^0x[0-9a-fA-F]{2,}$/.test(value);
}

export class ArenaLobby {
  private sessions = new Map<WebSocket, Session>();
  private players = new Map<string, LobbyPlayer>();
  private openMatches = new Map<string, OpenMatch>();
  private invites = new Map<string, LobbyInvite>();
  private recentMatches: RecentMatch[] = [];

  private roomSessions = new Map<WebSocket, Session>();
  private roomParticipants = new Map<string, RoomParticipant>();
  private roomNotices: RoomNotice[] = [];
  private roomCreatedAt = Date.now();

  constructor(private readonly state: DurableObjectState) {
    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get<StoredRoomState>(ROOM_STATE_KEY);
      if (!stored) return;
      this.roomCreatedAt = stored.createdAt || Date.now();
      this.roomNotices = stored.notices || [];
      this.roomParticipants = new Map((stored.participants || []).map((participant) => [participant.address, participant]));
    });
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected websocket upgrade", { status: 426 });
    }

    const url = new URL(request.url);
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];

    if (url.pathname.startsWith("/room/")) {
      this.acceptRoomSession(server);
    } else {
      this.acceptLobbySession(server);
    }

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  private acceptLobbySession(socket: WebSocket) {
    socket.accept();
    this.sessions.set(socket, {});

    socket.addEventListener("message", (event) => {
      this.onLobbyMessage(socket, event.data);
    });

    socket.addEventListener("close", () => {
      this.onLobbyDisconnect(socket);
    });

    socket.addEventListener("error", () => {
      this.onLobbyDisconnect(socket);
    });

    this.sendLobbyState(socket);
  }

  private acceptRoomSession(socket: WebSocket) {
    socket.accept();
    this.roomSessions.set(socket, {});

    socket.addEventListener("message", (event) => {
      this.onRoomMessage(socket, event.data);
    });

    socket.addEventListener("close", () => {
      this.onRoomDisconnect(socket);
    });

    socket.addEventListener("error", () => {
      this.onRoomDisconnect(socket);
    });

    this.sendRoomState(socket);
  }

  private onLobbyMessage(socket: WebSocket, raw: unknown) {
    if (typeof raw !== "string") return;

    const message = safeParseJson(raw);
    if (!message) {
      this.send(socket, { type: "error", message: "Invalid JSON message" });
      return;
    }

    switch (message.type) {
      case "join":
        this.handleJoin(socket, message);
        return;
      case "leave":
        this.handleLeave(socket, message);
        return;
      case "invite":
        this.handleInvite(socket, message);
        return;
      case "matchCreated":
        this.handleMatchCreated(socket, message);
        return;
      case "matchStarted":
        this.handleMatchStarted(socket, message);
        return;
      case "ping":
        this.touchLobbySession(socket);
        this.send(socket, { type: "pong", timestamp: Date.now() });
        return;
      default:
        this.send(socket, { type: "error", message: "Unsupported lobby message type" });
    }
  }

  private onRoomMessage(socket: WebSocket, raw: unknown) {
    if (typeof raw !== "string") return;

    const message = safeParseJson(raw);
    if (!message) {
      this.send(socket, { type: "error", message: "Invalid JSON message" });
      return;
    }

    switch (message.type) {
      case "joinRoom":
        this.handleJoinRoom(socket, message);
        return;
      case "leaveRoom":
        this.handleLeaveRoom(socket, message);
        return;
      case "roomSelect":
        this.handleRoomSelect(socket, message);
        return;
      case "roomStake":
        this.handleRoomStake(socket, message);
        return;
      case "roomReady":
        this.handleRoomReady(socket, message);
        return;
      case "ping":
        this.touchRoomSession(socket);
        this.send(socket, { type: "pong", timestamp: Date.now() });
        return;
      default:
        this.send(socket, { type: "error", message: "Unsupported room message type" });
    }
  }

  private onLobbyDisconnect(socket: WebSocket) {
    const session = this.sessions.get(socket);
    this.sessions.delete(socket);

    if (!session?.address) {
      return;
    }

    const address = session.address;
    if (!this.hasActiveLobbySessionForAddress(address)) {
      this.removeAddressState(address);
    }

    this.broadcastLobbyState();
  }

  private onRoomDisconnect(socket: WebSocket) {
    const session = this.roomSessions.get(socket);
    this.roomSessions.delete(socket);

    if (!session?.address) {
      return;
    }

    const address = session.address;
    if (!this.hasActiveRoomSessionForAddress(address)) {
      const participant = this.roomParticipants.get(address);
      if (participant) {
        participant.present = false;
        participant.ready = false;
        participant.lastSeen = Date.now();
        this.pushRoomNotice(`${short(address)} left the room.`, "warn");
        this.persistRoomState();
      }
    }

    this.broadcastRoomState();
  }

  private handleJoin(socket: WebSocket, message: JoinMessage) {
    if (!isAddress(message.address)) {
      this.send(socket, { type: "error", message: "Invalid address in join message" });
      return;
    }

    const now = Date.now();
    const existing = this.players.get(message.address);
    const session = this.sessions.get(socket) ?? {};
    const previousAddress = session.address;

    const player: LobbyPlayer = {
      address: message.address,
      monsterName: message.monsterName || "Unknown",
      level: Number.isFinite(message.level) ? Number(message.level) : 1,
      joinedAt: existing?.joinedAt ?? now,
      lastSeen: now,
    };

    this.players.set(message.address, player);

    session.address = message.address;
    this.sessions.set(socket, session);

    if (previousAddress && previousAddress !== message.address && !this.hasActiveLobbySessionForAddress(previousAddress)) {
      this.removeAddressState(previousAddress);
    }

    this.broadcastLobbyState();
  }

  private handleLeave(socket: WebSocket, message: LeaveMessage) {
    const session = this.sessions.get(socket);
    const address = session?.address ?? message.address;
    if (!address) return;

    this.sessions.delete(socket);
    if (!this.hasActiveLobbySessionForAddress(address)) {
      this.removeAddressState(address);
    }

    this.broadcastLobbyState();
    try {
      socket.close(1000, "Client left lobby");
    } catch {
      // No-op
    }
  }

  private handleInvite(socket: WebSocket, message: InviteMessage) {
    if (!isAddress(message.from) || !isAddress(message.to) || message.from === message.to) {
      return;
    }

    const session = this.sessions.get(socket);
    if (session?.address !== message.from) {
      this.send(socket, { type: "error", message: "Invite sender mismatch" });
      return;
    }

    const sender = this.players.get(message.from);
    const recipient = this.players.get(message.to);
    if (!sender || !recipient) {
      return;
    }

    const invite: LobbyInvite = {
      id: nextId("invite"),
      from: message.from,
      to: message.to,
      monsterName: sender.monsterName,
      level: sender.level,
      createdAt: Date.now(),
      status: "pending",
    };

    this.invites.set(invite.id, invite);

    if (this.invites.size > MAX_INVITES) {
      const oldestId = [...this.invites.values()].sort((a, b) => a.createdAt - b.createdAt)[0]?.id;
      if (oldestId) this.invites.delete(oldestId);
    }

    this.sendToAddress(message.to, { type: "invite", invite });
    this.sendToAddress(message.from, { type: "invite", invite });
    this.broadcastLobbyState();
  }

  private handleMatchCreated(socket: WebSocket, message: MatchCreatedMessage) {
    if (!isAddress(message.creator)) {
      return;
    }

    const session = this.sessions.get(socket);
    if (session?.address !== message.creator) {
      this.send(socket, { type: "error", message: "Creator mismatch" });
      return;
    }

    const creator = this.players.get(message.creator);
    if (!creator) {
      return;
    }

    const isOpenMatch = !message.opponent;

    if (isOpenMatch) {
      const openMatch: OpenMatch = {
        id: message.matchId || nextId("match"),
        creator: message.creator,
        creatorMonster: message.monsterName || creator.monsterName,
        creatorLevel: Number.isFinite(message.level) ? Number(message.level) : creator.level,
        stakeSui: String(message.stakeSui ?? "0"),
        createdAt: Date.now(),
      };
      this.openMatches.set(openMatch.id, openMatch);
      this.pushRecent(`${short(message.creator)} opened a lobby match (${openMatch.stakeSui} SUI stake)`);
    } else {
      if (isAddress(message.opponent) && message.matchId) {
        const started: StartedMatch = {
          id: nextId("started"),
          from: message.creator,
          to: message.opponent,
          matchId: message.matchId,
          startedAt: Date.now(),
        };
        this.sendToAddress(started.from, { type: "matchStarted", match: started });
        this.sendToAddress(started.to, { type: "matchStarted", match: started });
      }
      this.pushRecent(`On-chain match created: ${short(message.creator)} vs ${short(message.opponent || "")}`);
    }

    this.broadcastLobbyState();
  }

  private handleMatchStarted(socket: WebSocket, message: MatchStartedMessage) {
    if (!isAddress(message.from) || !isAddress(message.to)) {
      return;
    }

    const session = this.sessions.get(socket);
    const sender = session?.address;
    if (!sender || (sender !== message.from && sender !== message.to)) {
      this.send(socket, { type: "error", message: "Match start sender mismatch" });
      return;
    }

    if (message.openMatchId) {
      this.openMatches.delete(message.openMatchId);
    }

    if (message.inviteId) {
      const invite = this.invites.get(message.inviteId);
      if (invite) {
        invite.status = "accepted";
        this.invites.delete(message.inviteId);
      }
    }

    const started: StartedMatch = {
      id: nextId("started"),
      from: message.from,
      to: message.to,
      openMatchId: message.openMatchId,
      inviteId: message.inviteId,
      matchId: message.matchId,
      startedAt: Date.now(),
    };

    this.pushRecent(`Lobby duel ready: ${short(started.from)} vs ${short(started.to)}`);

    this.sendToAddress(started.from, { type: "matchStarted", match: started });
    this.sendToAddress(started.to, { type: "matchStarted", match: started });
    this.broadcastLobbyState();
  }

  private handleJoinRoom(socket: WebSocket, message: JoinRoomMessage) {
    if (!isAddress(message.address)) {
      this.send(socket, { type: "error", message: "Invalid address in room join" });
      return;
    }

    const now = Date.now();
    const session = this.roomSessions.get(socket) ?? {};
    const previousAddress = session.address;
    const existing = this.roomParticipants.get(message.address);

    this.roomParticipants.set(message.address, {
      address: message.address,
      joinedAt: existing?.joinedAt ?? now,
      lastSeen: now,
      present: true,
      monsterId: existing?.monsterId,
      monsterName: existing?.monsterName,
      stage: existing?.stage,
      stakeSui: existing?.stakeSui,
      ready: existing?.ready ?? false,
    });

    session.address = message.address;
    this.roomSessions.set(socket, session);

    if (previousAddress && previousAddress !== message.address && !this.hasActiveRoomSessionForAddress(previousAddress)) {
      const previous = this.roomParticipants.get(previousAddress);
      if (previous) {
        previous.present = false;
        previous.ready = false;
      }
    }

    this.pushRoomNotice(`${short(message.address)} entered the room.`, "info");
    this.persistRoomState();
    this.broadcastRoomState();
  }

  private handleLeaveRoom(socket: WebSocket, message: LeaveRoomMessage) {
    const session = this.roomSessions.get(socket);
    const address = session?.address ?? message.address;
    if (!address) return;

    this.roomSessions.delete(socket);

    if (!this.hasActiveRoomSessionForAddress(address)) {
      const participant = this.roomParticipants.get(address);
      if (participant) {
        participant.present = false;
        participant.ready = false;
        participant.lastSeen = Date.now();
      }
      this.pushRoomNotice(`${short(address)} left the room.`, "warn");
      this.persistRoomState();
    }

    this.broadcastRoomState();
    try {
      socket.close(1000, "Client left room");
    } catch {
      // No-op
    }
  }

  private handleRoomSelect(socket: WebSocket, message: RoomSelectMessage) {
    if (!isAddress(message.address)) return;
    const session = this.roomSessions.get(socket);
    if (session?.address !== message.address) return;

    const participant = this.ensureRoomParticipant(message.address);
    participant.monsterId = message.monsterId;
    participant.monsterName = message.monsterName;
    participant.stage = Number.isFinite(message.stage) ? Number(message.stage) : participant.stage;
    participant.lastSeen = Date.now();

    this.persistRoomState();
    this.broadcastRoomState();
  }

  private handleRoomStake(socket: WebSocket, message: RoomStakeMessage) {
    if (!isAddress(message.address)) return;
    const session = this.roomSessions.get(socket);
    if (session?.address !== message.address) return;

    const participant = this.ensureRoomParticipant(message.address);
    participant.stakeSui = String(message.stakeSui ?? "0");
    participant.lastSeen = Date.now();

    this.persistRoomState();
    this.broadcastRoomState();
  }

  private handleRoomReady(socket: WebSocket, message: RoomReadyMessage) {
    if (!isAddress(message.address)) return;
    const session = this.roomSessions.get(socket);
    if (session?.address !== message.address) return;

    const participant = this.ensureRoomParticipant(message.address);
    participant.ready = Boolean(message.ready);
    participant.lastSeen = Date.now();

    this.pushRoomNotice(
      participant.ready ? `${short(message.address)} is ready.` : `${short(message.address)} is not ready.`,
      participant.ready ? "success" : "info"
    );

    this.persistRoomState();
    this.broadcastRoomState();
  }

  private ensureRoomParticipant(address: string): RoomParticipant {
    const existing = this.roomParticipants.get(address);
    if (existing) return existing;

    const created: RoomParticipant = {
      address,
      joinedAt: Date.now(),
      lastSeen: Date.now(),
      present: true,
      ready: false,
    };
    this.roomParticipants.set(address, created);
    return created;
  }

  private touchLobbySession(socket: WebSocket) {
    const session = this.sessions.get(socket);
    if (!session?.address) return;

    const player = this.players.get(session.address);
    if (!player) return;

    player.lastSeen = Date.now();
  }

  private touchRoomSession(socket: WebSocket) {
    const session = this.roomSessions.get(socket);
    if (!session?.address) return;

    const participant = this.roomParticipants.get(session.address);
    if (!participant) return;

    participant.lastSeen = Date.now();
    participant.present = true;
  }

  private pushRecent(summary: string) {
    const item: RecentMatch = {
      id: nextId("recent"),
      summary,
      timestamp: Date.now(),
    };
    this.recentMatches.unshift(item);
    if (this.recentMatches.length > MAX_RECENT_MATCHES) {
      this.recentMatches.length = MAX_RECENT_MATCHES;
    }
  }

  private pushRoomNotice(summary: string, tone: RoomNotice["tone"]) {
    const item: RoomNotice = {
      id: nextId("room_notice"),
      summary,
      timestamp: Date.now(),
      tone,
    };
    this.roomNotices.unshift(item);
    if (this.roomNotices.length > MAX_ROOM_NOTICES) {
      this.roomNotices.length = MAX_ROOM_NOTICES;
    }
  }

  private broadcastLobbyState() {
    for (const socket of this.sessions.keys()) {
      this.sendLobbyState(socket);
    }
  }

  private broadcastRoomState() {
    for (const socket of this.roomSessions.keys()) {
      this.sendRoomState(socket);
    }
  }

  private sendLobbyState(socket: WebSocket) {
    const session = this.sessions.get(socket);
    const address = session?.address;

    const invites = address
      ? [...this.invites.values()].filter(
          (invite) => invite.status === "pending" && (invite.from === address || invite.to === address)
        )
      : [];

    this.send(socket, {
      type: "lobbyState",
      players: [...this.players.values()].sort((a, b) => b.lastSeen - a.lastSeen),
      openMatches: [...this.openMatches.values()].sort((a, b) => b.createdAt - a.createdAt),
      recentMatches: this.recentMatches,
      invites,
      timestamp: Date.now(),
    });
  }

  private sendRoomState(socket: WebSocket) {
    const participants = [...this.roomParticipants.values()].sort((a, b) => a.joinedAt - b.joinedAt);
    this.send(socket, {
      type: "roomState",
      room: {
        createdAt: this.roomCreatedAt,
        updatedAt: Date.now(),
        participants,
        notices: this.roomNotices,
        roomReady: participants.filter((participant) => participant.ready).length >= 2,
      },
    });
  }

  private sendToAddress(address: string, payload: unknown) {
    for (const [socket, session] of this.sessions) {
      if (session.address === address) {
        this.send(socket, payload);
      }
    }
  }

  private send(socket: WebSocket, payload: unknown) {
    try {
      socket.send(toJson(payload));
    } catch {
      this.onLobbyDisconnect(socket);
      this.onRoomDisconnect(socket);
    }
  }

  private hasActiveLobbySessionForAddress(address: string): boolean {
    for (const session of this.sessions.values()) {
      if (session.address === address) return true;
    }
    return false;
  }

  private hasActiveRoomSessionForAddress(address: string): boolean {
    for (const session of this.roomSessions.values()) {
      if (session.address === address) return true;
    }
    return false;
  }

  private removeAddressState(address: string) {
    this.players.delete(address);

    for (const [matchId, match] of this.openMatches) {
      if (match.creator === address) {
        this.openMatches.delete(matchId);
      }
    }

    for (const [inviteId, invite] of this.invites) {
      if (invite.from === address || invite.to === address) {
        this.invites.delete(inviteId);
      }
    }
  }

  private persistRoomState() {
    void this.state.storage.put(ROOM_STATE_KEY, {
      participants: [...this.roomParticipants.values()],
      notices: this.roomNotices,
      createdAt: this.roomCreatedAt,
    } satisfies StoredRoomState);
  }
}
