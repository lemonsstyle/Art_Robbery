import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { Card, GameView, Tile } from "@steal/shared";
import { PlayingCard } from "./PlayingCard";
import { LootTile } from "./LootTile";
import { DogRunner } from "./DogRunner";
import { BossIcon, PawIcon } from "./Icons";

interface Point {
  x: number;
  y: number;
}

interface Flight {
  id: number;
  kind: "card" | "tile" | "dog";
  card?: Card;
  tile?: Tile;
  from: Point;
  to: Point;
  delay: number;
  duration: number;
  lift: number;
  rotate: number;
  snatch?: boolean;
  boss?: boolean;
}

interface Ring {
  id: number;
  x: number;
  y: number;
  tone: "tile" | "boss" | "dog";
}

interface Paw {
  id: number;
  x: number;
  y: number;
  delay: number;
}

interface Stamp {
  id: number;
  x: number;
  y: number;
}

function pointOfRect(rect: DOMRect): Point {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function centerOf(element: Element | null): Point | null {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  return pointOfRect(rect);
}

function escapeId(value: string): string {
  return typeof CSS !== "undefined" && CSS.escape ? CSS.escape(value) : value;
}

function mark(element: Element | null, className: string, duration = 900): void {
  if (!element) return;
  element.classList.add(className);
  window.setTimeout(() => element.classList.remove(className), duration);
}

export function FlightLayer({ view, myId }: { view: GameView; myId: string }) {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [rings, setRings] = useState<Ring[]>([]);
  const [paws, setPaws] = useState<Paw[]>([]);
  const [stamps, setStamps] = useState<Stamp[]>([]);
  const tileRects = useRef(new Map<string, DOMRect>());
  const prevTileRects = useRef(new Map<string, DOMRect>());
  const cardRects = useRef(new Map<string, DOMRect>());
  const prevCardRects = useRef(new Map<string, DOMRect>());
  const lastSeq = useRef(0);

  useLayoutEffect(() => {
    const previousTiles = tileRects.current;
    const nextTiles = new Map<string, DOMRect>();
    document.querySelectorAll<HTMLElement>("[data-tile-id]").forEach((element) => {
      const id = element.dataset.tileId;
      if (id) nextTiles.set(id, element.getBoundingClientRect());
    });
    prevTileRects.current = previousTiles;
    tileRects.current = nextTiles;

    const previousCards = cardRects.current;
    const nextCards = new Map<string, DOMRect>();
    document.querySelectorAll<HTMLElement>("[data-card-id]").forEach((element) => {
      const id = element.dataset.cardId;
      if (id) nextCards.set(id, element.getBoundingClientRect());
    });
    prevCardRects.current = previousCards;
    cardRects.current = nextCards;
  }, [view.seq, view.raid]);

  useEffect(() => {
    if (view.phase === "LOBBY") return;
    if (view.seq < lastSeq.current) lastSeq.current = 0;
    if (view.seq <= lastSeq.current) return;
    lastSeq.current = view.seq;

    const discard = document.querySelector("[data-discard]");
    const middle = document.querySelector("[data-middle]");
    const seatOf = (id: string) =>
      document.querySelector(`[data-player-id="${escapeId(id)}"]`);
    const lootOf = (id: string) =>
      document.querySelector(`[data-loot="${escapeId(id)}"]`);
    const surfaceOf = (id: string) =>
      seatOf(id) ?? lootOf(id)?.closest(".hand-wrap") ?? null;

    const nextFlights: Flight[] = [];
    const nextRings: Ring[] = [];
    const nextPaws: Paw[] = [];
    const nextStamps: Stamp[] = [];
    const hasPlay = view.events.some((event) => event.type === "play");

    const addRing = (point: Point | null, tone: Ring["tone"]) => {
      if (!point) return;
      nextRings.push({
        id: view.seq * 1000 + nextRings.length,
        x: point.x,
        y: point.y,
        tone
      });
    };

    const addPaws = (from: Point, to: Point) => {
      for (let index = 0; index < 4; index += 1) {
        const t = 0.2 + index * 0.18;
        const wave = Math.sin(t * Math.PI * 2) * 11;
        nextPaws.push({
          id: view.seq * 2000 + nextPaws.length,
          x: from.x + (to.x - from.x) * t + wave,
          y: from.y + (to.y - from.y) * t + Math.cos(t * Math.PI * 2) * 8,
          delay: 120 + index * 90
        });
      }
    };

    for (const event of view.events) {
      if (event.type === "play") {
        const previous = prevCardRects.current.get(event.card.id);
        const source =
          previous ??
          cardRects.current.get(event.card.id) ??
          null;
        const from = source
          ? pointOfRect(source)
          : centerOf(
              event.playerId === myId
                ? document.querySelector('[data-hand="you"]')
                : seatOf(event.playerId)
            );
        const to = centerOf(discard);
        if (from && to) {
          nextFlights.push({
            id: view.seq * 100 + nextFlights.length,
            kind: "card",
            card: event.card,
            from,
            to,
            delay: 0,
            duration: 800,
            lift: 34,
            rotate: -3
          });
        }
      }

      if (event.type === "take") {
        const previous = prevTileRects.current.get(event.tile.id);
        const current = tileRects.current.get(event.tile.id);
        const from = previous
          ? pointOfRect(previous)
          : centerOf(event.from === "middle" ? middle : lootOf(event.targetId ?? ""));
        const to = current
          ? pointOfRect(current)
          : centerOf(lootOf(event.playerId));
        const stolen = event.from === "player";
        const boss = event.tile.kind === "boss";

        if (stolen) mark(surfaceOf(event.targetId ?? ""), "is-snatched", 750);
        if (boss) mark(surfaceOf(event.playerId), "is-boss-acquired", 1400);
        addRing(from, boss ? "boss" : "tile");

        if (from && to) {
          nextFlights.push({
            id: view.seq * 100 + nextFlights.length,
            kind: "tile",
            tile: event.tile,
            from,
            to,
            delay: hasPlay ? 340 : 0,
            duration: 1150,
            lift: 68,
            rotate: 5,
            snatch: stolen,
            boss
          });
        }
      }

      if (event.type === "dogTaken") {
        const source =
          event.from === "middle" ? middle : surfaceOf(event.targetId ?? "");
        const from = centerOf(source);
        const to = centerOf(surfaceOf(event.playerId));
        if (event.targetId) mark(surfaceOf(event.targetId), "is-dog-snatched", 750);
        mark(surfaceOf(event.playerId), "is-dog-acquired", 1400);
        addRing(from, "dog");
        if (from && to) {
          addPaws(from, to);
          nextFlights.push({
            id: view.seq * 100 + nextFlights.length,
            kind: "dog",
            from,
            to,
            delay: hasPlay ? 280 : 0,
            duration: 1050,
            lift: 52,
            rotate: 0
          });
        }
      }

      if (event.type === "dogGiven") {
        const from = centerOf(surfaceOf(event.fromId));
        const to = centerOf(surfaceOf(event.toId));
        mark(surfaceOf(event.fromId), "is-dog-snatched", 750);
        mark(surfaceOf(event.toId), "is-dog-acquired", 1400);
        addRing(from, "dog");
        if (from && to) {
          addPaws(from, to);
          nextFlights.push({
            id: view.seq * 100 + nextFlights.length,
            kind: "dog",
            from,
            to,
            delay: 0,
            duration: 1050,
            lift: 52,
            rotate: 0
          });
        }
      }

      if (event.type === "bossLost") {
        const previous = prevTileRects.current.get(event.tile.id);
        const from = previous
          ? pointOfRect(previous)
          : centerOf(surfaceOf(event.playerId));
        const to = centerOf(middle) ?? centerOf(discard);
        mark(surfaceOf(event.playerId), "is-boss-lost", 1400);
        if (from) {
          nextStamps.push({
            id: view.seq * 3000 + nextStamps.length,
            x: from.x,
            y: from.y
          });
        }
        addRing(from, "boss");
        if (from && to) {
          nextFlights.push({
            id: view.seq * 100 + nextFlights.length,
            kind: "tile",
            tile: event.tile,
            from,
            to,
            delay: 0,
            duration: 1050,
            lift: 68,
            rotate: 4,
            boss: true
          });
        }
      }
    }

    setFlights((previous) => [
      ...previous.filter((flight) => flight.kind === "dog"),
      ...nextFlights
    ]);
    setRings(nextRings);
    setPaws(nextPaws);
    setStamps(nextStamps);

    if (nextFlights.length > 0) {
      const ids = new Set(nextFlights.map((flight) => flight.id));
      window.setTimeout(() => {
        setFlights((previous) => previous.filter((flight) => !ids.has(flight.id)));
      }, 2600);
    }
    if (nextRings.length > 0) {
      const ids = new Set(nextRings.map((ring) => ring.id));
      window.setTimeout(() => {
        setRings((previous) => previous.filter((ring) => !ids.has(ring.id)));
      }, 1000);
    }
    if (nextPaws.length > 0) {
      const ids = new Set(nextPaws.map((paw) => paw.id));
      window.setTimeout(() => {
        setPaws((previous) => previous.filter((paw) => !ids.has(paw.id)));
      }, 1800);
    }
    if (nextStamps.length > 0) {
      const ids = new Set(nextStamps.map((stamp) => stamp.id));
      window.setTimeout(() => {
        setStamps((previous) => previous.filter((stamp) => !ids.has(stamp.id)));
      }, 2000);
    }
  }, [view.seq, view.events, view.phase, myId]);

  return (
    <>
      <div className="flight-layer" aria-hidden="true">
        {flights.map((flight) => (
          <div
            key={flight.id}
            className={[
              "flight",
              `flight--${flight.kind}`,
              flight.snatch ? "flight--snatch" : "",
              flight.boss ? "flight--boss" : ""
            ]
              .filter(Boolean)
              .join(" ")}
            style={
              {
                left: flight.from.x,
                top: flight.from.y,
                "--dx": `${flight.to.x - flight.from.x}px`,
                "--dy": `${flight.to.y - flight.from.y}px`,
                "--delay": `${flight.delay}ms`,
                "--duration": `${flight.duration}ms`,
                "--lift-y": `-${flight.lift}px`,
                "--rot": `${flight.rotate}deg`
              } as CSSProperties
            }
          >
            {flight.kind === "card" && flight.card && (
              <PlayingCard card={flight.card} size="sm" />
            )}
            {flight.kind === "tile" && flight.tile && (
              <LootTile tile={flight.tile} size="sm" />
            )}
            {flight.kind === "dog" && <DogRunner />}
          </div>
        ))}
      </div>

      <div className="ring-layer" aria-hidden="true">
        {rings.map((ring) => (
          <span
            key={ring.id}
            className={`pickup-ring pickup-ring--${ring.tone}`}
            style={{ left: ring.x, top: ring.y }}
          />
        ))}
        {paws.map((paw) => (
          <span
            key={paw.id}
            className="paw-mark"
            style={{
              left: paw.x,
              top: paw.y,
              animationDelay: `${paw.delay}ms`
            }}
          >
            <PawIcon size={11} />
          </span>
        ))}
        {stamps.map((stamp) => (
          <span
            key={stamp.id}
            className="boss-lost-stamp"
            style={{ left: stamp.x, top: stamp.y }}
          >
            <BossIcon size={16} />
            老板失效
          </span>
        ))}
      </div>
    </>
  );
}

export function ActionLayer({ view, myId }: { view: GameView; myId: string }) {
  return <FlightLayer view={view} myId={myId} />;
}
