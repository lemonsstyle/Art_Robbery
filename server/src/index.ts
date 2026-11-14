import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { networkInterfaces } from "node:os";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocket, WebSocketServer } from "ws";
import { Game, GameError, MAX_PLAYERS, QUICK_CHAT } from "@steal/shared";
import { RoomStore, type Room, type RoomPlayer } from "./rooms.js";

const CLIENT_DIST = fileURLToPath(new URL("../../client/dist", import.meta.url));

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".mp3": "audio/mpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".map": "application/json"
};

interface Session {
  code: string;
  playerId: string;
}

interface ClientMessage {
  type?: unknown;
  [key: string]: unknown;
}

function send(socket: WebSocket, message: unknown): void {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function readString(message: ClientMessage, key: string): string {
  const value = message[key];
  return typeof value === "string" ? value : "";
}

function readBoolean(message: ClientMessage, key: string): boolean {
  return message[key] === true;
}

export function startServer(
  port = Number(process.env.PORT ?? 8787),
  host = process.env.HOST ?? "0.0.0.0"
) {
  const store = new RoomStore();
  const sessions = new WeakMap<WebSocket, Session>();
  const lastChatAt = new Map<string, number>();

  const broadcast = (room: Room): void => {
    for (const player of room.players) {
      if (!player.socket || !player.connected) continue;
      send(player.socket, { type: "state", view: store.buildView(room, player.id) });
    }
  };

  const settle = (room: Room): void => {
    const game = room.game;
    if (game?.phase === "RAID_END" && game.phaseEndsAt == null) {
      game.phaseEndsAt = Date.now() + 2800;
    }
    broadcast(room);
    schedule(room);
  };

  const schedule = (room: Room): void => {
    store.clearTimers(room);
    const game = room.game;
    if (!game) return;

    if (game.phase === "RAID_END") {
      if (game.phaseEndsAt == null) game.phaseEndsAt = Date.now() + 2800;
      room.phaseTimer = setTimeout(() => {
        const current = room.game;
        if (!current || current.phase !== "RAID_END") return;
        try {
          current.startNextRaid();
          current.phaseEndsAt = null;
        } catch {
          return;
        }
        broadcast(room);
        schedule(room);
      }, Math.max(0, game.phaseEndsAt - Date.now()));
      return;
    }

    if (game.phase !== "PLAYING") return;

    if (game.pending) {
      const pending = game.pending;
      const actor = room.players.find((player) => player.id === pending.actorId);
      if (pending.kind === "dog") {
        room.dogTimer = setTimeout(() => {
          const current = room.game;
          if (!current) return;
          const live = current.pending;
          if (live && live.kind === "dog") {
            try {
              current.dogResponse(live.actorId, false);
            } catch {
              return;
            }
          }
          settle(room);
        }, Math.max(0, pending.deadline - Date.now()));
      } else if (actor && !actor.connected) {
        room.turnTimer = setTimeout(() => {
          const current = room.game;
          if (!current || !current.pending) return;
          try {
            current.autoPlay(current.pending.actorId);
          } catch {
            return;
          }
          settle(room);
        }, 6000);
      }
      return;
    }

    const currentPlayer = room.players.find((player) => player.id === game.currentPlayerId);
    if (currentPlayer && !currentPlayer.connected) {
      room.turnTimer = setTimeout(() => {
        const current = room.game;
        if (!current || !current.currentPlayerId) return;
        try {
          current.autoPlay(current.currentPlayerId);
        } catch {
          return;
        }
        settle(room);
      }, 12_000);
    }
  };

  const attach = (room: Room, player: RoomPlayer, socket: WebSocket): void => {
    const previousSocket = player.socket;
    player.socket = socket;
    player.connected = true;
    player.lastSeen = Date.now();
    room.updatedAt = Date.now();
    const timer = room.disconnectTimers.get(player.id);
    if (timer) clearTimeout(timer);
    room.disconnectTimers.delete(player.id);
    if (previousSocket && previousSocket !== socket) {
      send(previousSocket, { type: "superseded" });
      previousSocket.close();
    }
  };

  const detach = (room: Room, player: RoomPlayer): void => {
    player.connected = false;
    player.socket = null;
    player.lastSeen = Date.now();
    room.updatedAt = Date.now();
    store.transferHost(room);
    if (!room.game) {
      const timer = setTimeout(() => {
        if (room.game || player.connected || !store.rooms.has(room.code)) return;
        store.removePlayer(room, player.id);
        if (store.rooms.has(room.code)) settle(room);
      }, 90_000);
      room.disconnectTimers.set(player.id, timer);
    }
    settle(room);
  };

  const requireSession = (
    session: Session | undefined
  ): { room: Room; player: RoomPlayer; game: Game } => {
    if (!session) throw new Error("先创建或加入房间");
    const room = store.get(session.code);
    if (!room) throw new Error("房间不存在或已关闭");
    const player = room.players.find((candidate) => candidate.id === session.playerId);
    if (!player) throw new Error("你的座位已经不在房间里了");
    if (!room.game) throw new Error("牌局还没开始");
    return { room, player, game: room.game };
  };

  const server = createServer((request, response) => {
    void handleRequest(request, response);
  });

  const wss = new WebSocketServer({ server, path: "/ws", maxPayload: 64 * 1024 });

  wss.on("connection", (socket: WebSocket) => {
    let session: Session | undefined;

    socket.on("message", (raw) => {
      let message: ClientMessage;
      try {
        const parsed = JSON.parse(raw.toString()) as unknown;
        if (!parsed || typeof parsed !== "object") throw new Error();
        message = parsed as ClientMessage;
      } catch {
        send(socket, { type: "error", message: "消息格式不对" });
        return;
      }
      if (typeof message.type !== "string") {
        send(socket, { type: "error", message: "消息格式不对" });
        return;
      }

      try {
        switch (message.type) {
          case "create": {
            if (session) throw new Error("你已经在房间里了");
            const { room, player } = store.create(readString(message, "name"));
            attach(room, player, socket);
            session = { code: room.code, playerId: player.id };
            sessions.set(socket, session);
            send(socket, {
              type: "session",
              code: room.code,
              playerId: player.id,
              token: player.token,
              name: player.name
            });
            settle(room);
            return;
          }
          case "join": {
            if (session) throw new Error("你已经在房间里了");
            const code = readString(message, "code").trim().toUpperCase();
            const { room, player } = store.join(code, readString(message, "name"));
            attach(room, player, socket);
            session = { code: room.code, playerId: player.id };
            sessions.set(socket, session);
            send(socket, {
              type: "session",
              code: room.code,
              playerId: player.id,
              token: player.token,
              name: player.name
            });
            settle(room);
            return;
          }
          case "rejoin": {
            if (session) throw new Error("你已经在房间里了");
            const code = readString(message, "code").trim().toUpperCase();
            const { room, player } = store.rejoin(
              code,
              readString(message, "playerId"),
              readString(message, "token")
            );
            attach(room, player, socket);
            session = { code: room.code, playerId: player.id };
            sessions.set(socket, session);
            send(socket, {
              type: "session",
              code: room.code,
              playerId: player.id,
              token: player.token,
              name: player.name
            });
            settle(room);
            return;
          }
          case "start": {
            if (!session) throw new Error("先创建或加入房间");
            const room = store.requireRoom(session.code);
            if (room.hostId !== session.playerId) throw new Error("只有房主可以开始");
            if (room.game) throw new Error("牌局已经开始了");
            const seats = store.seatsFor(room);
            if (seats.length < 2) throw new Error("至少需要 2 名在线玩家");
            room.players = room.players.filter((player) => player.connected).slice(0, MAX_PLAYERS);
            room.game = new Game(room.code, seats, { hostId: room.hostId });
            settle(room);
            return;
          }
          case "play": {
            const { room, player, game } = requireSession(session);
            game.playCard(player.id, readString(message, "cardId"));
            settle(room);
            return;
          }
          case "chooseTile": {
            const { room, player, game } = requireSession(session);
            game.chooseTile(player.id, readString(message, "tileId"));
            settle(room);
            return;
          }
          case "chooseSteal": {
            const { room, player, game } = requireSession(session);
            game.chooseSteal(player.id, readString(message, "playerId"));
            settle(room);
            return;
          }
          case "chooseGreedy": {
            const { room, player, game } = requireSession(session);
            game.chooseGreedy(player.id, readString(message, "tileId"));
            settle(room);
            return;
          }
          case "dogResponse": {
            const { room, player, game } = requireSession(session);
            game.dogResponse(player.id, readBoolean(message, "giveDog"));
            settle(room);
            return;
          }
          case "rematch": {
            if (!session) throw new Error("先创建或加入房间");
            const room = store.requireRoom(session.code);
            if (room.hostId !== session.playerId) throw new Error("只有房主可以再来一局");
            if (!room.game || room.game.phase !== "GAME_END") throw new Error("这一局还没结束");
            const connected = room.players.filter((player) => player.connected);
            if (connected.length < 2) throw new Error("至少需要 2 名在线玩家");
            connected.forEach((player, index) => {
              player.seat = index;
            });
            room.players = connected;
            const seats = store.seatsFor(room);
            room.game = new Game(room.code, seats, { hostId: room.hostId });
            settle(room);
            return;
          }
          case "leave": {
            if (!session) return;
            const room = store.get(session.code);
            if (room) {
              const player = room.players.find((candidate) => candidate.id === session?.playerId);
              if (player) {
                if (room.game) {
                  detach(room, player);
                } else {
                  store.removePlayer(room, player.id);
                  if (store.rooms.has(room.code)) settle(room);
                }
              }
            }
            sessions.delete(socket);
            session = undefined;
            send(socket, { type: "left" });
            return;
          }
          case "quickChat": {
            const { room, player } = requireSession(session);
            const messageId = readString(message, "messageId");
            const phrase = QUICK_CHAT.find((item) => item.id === messageId);
            if (!phrase) throw new Error("没有这条快捷语");
            const now = Date.now();
            if (now - (lastChatAt.get(player.id) ?? 0) < 800) {
              throw new Error("发得太快了，缓一下");
            }
            lastChatAt.set(player.id, now);
            const chat = {
              type: "chat",
              playerId: player.id,
              messageId: phrase.id,
              text: phrase.text,
              at: now
            };
            for (const member of room.players) {
              if (member.connected && member.socket) send(member.socket, chat);
            }
            return;
          }
          case "ping":
            send(socket, { type: "pong" });
            return;
          default:
            throw new Error("没有这种操作");
        }
      } catch (error) {
        const text = error instanceof GameError || error instanceof Error ? error.message : "操作失败";
        send(socket, { type: "error", message: text });
      }
    });

    socket.on("close", () => {
      const active = sessions.get(socket);
      if (!active) return;
      const room = store.get(active.code);
      if (!room) return;
      const player = room.players.find((candidate) => candidate.id === active.playerId);
      if (!player || player.socket !== socket) return;
      detach(room, player);
    });
  });

  function handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    if (url.pathname === "/health") {
      response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      response.end(
        JSON.stringify({
          ok: true,
          rooms: store.rooms.size,
          players: Array.from(store.rooms.values()).reduce(
            (sum, room) => sum + room.players.filter((player) => player.connected).length,
            0
          ),
          uptime: process.uptime()
        })
      );
      return Promise.resolve();
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD" });
      response.end("Method Not Allowed");
      return Promise.resolve();
    }
    return serveStatic(url.pathname, request.method === "HEAD", response);
  }

  async function serveStatic(
    rawPath: string,
    headOnly: boolean,
    response: ServerResponse
  ): Promise<void> {
    if (!existsSync(CLIENT_DIST)) {
      response.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("前端还没有构建。先运行 npm run build。");
      return;
    }
    let pathname: string;
    try {
      pathname = decodeURIComponent(rawPath);
    } catch {
      response.writeHead(400);
      response.end("Bad Request");
      return;
    }
    if (pathname === "/") pathname = "/index.html";
    const filePath = resolve(CLIENT_DIST, `.${pathname}`);
    if (!filePath.startsWith(`${CLIENT_DIST}${sep}`)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }
    try {
      const info = await stat(filePath);
      if (!info.isFile()) throw new Error("not a file");
      const body = await readFile(filePath);
      response.writeHead(200, {
        ...securityHeaders(),
        "Content-Type": MIME[extname(filePath).toLowerCase()] ?? "application/octet-stream",
        "Content-Length": body.length,
        "Cache-Control": pathname.startsWith("/assets/")
          ? "public, max-age=31536000, immutable"
          : "no-cache"
      });
      if (headOnly) response.end();
      else response.end(body);
    } catch {
      if (!extname(pathname)) {
        const index = resolve(CLIENT_DIST, "index.html");
        if (existsSync(index)) {
          const body = await readFile(index);
          response.writeHead(200, {
            ...securityHeaders(),
            "Content-Type": "text/html; charset=utf-8",
            "Content-Length": body.length,
            "Cache-Control": "no-cache"
          });
          if (headOnly) response.end();
          else response.end(body);
          return;
        }
      }
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not Found");
    }
  }

  const sweepTimer = setInterval(() => store.sweep(), 10 * 60 * 1000);

  server.listen(port, host, () => {
    const address = server.address();
    const actualPort = typeof address === "object" && address ? address.port : port;
    const lan = lanAddress();
    console.log(`神偷大盗服务已启动: http://${lan}:${actualPort}`);
    console.log(`WebSocket: ws://${lan}:${actualPort}/ws`);
  });

  return {
    server,
    wss,
    store,
    close: async () => {
      clearInterval(sweepTimer);
      for (const room of store.rooms.values()) {
        store.clearTimers(room);
        for (const timer of room.disconnectTimers.values()) clearTimeout(timer);
        room.disconnectTimers.clear();
      }
      store.rooms.clear();
      for (const client of wss.clients) client.terminate();
      wss.close();
      await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
    }
  };
}

function securityHeaders(): Record<string, string> {
  return {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
    "X-Frame-Options": "SAMEORIGIN",
    "Content-Security-Policy":
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' ws: wss:; base-uri 'self'; form-action 'self'"
  };
}

function lanAddress(): string {
  for (const interfaces of Object.values(networkInterfaces())) {
    for (const item of interfaces ?? []) {
      if (item.family === "IPv4" && !item.internal) return item.address;
    }
  }
  return "localhost";
}

const isMain =
  process.argv[1] != null && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  startServer();
}
