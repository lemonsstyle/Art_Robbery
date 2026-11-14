import { cardLabel, createDeck, createRaidTiles, shuffle } from "./data.js";
import {
  MAX_RAIDS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  type Card,
  type GameEvent,
  type GameResult,
  type GameView,
  type LootTile,
  type Pending,
  type Phase,
  type PlayerResult,
  type PublicPlayer,
  type Raid,
  type Seat,
  type StealOption,
  type Tile
} from "./types.js";

export class GameError extends Error {}

interface InternalPlayer {
  id: string;
  name: string;
  seat: number;
  hand: Card[];
  loot: LootTile[];
}

export interface GameOptions {
  startingPlayerId?: string;
  rng?: () => number;
  hostId?: string;
}

export class Game {
  phase: Phase = "PLAYING";
  seq = 1;
  readonly code: string;
  hostId: string;
  readonly players: InternalPlayer[];
  deck: Card[];
  discard: Card[] = [];
  raid: Raid = 1;
  middle: Tile[] = [];
  currentPlayerId: string | null;
  starterId: string;
  dogHolderId: string | null = null;
  pending: Pending | null = null;
  result: GameResult | null = null;
  events: GameEvent[] = [];
  phaseEndsAt: number | null = null;
  notice: string | null = null;

  private readonly rng: () => number;

  constructor(code: string, seats: Seat[], options: GameOptions = {}) {
    if (seats.length < MIN_PLAYERS || seats.length > MAX_PLAYERS) {
      throw new GameError(`需要 ${MIN_PLAYERS}–${MAX_PLAYERS} 名玩家`);
    }
    this.code = code;
    this.rng = options.rng ?? Math.random;
    this.players = seats.map((seat, index) => ({
      id: seat.id,
      name: seat.name,
      seat: index,
      hand: [],
      loot: []
    }));
    this.hostId = options.hostId ?? seats.find((seat) => seat.isHost)?.id ?? seats[0].id;
    this.deck = createDeck(this.rng);
    for (let round = 0; round < 5; round += 1) {
      for (const player of this.players) {
        player.hand.push(this.deck.pop() as Card);
      }
    }
    this.middle = createRaidTiles(1, this.rng);
    this.starterId =
      options.startingPlayerId && this.players.some((p) => p.id === options.startingPlayerId)
        ? options.startingPlayerId
        : this.players[Math.floor(this.rng() * this.players.length)].id;
    this.currentPlayerId = this.starterId;
    this.events = [{ type: "gameStart" }, { type: "raidStart", raid: 1 }];
  }

  getView(viewerId: string | null): GameView {
    const publicPlayers: PublicPlayer[] = this.players
      .slice()
      .sort((a, b) => a.seat - b.seat)
      .map((player) => ({
        id: player.id,
        name: player.name,
        seat: player.seat,
        connected: true,
        isHost: player.id === this.hostId,
        handCount: player.hand.length,
        loot: player.loot.map((tile) => ({ ...tile }))
      }));

    const viewer = viewerId ? this.players.find((player) => player.id === viewerId) : null;

    return {
      code: this.code,
      seq: this.seq,
      phase: this.phase,
      hostId: this.hostId,
      players: publicPlayers,
      you: viewer
        ? {
            id: viewer.id,
            hand: viewer.hand.map((card) => ({ ...card })),
            loot: viewer.loot.map((tile) => ({ ...tile }))
          }
        : null,
      raid: this.raid,
      currentPlayerId: this.currentPlayerId,
      starterId: this.starterId,
      dogHolderId: this.dogHolderId,
      middle: this.middle.map((tile) => ({ ...tile })),
      discardCount: this.discard.length,
      discardTop: this.discard.length ? { ...(this.discard[this.discard.length - 1] as Card) } : null,
      drawCount: this.deck.length,
      pending: this.pending ? (JSON.parse(JSON.stringify(this.pending)) as Pending) : null,
      events: this.events.map((event) => ({ ...event })),
      result: this.result ? (JSON.parse(JSON.stringify(this.result)) as GameResult) : null,
      serverNow: Date.now(),
      phaseEndsAt: this.phaseEndsAt,
      notice: this.notice
    };
  }

  playCard(playerId: string, cardId: string): void {
    this.requireTurn(playerId);
    const player = this.player(playerId);
    const index = player.hand.findIndex((card) => card.id === cardId);
    if (index < 0) throw new GameError("这张牌不在你的手里");
    const [card] = player.hand.splice(index, 1);
    this.seq += 1;
    this.discard.push(card);
    this.events = [{ type: "play", playerId, card: { ...card } }];

    switch (card.type) {
      case "number":
        this.resolveNumber(player, card);
        return;
      case "boss":
        this.resolveBoss(player, card);
        return;
      case "dog":
        this.resolveDogCard(player);
        return;
      case "greedy":
        this.resolveGreedy(player, card);
        return;
    }
  }

