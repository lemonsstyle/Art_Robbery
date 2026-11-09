export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 5;
export const MAX_RAIDS = 4;

export type Phase = "LOBBY" | "PLAYING" | "RAID_END" | "GAME_END";
export type Raid = 1 | 2 | 3 | 4;
export type CardType = "number" | "boss" | "dog" | "greedy";
export type TileKind = "number" | "boss";

export interface Card {
  id: string;
  type: CardType;
  value?: number;
}

export interface Tile {
  id: string;
  raid: Raid;
  kind: TileKind;
  value: number;
  alibi: number;
}

export interface LootTile extends Tile {
  secured: boolean;
}

export interface Player {
  id: string;
  name: string;
  seat: number;
  connected: boolean;
  isHost: boolean;
  hand: Card[];
  loot: LootTile[];
}

export interface PublicPlayer {
  id: string;
  name: string;
  seat: number;
  connected: boolean;
  isHost: boolean;
  handCount: number;
  loot: LootTile[];
}

export interface StealOption {
  playerId: string;
  tileIds: string[];
}

export type Pending =
  | {
      kind: "middle";
      actorId: string;
      cardId: string;
      value: number;
      tileIds: string[];
      deadline?: number;
    }
  | {
      kind: "steal";
      actorId: string;
      cardId: string;
      value: number;
      options: StealOption[];
      deadline?: number;
    }
  | {
      kind: "greedy";
      actorId: string;
      cardId: string;
      tileIds: string[];
      deadline?: number;
    }
  | {
      kind: "dog";
      actorId: string;
      thiefId: string;
      cardId: string;
      tileId: string;
      deadline: number;
    };

export type GameEvent =
  | { type: "gameStart" }
  | { type: "raidStart"; raid: Raid }
  | { type: "play"; playerId: string; card: Card }
  | { type: "take"; playerId: string; tile: Tile; from: "middle" | "player"; targetId?: string }
  | { type: "dogTaken"; playerId: string; from: "middle" | "player"; targetId?: string }
  | { type: "dogGiven"; fromId: string; toId: string }
  | { type: "bossLost"; playerId: string; tile: Tile }
  | { type: "noop"; playerId: string; card: Card }
  | { type: "raidEnd"; raid: Raid }
  | { type: "gameEnd" };

export interface PlayerResult {
  playerId: string;
  name: string;
  alibi: number;
  lootPoints: number;
  penalty: number;
  score: number;
  raidPoints: number[];
  eliminated: boolean;
  bossKept: number;
}

export interface GameResult {
  players: PlayerResult[];
  winnerIds: string[];
  reason: string;
}

export interface GameView {
  code: string;
  seq: number;
  phase: Phase;
  hostId: string;
  players: PublicPlayer[];
  you: { id: string; hand: Card[]; loot: LootTile[] } | null;
  raid: Raid;
  currentPlayerId: string | null;
  starterId: string | null;
  dogHolderId: string | null;
  middle: Tile[];
  discardCount: number;
  discardTop: Card | null;
  drawCount: number;
  pending: Pending | null;
  events: GameEvent[];
  result: GameResult | null;
  serverNow: number;
  phaseEndsAt: number | null;
  notice: string | null;
}

export interface Seat {
  id: string;
  name: string;
  isHost?: boolean;
  connected?: boolean;
}
