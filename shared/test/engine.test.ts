import { describe, expect, it } from "vitest";
import {
  Game,
  createDeck,
  createRaidTiles,
  createRng,
  type Card,
  type LootTile,
  type Seat,
  type Tile
} from "../src/index";

const seats = (count: number): Seat[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `p${index + 1}`,
    name: `玩家${index + 1}`
  }));

const makeGame = (count = 2, seed = 7): Game =>
  new Game("TEST", seats(count), { rng: createRng(seed), startingPlayerId: "p1" });

const tile = (
  id: string,
  value: number,
  raid: 1 | 2 | 3 | 4 = 1,
  kind: "number" | "boss" = "number",
  alibi = 0
): Tile => ({ id, raid, kind, value, alibi });

const loot = (item: Tile, secured = false): LootTile => ({ ...item, secured });

describe("deck and tiles", () => {
  it("builds the 55 card deck with the official distribution", () => {
    const deck = createDeck(createRng(1));
    expect(deck).toHaveLength(55);
    expect(deck.filter((card) => card.type === "number")).toHaveLength(36);
    for (let value = 0; value <= 5; value += 1) {
      expect(deck.filter((card) => card.type === "number" && card.value === value)).toHaveLength(6);
    }
    expect(deck.filter((card) => card.type === "boss")).toHaveLength(6);
    expect(deck.filter((card) => card.type === "dog")).toHaveLength(6);
    expect(deck.filter((card) => card.type === "greedy")).toHaveLength(7);
  });

  it("builds nine loot tiles per raid with the official values", () => {
    for (const raid of [1, 2, 3, 4] as const) {
      const tiles = createRaidTiles(raid, createRng(raid));
      expect(tiles).toHaveLength(9);
      expect(tiles.filter((item) => item.value === 3 && item.kind === "number")).toHaveLength(3);
      expect(tiles.filter((item) => item.kind === "boss")).toHaveLength(1);
      expect(tiles.reduce((sum, item) => sum + item.value, 0)).toBe(26);
    }
  });
});