  chooseTile(playerId: string, tileId: string): void {
    const pending = this.pending;
    if (!pending || pending.kind !== "middle") throw new GameError("现在不需要选择圆片");
    if (pending.actorId !== playerId) throw new GameError("还没轮到你选择");
    if (!pending.tileIds.includes(tileId)) throw new GameError("这枚圆片不能被选择");
    const tile = this.middle.find((item) => item.id === tileId);
    if (!tile) throw new GameError("这枚圆片已经不在中央");
    this.seq += 1;
    this.pending = null;
    this.takeFromMiddle(this.player(playerId), tile);
    this.finishTurn();
  }

  chooseSteal(playerId: string, targetId: string): void {
    const pending = this.pending;
    if (!pending || pending.kind !== "steal") throw new GameError("现在不需要选择抢夺目标");
    if (pending.actorId !== playerId) throw new GameError("还没轮到你选择");
    const option = pending.options.find((item) => item.playerId === targetId);
    if (!option) throw new GameError("这位玩家没有可抢的圆片");
    this.seq += 1;
    this.pending = null;
    this.stealNumberTile(this.player(playerId), targetId, pending.value, {
      id: pending.cardId,
      type: "number",
      value: pending.value
    });
  }

  chooseGreedy(playerId: string, tileId: string): void {
    const pending = this.pending;
    if (!pending || pending.kind !== "greedy") throw new GameError("现在不需要选择圆片");
    if (pending.actorId !== playerId) throw new GameError("还没轮到你选择");
    if (!pending.tileIds.includes(tileId)) throw new GameError("这枚圆片不能被选择");
    const tile = this.middle.find((item) => item.id === tileId);
    if (!tile) throw new GameError("这枚圆片已经不在中央");
    this.seq += 1;
    this.pending = null;
    this.takeFromMiddle(this.player(playerId), tile);
    this.finishTurn();
  }

  dogResponse(playerId: string, giveDog: boolean): void {
    const pending = this.pending;
    if (!pending || pending.kind !== "dog") throw new GameError("现在没有看门狗选择");
    if (pending.actorId !== playerId) throw new GameError("这不是你的选择");
    const victim = this.player(pending.actorId);
    const thief = this.player(pending.thiefId);
    this.seq += 1;
    const tile = victim.loot.find((item) => item.id === pending.tileId);
    this.pending = null;
    if (!tile) {
      this.finishTurn();
      return;
    }
    if (giveDog) {
      this.dogHolderId = thief.id;
      this.events.push({ type: "dogGiven", fromId: victim.id, toId: thief.id });
    } else {
      this.moveTile(victim, thief, tile);
      this.events.push({
        type: "take",
        playerId: thief.id,
        tile: { ...tile },
        from: "player",
        targetId: victim.id
      });
    }
    this.finishTurn();
  }

  startNextRaid(): void {
    if (this.phase !== "RAID_END") throw new GameError("现在不能开始下一轮");
    if (this.raid >= MAX_RAIDS) throw new GameError("已经是最后一轮");
    this.seq += 1;
    this.raid = (this.raid + 1) as Raid;
    this.middle = createRaidTiles(this.raid, this.rng);
    this.phase = "PLAYING";
    this.pending = null;
    this.result = null;
    this.events = [{ type: "raidStart", raid: this.raid }];
    this.phaseEndsAt = null;
    this.starterId = this.dogHolderId ?? this.starterId;
    this.currentPlayerId = this.starterId;
  }

  autoPlay(playerId: string): boolean {
    if (this.phase === "RAID_END" || this.phase === "GAME_END") return false;
    if (this.pending) {
      if (this.pending.actorId !== playerId) return false;
      switch (this.pending.kind) {
        case "middle":
          this.chooseTile(playerId, this.pending.tileIds[0]);
          return true;
        case "steal": {
          const option = this.pending.options[0];
          this.chooseSteal(playerId, option.playerId);
          return true;
        }
        case "greedy":
          this.chooseGreedy(playerId, this.pending.tileIds[0]);
          return true;
        case "dog":
          this.dogResponse(playerId, false);
          return true;
      }
    }
    if (this.currentPlayerId !== playerId) return false;
    const player = this.player(playerId);
    if (!player.hand.length) return false;
    const card = this.pickAutoCard(player);
    this.playCard(playerId, card.id);
    if (this.pendingActor() === playerId) this.autoPlay(playerId);
    return true;
  }

