import { randomInt, randomUUID } from "node:crypto";
import {
  Game,
  MAX_PLAYERS,
  type GameView,
  type Seat
} from "@steal/shared";
import type { WebSocket } from "ws";

export interface RoomPlayer {
  id: string;
  name: string;
  token: string;
  seat: number;
  socket: WebSocket | null;
  connected: boolean;
  lastSeen: number;
}

export interface Room {
  code: string;
  players: RoomPlayer[];
  hostId: string;
  game: Game | null;
  createdAt: number;
  updatedAt: number;
  phaseTimer: ReturnType<typeof setTimeout> | null;
  dogTimer: ReturnType<typeof setTimeout> | null;
  turnTimer: ReturnType<typeof setTimeout> | null;
  disconnectTimers: Map<string, ReturnType<typeof setTimeout>>;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ";

export class RoomStore {
  readonly rooms = new Map<string, Room>();

  create(name: string): { room: Room; player: RoomPlayer } {
    const code = this.uniqueCode();
    const player = this.makePlayer(this.cleanName(name), 0);
    const now = Date.now();
    const room: Room = {
      code,
      players: [player],
      hostId: player.id,
      game: null,
      createdAt: now,
      updatedAt: now,
      phaseTimer: null,
      dogTimer: null,
      turnTimer: null,
      disconnectTimers: new Map()
    };
    this.rooms.set(code, room);
    return { room, player };
  }

  join(code: string, name: string): { room: Room; player: RoomPlayer } {
    const room = this.requireRoom(code);
    if (room.game) throw new Error("这局牌已经开始，等下一局吧");
    if (room.players.length >= MAX_PLAYERS) throw new Error("房间已满（最多 5 人）");
    const cleaned = this.cleanName(name);
    if (room.players.some((player) => player.name.toLowerCase() === cleaned.toLowerCase())) {
      throw new Error("这个名字已经有人用了");
    }
    const usedSeats = new Set(room.players.map((player) => player.seat));
    let seat = 0;
    while (usedSeats.has(seat)) seat += 1;
    const player = this.makePlayer(cleaned, seat);
    room.players.push(player);
    room.updatedAt = Date.now();
    this.transferHost(room);
    return { room, player };
  }

  rejoin(code: string, playerId: string, token: string): { room: Room; player: RoomPlayer } {
    const room = this.requireRoom(code);
    const player = room.players.find((candidate) => candidate.id === playerId);
    if (!player || player.token !== token) throw new Error("无法恢复座位，请重新加入");
    const timer = room.disconnectTimers.get(player.id);
    if (timer) clearTimeout(timer);
    room.disconnectTimers.delete(player.id);
    player.connected = true;
    player.lastSeen = Date.now();
    room.updatedAt = Date.now();
    return { room, player };
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  requireRoom(code: string): Room {
    const room = this.get(code);
    if (!room) throw new Error("房间不存在或已关闭");
    return room;
  }

  removePlayer(room: Room, playerId: string): void {
    const timer = room.disconnectTimers.get(playerId);
    if (timer) clearTimeout(timer);
    room.disconnectTimers.delete(playerId);
    room.players = room.players.filter((player) => player.id !== playerId);
    room.updatedAt = Date.now();
    if (room.players.length === 0) {
      this.deleteRoom(room);
      return;
    }
    this.transferHost(room);
  }

  transferHost(room: Room): void {
    if (room.players.some((player) => player.id === room.hostId && player.connected)) return;
    const next =
      room.players.find((player) => player.connected) ?? room.players[0] ?? null;
    if (next) room.hostId = next.id;
  }

  deleteRoom(room: Room): void {
    this.clearTimers(room);
    for (const timer of room.disconnectTimers.values()) clearTimeout(timer);
    room.disconnectTimers.clear();
    this.rooms.delete(room.code);
  }

  clearTimers(room: Room): void {
    if (room.phaseTimer) clearTimeout(room.phaseTimer);
    if (room.dogTimer) clearTimeout(room.dogTimer);
    if (room.turnTimer) clearTimeout(room.turnTimer);
    room.phaseTimer = null;
    room.dogTimer = null;
    room.turnTimer = null;
  }

  buildView(room: Room, playerId: string): GameView {
    const view = room.game ? room.game.getView(playerId) : this.lobbyView(room, playerId);
    view.hostId = room.hostId;
    view.serverNow = Date.now();
    view.players = view.players.map((player) => {
      const live = room.players.find((candidate) => candidate.id === player.id);
      return {
        ...player,
        connected: live?.connected ?? false,
        isHost: player.id === room.hostId
      };
    });
    if (room.game) {
      const waitingId = room.game.pending?.actorId ?? room.game.currentPlayerId;
      const waiting = room.players.find((player) => player.id === waitingId);
      view.notice =
        waiting && !waiting.connected
          ? `${waiting.name} 暂时离线，稍后会代为行动`
          : null;
    }
    return view;
  }

  sweep(now = Date.now()): void {
    for (const room of this.rooms.values()) {
      const connected = room.players.some((player) => player.connected);
      if (room.players.length === 0 || (!connected && now - room.updatedAt > 2 * 60 * 60 * 1000)) {
        this.deleteRoom(room);
      }
    }
  }

  seatsFor(room: Room): Seat[] {
    return room.players
      .filter((player) => player.connected)
      .sort((a, b) => a.seat - b.seat)
      .map((player) => ({
        id: player.id,
        name: player.name,
        isHost: player.id === room.hostId,
        connected: true
      }));
  }

  private lobbyView(room: Room, playerId: string): GameView {
    const viewer = room.players.find((player) => player.id === playerId) ?? null;
    return {
      code: room.code,
      seq: 0,
      phase: "LOBBY",
      hostId: room.hostId,
      players: room.players
        .slice()
        .sort((a, b) => a.seat - b.seat)
        .map((player) => ({
          id: player.id,
          name: player.name,
          seat: player.seat,
          connected: player.connected,
          isHost: player.id === room.hostId,
          handCount: 0,
          loot: []
        })),
      you: viewer ? { id: viewer.id, hand: [], loot: [] } : null,
      raid: 1,
      currentPlayerId: null,
      starterId: null,
      dogHolderId: null,
      middle: [],
      discardCount: 0,
      discardTop: null,
      drawCount: 0,
      pending: null,
      events: [],
      result: null,
      serverNow: Date.now(),
      phaseEndsAt: null,
      notice: null
    };
  }

  private makePlayer(name: string, seat: number): RoomPlayer {
    return {
      id: `p_${randomUUID().slice(0, 8)}`,
      name,
      token: randomUUID(),
      seat,
      socket: null,
      connected: true,
      lastSeen: Date.now()
    };
  }

  private cleanName(name: string): string {
    const cleaned = name.trim().replace(/\s+/g, " ").slice(0, 16);
    if (!cleaned) throw new Error("先给自己起个名字");
    return cleaned;
  }

  private uniqueCode(): string {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      let code = "";
      for (let index = 0; index < 4; index += 1) {
        code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
      }
      if (!this.rooms.has(code)) return code;
    }
    throw new Error("暂时无法创建房间，请稍后再试");
  }
}
