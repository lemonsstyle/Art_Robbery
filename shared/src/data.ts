import type { Card, Raid, Tile } from "./types.js";

export const RAID_INFO = {
  1: { name: "素描", en: "SKETCHES", tone: "gold" },
  2: { name: "雕塑", en: "SCULPTURES", tone: "cobalt" },
  3: { name: "古董", en: "ANTIQUITIES", tone: "clay" },
  4: { name: "画作", en: "PAINTINGS", tone: "forest" }
} as const;

export const RAID_NUMBERS: Raid[] = [1, 2, 3, 4];

const TILE_VALUES = [0, 1, 2, 3, 3, 3, 4, 5];

const ALIBI_DOTS: Record<Raid, Record<number, number[]>> = {
  1: { 0: [2] },
  2: { 0: [2], 1: [1] },
  3: { 0: [2], 1: [1] },
  4: { 0: [2], 1: [1] }
};

export function createRng(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function createDeck(rng: () => number = Math.random): Card[] {
  const cards: Card[] = [];
  for (let value = 0; value <= 5; value += 1) {
    for (let copy = 0; copy < 6; copy += 1) {
      cards.push({ id: `n${value}-${copy}`, type: "number", value });
    }
  }
  for (let copy = 0; copy < 6; copy += 1) {
    cards.push({ id: `boss-${copy}`, type: "boss" });
  }
  for (let copy = 0; copy < 6; copy += 1) {
    cards.push({ id: `dog-${copy}`, type: "dog" });
  }
  for (let copy = 0; copy < 7; copy += 1) {
    cards.push({ id: `greedy-${copy}`, type: "greedy" });
  }
  return shuffle(cards, rng);
}

export function createRaidTiles(raid: Raid, rng: () => number = Math.random): Tile[] {
  const tiles: Tile[] = [];
  const seen = new Map<number, number>();
  for (const value of TILE_VALUES) {
    const index = seen.get(value) ?? 0;
    seen.set(value, index + 1);
    const alibi = ALIBI_DOTS[raid][value]?.[index] ?? 0;
    tiles.push({
      id: `r${raid}-n${value}-${index}`,
      raid,
      kind: "number",
      value,
      alibi
    });
  }
  tiles.push({
    id: `r${raid}-boss`,
    raid,
    kind: "boss",
    value: 5,
    alibi: 0
  });
  return shuffle(tiles, rng);
}

export function cardLabel(card: Card): string {
  if (card.type === "number") return `数字 ${card.value ?? 0}`;
  if (card.type === "boss") return "老板牌";
  if (card.type === "dog") return "看门狗牌";
  return "贪心贼牌";
}

export const TOTAL_TILES_PER_RAID = 9;
export const TOTAL_CARDS = 55;