describe("game flow", () => {
  it("deals five cards to each player and puts nine tiles in the middle", () => {
    const game = makeGame(4);
    expect(game.players.map((player) => player.hand.length)).toEqual([5, 5, 5, 5]);
    expect(game.middle).toHaveLength(9);
    expect(game.currentPlayerId).toBe("p1");
    expect(game.getView("p1").you?.hand).toHaveLength(5);
    expect(game.getView("p2").you?.hand).toHaveLength(5);
    expect(game.getView("p1").players[1].handCount).toBe(5);
  });

  it("asks which duplicate tile to take when several share a value", () => {
    const game = makeGame();
    game.players[0].hand = [{ id: "n3-test", type: "number", value: 3 }];
    game.middle = [
      tile("t3-a", 3),
      tile("t3-b", 3, 1, "number", 1),
      tile("t1", 1)
    ];
    game.currentPlayerId = "p1";

    game.playCard("p1", "n3-test");
    expect(game.pending?.kind).toBe("middle");
    game.chooseTile("p1", "t3-b");

    expect(game.players[0].loot.map((item) => item.id)).toContain("t3-b");
    expect(game.middle.map((item) => item.id)).not.toContain("t3-b");
    expect(game.currentPlayerId).toBe("p2");
  });

  it("takes automatically when the duplicate tiles are mechanically identical", () => {
    const game = makeGame();
    game.players[0].hand = [{ id: "n3-auto", type: "number", value: 3 }];
    game.middle = [tile("t3-auto-a", 3), tile("t3-auto-b", 3), tile("t1-auto", 1)];
    game.currentPlayerId = "p1";

    game.playCard("p1", "n3-auto");

    expect(game.pending).toBeNull();
    expect(game.players[0].loot).toHaveLength(1);
    expect(game.players[0].loot[0].value).toBe(3);
  });

  it("takes automatically with a greedy thief when all middle tiles are identical", () => {
    const game = makeGame();
    game.players[0].hand = [{ id: "greedy-auto", type: "greedy" }];
    game.middle = [tile("g2-a", 2), tile("g2-b", 2), tile("g2-c", 2)];
    game.currentPlayerId = "p1";

    game.playCard("p1", "greedy-auto");

    expect(game.pending).toBeNull();
    expect(game.players[0].loot).toHaveLength(1);
    expect(game.players[0].loot[0].value).toBe(2);
  });

  it("still asks with a greedy thief when the middle tiles differ", () => {
    const game = makeGame();
    game.players[0].hand = [{ id: "greedy-choose", type: "greedy" }];
    game.middle = [tile("g3-a", 3), tile("g3-b", 3, 1, "number", 1), tile("g2", 2)];
    game.currentPlayerId = "p1";

    game.playCard("p1", "greedy-choose");

    expect(game.pending?.kind).toBe("greedy");
  });

  it("steals from another player when the middle has no matching tile", () => {
    const game = makeGame();
    game.players[0].hand = [{ id: "n3-test", type: "number", value: 3 }];
    game.players[1].loot = [loot(tile("t3-other", 3))];
    game.middle = [tile("t1", 1)];
    game.currentPlayerId = "p1";

    game.playCard("p1", "n3-test");
    expect(game.players[0].loot.map((item) => item.id)).toContain("t3-other");
    expect(game.players[1].loot).toHaveLength(0);
  });

  it("lets the player choose only the victim when several hold matching tiles", () => {
    const game = makeGame(3);
    game.players[0].hand = [{ id: "n3-pick", type: "number", value: 3 }];
    game.players[1].loot = [loot(tile("p2-t3-a", 3)), loot(tile("p2-t3-b", 3))];
    game.players[2].loot = [loot(tile("p3-t3", 3))];
    game.middle = [tile("t1-pick", 1)];
    game.currentPlayerId = "p1";

    game.playCard("p1", "n3-pick");
    expect(game.pending).toMatchObject({
      kind: "steal",
      options: [
        { playerId: "p2", count: 2 },
        { playerId: "p3", count: 1 }
      ]
    });

    game.chooseSteal("p1", "p2");

    expect(game.players[0].loot.filter((item) => item.value === 3)).toHaveLength(1);
    expect(game.players[1].loot).toHaveLength(1);
    expect(game.players[2].loot).toHaveLength(1);
  });

  it("lets the dog holder choose between giving the dog or the tile", () => {
    const game = makeGame();
    game.players[0].hand = [{ id: "n3-test", type: "number", value: 3 }];
    game.players[1].loot = [loot(tile("t3-dog", 3))];
    game.middle = [tile("t1", 1)];
    game.dogHolderId = "p2";
    game.currentPlayerId = "p1";

    game.playCard("p1", "n3-test");
    expect(game.pending?.kind).toBe("dog");
    game.dogResponse("p2", true);

    expect(game.dogHolderId).toBe("p1");
    expect(game.players[1].loot.map((item) => item.id)).toContain("t3-dog");
    expect(game.players[0].loot).toHaveLength(0);
    expect(game.currentPlayerId).toBe("p2");
  });

  it("takes the tile when the dog holder declines to use the dog", () => {
    const game = makeGame();
    game.players[0].hand = [{ id: "n3-test", type: "number", value: 3 }];
    game.players[1].loot = [loot(tile("t3-dog", 3))];
    game.middle = [tile("t1", 1)];
    game.dogHolderId = "p2";
    game.currentPlayerId = "p1";

    game.playCard("p1", "n3-test");
    game.dogResponse("p2", false);

    expect(game.players[0].loot.map((item) => item.id)).toContain("t3-dog");
    expect(game.dogHolderId).toBe("p2");
  });

  it("discards the boss tile when the raid ends without a 4 or 5", () => {
    const game = makeGame();
    game.raid = 1;
    game.players[0].loot = [loot(tile("r1-boss", 5, 1, "boss")), loot(tile("t3", 3))];
    game.players[0].hand = [{ id: "n0-test", type: "number", value: 0 }];
    game.middle = [tile("t0-last", 0)];
    game.currentPlayerId = "p1";

    game.playCard("p1", "n0-test");

    expect(game.phase).toBe("RAID_END");
    expect(game.players[0].loot.some((item) => item.kind === "boss")).toBe(false);
    expect(game.events.some((event) => event.type === "bossLost")).toBe(true);
  });

  it("keeps the boss tile when the player also holds a 4 or 5 from that raid", () => {
    const game = makeGame();
    game.raid = 1;
    game.players[0].loot = [loot(tile("r1-boss", 5, 1, "boss")), loot(tile("t4", 4))];
    game.players[0].hand = [{ id: "n0-test", type: "number", value: 0 }];
    game.middle = [tile("t0-last", 0)];
    game.currentPlayerId = "p1";

    game.playCard("p1", "n0-test");

    expect(game.players[0].loot.some((item) => item.kind === "boss")).toBe(true);
  });

  it("plays a complete four-raid game with the auto player", () => {
    const game = makeGame(4, 42);
    let steps = 0;
    while (game.phase !== "GAME_END" && steps < 600) {
      steps += 1;
      if (game.phase === "RAID_END") {
        game.startNextRaid();
      } else if (game.pending) {
        expect(game.autoPlay(game.pending.actorId)).toBe(true);
      } else if (game.currentPlayerId) {
        expect(game.autoPlay(game.currentPlayerId)).toBe(true);
      }
    }
    expect(game.phase).toBe("GAME_END");
    expect(game.result?.players).toHaveLength(4);
    expect(game.raid).toBe(4);
    expect(steps).toBeLessThan(600);
  });

  it("does not leak opponents' hands into the view", () => {
    const game = makeGame(3);
    const view = game.getView("p2");
    expect(view.you?.hand.length).toBe(5);
    expect((view.players[0] as unknown as { hand?: Card[] }).hand).toBeUndefined();
    expect(view.players[0].handCount).toBe(5);
  });
});