  private resolveNumber(player: InternalPlayer, card: Card): void {
    const value = card.value ?? 0;
    const middleMatches = this.middle.filter((tile) => tile.kind === "number" && tile.value === value);
    if (middleMatches.length > 1) {
      const sameAlibi = middleMatches.every((tile) => tile.alibi === middleMatches[0].alibi);
      if (sameAlibi) {
        this.takeFromMiddle(player, middleMatches[0]);
        this.finishTurn();
        return;
      }
      this.pending = {
        kind: "middle",
        actorId: player.id,
        cardId: card.id,
        value,
        tileIds: middleMatches.map((tile) => tile.id)
      };
      return;
    }
    if (middleMatches.length === 1) {
      this.takeFromMiddle(player, middleMatches[0]);
      this.finishTurn();
      return;
    }
    const options = this.stealOptions(player.id, value);
    const total = options.reduce((count, option) => count + option.count, 0);
    if (total === 1) {
      const option = options[0];
      this.stealNumberTile(player, option.playerId, value, card);
      return;
    }
    if (total > 1) {
      this.pending = {
        kind: "steal",
        actorId: player.id,
        cardId: card.id,
        value,
        options
      };
      return;
    }
    this.events.push({ type: "noop", playerId: player.id, card: { ...card } });
    this.finishTurn();
  }

  private resolveBoss(player: InternalPlayer, card: Card): void {
    const bossInMiddle = this.middle.find((tile) => tile.kind === "boss" && tile.raid === this.raid);
    if (bossInMiddle) {
      this.takeFromMiddle(player, bossInMiddle);
      this.finishTurn();
      return;
    }
    const owner = this.players.find(
      (candidate) =>
        candidate.id !== player.id &&
        candidate.loot.some(
          (tile) => tile.kind === "boss" && tile.raid === this.raid && !tile.secured
        )
    );
    if (owner) {
      const boss = owner.loot.find(
        (tile) => tile.kind === "boss" && tile.raid === this.raid && !tile.secured
      ) as LootTile;
      this.attemptSteal(player, owner.id, boss.id, card);
      return;
    }
    this.events.push({ type: "noop", playerId: player.id, card: { ...card } });
    this.finishTurn();
  }

  private resolveDogCard(player: InternalPlayer): void {
    const previous = this.dogHolderId;
    if (previous === player.id) {
      this.events.push({
        type: "noop",
        playerId: player.id,
        card: { id: "dog", type: "dog" }
      });
      this.finishTurn();
      return;
    }
    this.dogHolderId = player.id;
    this.events.push({
      type: "dogTaken",
      playerId: player.id,
      from: previous ? "player" : "middle",
      targetId: previous ?? undefined
    });
    this.finishTurn();
  }

  private resolveGreedy(player: InternalPlayer, card: Card): void {
    if (this.middle.length === 0) {
      this.events.push({ type: "noop", playerId: player.id, card: { ...card } });
      this.finishTurn();
      return;
    }
    const first = this.middle[0];
    const identical = this.middle.every(
      (tile) =>
        tile.kind === first.kind &&
        tile.value === first.value &&
        tile.alibi === first.alibi
    );
    if (this.middle.length === 1 || identical) {
      this.takeFromMiddle(player, first);
      this.finishTurn();
      return;
    }
    this.pending = {
      kind: "greedy",
      actorId: player.id,
      cardId: card.id,
      tileIds: this.middle.map((tile) => tile.id)
    };
  }

  private takeFromMiddle(player: InternalPlayer, tile: Tile): void {
    const index = this.middle.findIndex((item) => item.id === tile.id);
    if (index < 0) throw new GameError("这枚圆片已经不在中央");
    this.middle.splice(index, 1);
    const loot: LootTile = { ...tile, secured: false };
    player.loot.push(loot);
    this.events.push({ type: "take", playerId: player.id, tile: { ...tile }, from: "middle" });
  }

  private attemptSteal(thief: InternalPlayer, targetId: string, tileId: string, card: Card): void {
    const victim = this.player(targetId);
    if (victim.id === thief.id) throw new GameError("不能抢自己的圆片");
    const tile = victim.loot.find(
      (item) => item.id === tileId && !item.secured && item.raid === this.raid
    );
    if (!tile) throw new GameError("这枚圆片已经不能被抢");
    if (this.dogHolderId === victim.id) {
      this.pending = {
        kind: "dog",
        actorId: victim.id,
        thiefId: thief.id,
        cardId: card.id,
        tileId: tile.id,
        deadline: Date.now() + 20_000
      };
      return;
    }
    this.moveTile(victim, thief, tile);
    this.events.push({
      type: "take",
      playerId: thief.id,
      tile: { ...tile },
      from: "player",
      targetId: victim.id
    });
    this.finishTurn();
  }

  private moveTile(from: InternalPlayer, to: InternalPlayer, tile: LootTile): void {
    from.loot = from.loot.filter((item) => item.id !== tile.id);
    to.loot.push({ ...tile, secured: false });
  }

  private stealOptions(playerId: string, value: number): StealOption[] {
    return this.players
      .filter((candidate) => candidate.id !== playerId)
      .map((candidate) => ({
        playerId: candidate.id,
        count: this.matchingLoot(candidate, value).length
      }))
      .filter((option) => option.count > 0);
  }

  private matchingLoot(player: InternalPlayer, value: number): LootTile[] {
    return player.loot.filter(
      (tile) =>
        !tile.secured &&
        tile.raid === this.raid &&
        tile.kind === "number" &&
        tile.value === value
    );
  }

  private stealNumberTile(
    thief: InternalPlayer,
    targetId: string,
    value: number,
    card: Card
  ): void {
    const tile = this.matchingLoot(this.player(targetId), value)[0];
    if (!tile) throw new GameError("这枚圆片已经不能被抢");
    this.attemptSteal(thief, targetId, tile.id, card);
  }

  private finishTurn(): void {
    const player = this.player(this.currentPlayerId as string);
    this.pending = null;
    this.draw(player);
    if (this.middle.length === 0) {
      this.endRaid();
      return;
    }
    this.currentPlayerId = this.nextPlayerId(player.id);
  }

  private draw(player: InternalPlayer): void {
    if (this.deck.length === 0) {
      if (this.discard.length === 0) return;
      this.deck = shuffle(this.discard, this.rng);
      this.discard = [];
    }
    const card = this.deck.pop();
    if (card) player.hand.push(card);
  }

  private endRaid(): void {
    for (const player of this.players) {
      const boss = player.loot.find(
        (tile) => tile.raid === this.raid && tile.kind === "boss" && !tile.secured
      );
      if (!boss) continue;
      const hasFourOrFive = player.loot.some(
        (tile) =>
          tile.raid === this.raid &&
          tile.kind === "number" &&
          !tile.secured &&
          (tile.value === 4 || tile.value === 5)
      );
      if (!hasFourOrFive) {
        player.loot = player.loot.filter((tile) => tile.id !== boss.id);
        this.events.push({ type: "bossLost", playerId: player.id, tile: { ...boss } });
      }
    }
    for (const player of this.players) {
      for (const tile of player.loot) {
        if (tile.raid === this.raid) tile.secured = true;
      }
    }
    this.currentPlayerId = null;
    this.pending = null;
    this.phase = this.raid === MAX_RAIDS ? "GAME_END" : "RAID_END";
    this.events.push({ type: "raidEnd", raid: this.raid });
    if (this.phase === "GAME_END") this.computeResult();
  }

  private computeResult(): void {
    const stats = this.players.map((player) => {
      const alibi = player.loot.reduce((sum, tile) => sum + tile.alibi, 0);
      const lootPoints = player.loot.reduce((sum, tile) => sum + tile.value, 0);
      const bossKept = player.loot.filter((tile) => tile.kind === "boss").length;
      return { player, alibi, lootPoints, bossKept };
    });
    const minAlibi = Math.min(...stats.map((item) => item.alibi));
    const eliminated = new Set<string>();
    const penalties = new Map<string, number>();

    if (this.players.length === 2) {
      for (const item of stats) {
        if (item.alibi === minAlibi) penalties.set(item.player.id, Math.min(10, item.lootPoints));
      }
    } else {
      for (const item of stats) {
        if (item.alibi === minAlibi) eliminated.add(item.player.id);
      }
    }

    const results: PlayerResult[] = stats.map((item) => {
      const penalty = penalties.get(item.player.id) ?? 0;
      const isEliminated = eliminated.has(item.player.id);
      const raidPoints = ([1, 2, 3, 4] as Raid[]).map((raid) =>
        item.player.loot
          .filter((tile) => tile.raid === raid)
          .reduce((sum, tile) => sum + tile.value, 0)
      );
      return {
        playerId: item.player.id,
        name: item.player.name,
        alibi: item.alibi,
        lootPoints: item.lootPoints,
        penalty,
        score: isEliminated ? item.lootPoints : item.lootPoints - penalty,
        raidPoints,
        eliminated: isEliminated,
        bossKept: item.bossKept
      };
    });

    const eligible = results.filter((item) => !item.eliminated);
    let winnerIds: string[] = [];
    let reason = "";
    if (eligible.length === 0) {
      reason = "全员被捕：没有人留下不在场证明";
    } else {
      const best = Math.max(...eligible.map((item) => item.score));
      let leaders = eligible.filter((item) => item.score === best);
      if (leaders.length > 1) {
        const bestAlibi = Math.max(...leaders.map((item) => item.alibi));
        leaders = leaders.filter((item) => item.alibi === bestAlibi);
      }
      winnerIds = leaders.map((item) => item.playerId);
      const names = leaders.map((item) => item.name).join("、");
      reason =
        leaders.length === 1
          ? `${names} 以 ${best} 分获胜`
          : `${names} 并列获胜（${best} 分）`;
    }

    results.sort((a, b) => {
      if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
      if (b.score !== a.score) return b.score - a.score;
      return b.alibi - a.alibi;
    });

    this.result = { players: results, winnerIds, reason };
    this.events.push({ type: "gameEnd" });
  }

  private pickAutoCard(player: InternalPlayer): Card {
    const greedy = player.hand.find((card) => card.type === "greedy");
    if (greedy && this.middle.length > 0) return greedy;
    const dog = player.hand.find((card) => card.type === "dog");
    if (dog && this.dogHolderId !== player.id) return dog;
    const bossCard = player.hand.find((card) => card.type === "boss");
    if (bossCard && this.hasBossTarget(player.id)) return bossCard;
    const numberMiddle = player.hand.find(
      (card) =>
        card.type === "number" &&
        this.middle.some((tile) => tile.kind === "number" && tile.value === card.value)
    );
    if (numberMiddle) return numberMiddle;
    const numberSteal = player.hand.find(
      (card) => card.type === "number" && this.stealOptions(player.id, card.value ?? 0).length > 0
    );
    if (numberSteal) return numberSteal;
    return player.hand[0];
  }

  private hasBossTarget(playerId: string): boolean {
    if (this.middle.some((tile) => tile.kind === "boss" && tile.raid === this.raid)) return true;
    return this.players.some(
      (player) =>
        player.id !== playerId &&
        player.loot.some(
          (tile) => tile.kind === "boss" && tile.raid === this.raid && !tile.secured
        )
    );
  }

  private nextPlayerId(playerId: string): string {
    const ordered = this.players.slice().sort((a, b) => a.seat - b.seat);
    const index = ordered.findIndex((player) => player.id === playerId);
    return ordered[(index + 1) % ordered.length].id;
  }

  private pendingActor(): string | null {
    return this.pending?.actorId ?? null;
  }

  private requireTurn(playerId: string): void {
    if (this.phase !== "PLAYING") throw new GameError("现在不是出牌阶段");
    if (this.pending) throw new GameError("请先完成当前选择");
    if (this.currentPlayerId !== playerId) throw new GameError("还没轮到你");
  }

  private player(playerId: string): InternalPlayer {
    const player = this.players.find((candidate) => candidate.id === playerId);
    if (!player) throw new GameError("玩家不存在");
    return player;
  }
}

export function describeEvent(event: GameEvent, players: { id: string; name: string }[]): string {
  const nameOf = (id: string) => players.find((player) => player.id === id)?.name ?? "有人";
  switch (event.type) {
    case "gameStart":
      return "牌局开始";
    case "raidStart":
      return `第 ${event.raid} 轮开始`;
    case "play":
      return `${nameOf(event.playerId)} 打出${cardLabel(event.card)}`;
    case "take": {
      const what = event.tile.kind === "boss" ? "老板圆片" : `数字 ${event.tile.value} 圆片`;
      const dots = event.tile.alibi > 0 ? `，${event.tile.alibi} 个白点` : "";
      if (event.from === "middle") return `${nameOf(event.playerId)} 从中央拿走${what}${dots}`;
      return `${nameOf(event.playerId)} 从 ${nameOf(event.targetId ?? "")} 手里抢走${what}${dots}`;
    }
    case "dogTaken":
      return `${nameOf(event.playerId)} 拿走了看门狗`;
    case "dogGiven":
      return `${nameOf(event.fromId)} 把看门狗交给 ${nameOf(event.toId)}，保住了圆片`;
    case "bossLost":
      return `${nameOf(event.playerId)} 没能保住老板圆片`;
    case "noop":
      return `${nameOf(event.playerId)} 打出的牌没有可拿的圆片`;
    case "raidEnd":
      return `第 ${event.raid} 轮结束`;
    case "gameEnd":
      return "牌局结束，开始结算";
  }
}
